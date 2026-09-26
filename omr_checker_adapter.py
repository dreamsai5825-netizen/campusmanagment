import os
import sys
import json
import math
import argparse
import shutil
import tempfile
import base64
import numpy as np
from pathlib import Path

# Force UTF-8 encoding for stdout and stderr on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Add omr_checker directory to sys.path so that OMRChecker absolute imports (e.g. from src.logger) resolve correctly
omr_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "omr_checker")
if omr_dir not in sys.path:
    sys.path.insert(0, omr_dir)

from omr_checker.src.entry import entry_point

def detect_roll_number_columns(img, requested_roll_len):
    """
    Detect the physical number of digit columns present in the Roll No box
    on the warped 1191x1684 canvas. Prevents checking columns that spill into
    the Name/Subject fields.
    """
    if requested_roll_len <= 0:
        return 0
    try:
        import cv2
        crop = img[140:500, 70:360]
        if crop is None or crop.size == 0:
            return requested_roll_len
        if len(crop.shape) == 3:
            g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        else:
            g = crop.copy()
        
        _, bin_img = cv2.threshold(g, 180, 255, cv2.THRESH_BINARY_INV)
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 30))
        v_lines = cv2.morphologyEx(bin_img, cv2.MORPH_OPEN, v_kernel)
        col_sums = np.sum(v_lines, axis=0)
        
        actual_cols = 0
        for c in range(1, requested_roll_len + 1):
            cx_rel = 35 + (c - 1) * 30
            if c > 1:
                x_search_start = max(0, cx_rel - 18)
                x_search_end = min(len(col_sums), cx_rel - 4)
                if x_search_end > x_search_start:
                    max_v = np.max(col_sums[x_search_start:x_search_end])
                    if max_v > 255 * 20:
                        break
            actual_cols = c
        return max(1, min(actual_cols, requested_roll_len))
    except Exception as e:
        print(f"[Roll Col Detector] Warning: {e}", file=sys.stderr)
        return requested_roll_len

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=False, default=None, type=str, help='Path to input PDF')
    parser.add_argument('--image', required=False, default=None, type=str, help='Path to input Image')
    parser.add_argument('--page', required=False, default=1, type=int, help='PDF Page Number')
    parser.add_argument('--config', required=True, type=str, help='Path to Config JSON')
    parser.add_argument('--out-dir', required=False, default='temp_out', type=str, help='Output Directory')
    parser.add_argument('--rotation', required=False, default=0.0, type=float,
                        help='Manual rotation override in degrees (-45 to +45). Skips auto-deskew.')
    args = parser.parse_args()

    # Load Config JSON
    with open(args.config, 'r', encoding='utf-8') as f:
        config_data = json.load(f)

    subjects = config_data.get('subjects', [])
    options = config_data.get('options', ['A', 'B', 'C', 'D'])
    roll_length = int(config_data.get('rollNumberLength', 0))
    page_number = args.page

    # Create a unique temporary directory for this OMRChecker execution run
    temp_dir = Path(tempfile.mkdtemp(prefix="omr_run_"))

    # Render and warp target page image using corner markers
    try:
        import cv2
        import numpy as np
        import fitz

        if args.pdf:
            doc = fitz.open(args.pdf)
            pdf_page = doc[page_number - 1]  # 0-indexed
            pix = pdf_page.get_pixmap(dpi=300)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            doc.close()
        else:
            img = cv2.imread(args.image)

        # Resize to standard template dimensions (1191x1684) to process
        canvas = cv2.resize(img, (1191, 1684))
        W, H = 1191, 1684

        # Apply manual rotation if specified via --rotation flag (UI slider)
        rot_angle = 0.0
        if args.rotation != 0.0:
            rot_angle = float(args.rotation)
            print(f"[OMR Adapter] Manual rotation override: {rot_angle:+.1f}deg", file=sys.stderr)
            h_c, w_c = canvas.shape[:2]
            M_r = cv2.getRotationMatrix2D((w_c // 2, h_c // 2), -rot_angle, 1.0)
            canvas = cv2.warpAffine(canvas, M_r, (w_c, h_c),
                                    flags=cv2.INTER_LINEAR,
                                    borderMode=cv2.BORDER_CONSTANT,
                                    borderValue=(255, 255, 255))

        # -----------------------------------------------------------------------
        # ALIGNMENT: Detect the large outer border rectangle of the OMR sheet.
        #
        # The 4mm square anchor marks at the sheet corners are physically cut off
        # by the scanner (confirmed by inspecting corner crops of real scans).
        # Instead we detect the large outer border rectangle drawn at 9.5mm inset
        # from page edge (~54px in the 1191x1684 canvas), which is always visible.
        #
        # Strategy:
        #   1. Canny edges + dilation to trace rectangle outline.
        #   2. Find the largest 4-vertex contour with A4 portrait aspect ratio.
        #   3. Perspective-warp its 4 corners to the template border positions.
        #   4. Fall back to raw canvas if detection fails (OMRChecker auto_align
        #      handles small residual offsets).
        # -----------------------------------------------------------------------

        # PDF generator draws border rect at (9.5mm, 9.5mm), size 191mm x 278mm.
        # At scale 5.671 px/mm: top-left = (54px, 54px), bottom-right = (1137px, 1630px).
        BORDER_TL = (54,   54)
        BORDER_TR = (1137, 54)
        BORDER_BL = (54,   1630)
        BORDER_BR = (1137, 1630)

        processed_img = canvas
        WARP_OK = False
        n_detected = 0

        try:
            g = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)

            # Canny edge detection + dilation to trace the border rectangle outline
            edges = cv2.Canny(g, 30, 100)
            k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            edges = cv2.dilate(edges, k3, iterations=2)

            cnts_rect, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            best_quad = None
            best_area = 0
            min_thresh = (W * H) * 0.25   # must cover > 25% of canvas
            max_thresh = (W * H) * 0.98   # must not cover entire canvas

            for c in cnts_rect:
                area = cv2.contourArea(c)
                if not (min_thresh <= area <= max_thresh):
                    continue
                peri = cv2.arcLength(c, True)
                approx = cv2.approxPolyDP(c, 0.02 * peri, True)
                if len(approx) != 4:
                    continue

                pts_q = approx.reshape(4, 2).astype(float)
                s = pts_q.sum(axis=1)
                d = np.diff(pts_q, axis=1).flatten()
                tl = pts_q[np.argmin(s)]
                br = pts_q[np.argmax(s)]
                tr = pts_q[np.argmin(d)]
                bl = pts_q[np.argmax(d)]

                avg_w = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2
                avg_h = (np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2

                # Must be portrait (taller than wide) with A4-like aspect ratio
                if avg_h <= avg_w:
                    continue
                aspect = avg_w / max(avg_h, 1)
                if not (0.55 <= aspect <= 0.85):
                    continue

                if area > best_area:
                    best_area = area
                    best_quad = (tl, tr, bl, br)

            if best_quad is not None:
                tl, tr, bl, br = best_quad
                all_pts = [tl, tr, bl, br]
                if all(0 <= p[0] <= W and 0 <= p[1] <= H for p in all_pts):
                    src_pts = np.float32([tl, tr, bl, br])
                    dst_pts = np.float32([BORDER_TL, BORDER_TR, BORDER_BL, BORDER_BR])
                    M_warp = cv2.getPerspectiveTransform(src_pts, dst_pts)
                    processed_img = cv2.warpPerspective(canvas, M_warp, (W, H),
                                                        flags=cv2.INTER_LINEAR,
                                                        borderMode=cv2.BORDER_CONSTANT,
                                                        borderValue=(255, 255, 255))
                    WARP_OK = True
                    n_detected = 4
                    print(f"[OMR Adapter] Border-rect warp applied. "
                          f"TL={tuple(tl.astype(int))} TR={tuple(tr.astype(int))} "
                          f"BL={tuple(bl.astype(int))} BR={tuple(br.astype(int))}", file=sys.stderr)
                else:
                    print("[OMR Adapter] Detected border corners outside canvas — using raw canvas.", file=sys.stderr)
            else:
                print("[OMR Adapter] No border rectangle found — using raw canvas. "
                      "OMRChecker auto_align will compensate.", file=sys.stderr)

        except Exception as warp_err:
            print(f"[OMR Adapter] Border-rect detection error: {warp_err} — using raw canvas.", file=sys.stderr)

        cv2.imwrite(str(temp_dir / f"page_{page_number}.png"), processed_img)
    except Exception as e:
        print(json.dumps({"error": f"OMR page preprocessing/warping failed: {str(e)}"}))
        sys.exit(1)

    # Detect physical roll number columns from the processed image
    actual_roll_len = detect_roll_number_columns(processed_img, roll_length)

    # Generate template.json with exact column boundaries (stops before Name/Subject fields)
    column_x_origins = [156.0, 425.4, 694.8, 964.1]
    bubbles_gap = 39.7
    row_height = 30.618
    group_spacer = 9.07
    start_y = 636.2

    questions_per_column = 30
    column_grid = []
    current_global_q = 1

    for sub in subjects:
        sub_name = sub['name']
        q_count = sub['questionCount']
        cols_needed = math.ceil(q_count / questions_per_column)
        start_col = len(column_grid)
        for _ in range(cols_needed):
            column_grid.append([])

        for q in range(1, q_count + 1):
            col_rel = (q - 1) // questions_per_column
            col_idx = start_col + col_rel
            row_idx = (q - 1) % questions_per_column
            column_grid[col_idx].append({
                'subjectName': sub_name,
                'localQ': q,
                'globalQ': current_global_q,
                'rowIdx': row_idx
            })
            current_global_q += 1

    total_q_count = current_global_q - 1

    field_blocks = {}
    if actual_roll_len > 0:
        field_blocks["Roll_No"] = {
            "fieldType": "QTYPE_INT",
            "origin": [105, 196],
            "fieldLabels": [f"r1..{actual_roll_len}"],
            "bubblesGap": 33,
            "labelsGap": 30
        }

    for col_idx, col_items in enumerate(column_grid):
        if not col_items:
            continue
        x_origin = column_x_origins[col_idx % len(column_x_origins)]
        
        groups = {}
        for item in col_items:
            r_idx = item['rowIdx']
            g_idx = r_idx // 5
            if g_idx not in groups:
                groups[g_idx] = []
            groups[g_idx].append(item)

        for g_idx, g_items in groups.items():
            g_start_q = g_items[0]['globalQ']
            g_end_q = g_items[-1]['globalQ']
            sub_name = g_items[0]['subjectName']
            
            y_origin = start_y + (g_idx * 5 * row_height) + (g_idx * group_spacer)
            block_name = f"{sub_name}_c{col_idx+1}_g{g_idx+1}"

            field_blocks[block_name] = {
                "fieldType": f"QTYPE_MCQ{len(options)}",
                "origin": [int(round(x_origin)), int(round(y_origin))],
                "fieldLabels": [f"q{g_start_q}..{g_end_q}"],
                "bubblesGap": int(round(bubbles_gap)),
                "labelsGap": int(round(row_height))
            }

    template_data = {
        "pageDimensions": [1191, 1684],
        "bubbleDimensions": [22, 22],
        "customLabels": {
            "Roll": [f"r1..{actual_roll_len}"] if actual_roll_len > 0 else []
        },
        "outputColumns": (["Roll"] if actual_roll_len > 0 else []) + [f"q1..{total_q_count}"],
        "fieldBlocks": field_blocks,
        "preProcessors": []
    }

    # Write template.json to the temp directory
    with open(temp_dir / "template.json", "w") as f:
        json.dump(template_data, f, indent=2)

    # Generate config.json at full native resolution (1191x1684) to eliminate blurring
    checker_config = {
        "dimensions": {
            "display_height": 1684,
            "display_width": 1191,
            "processing_height": 1684,
            "processing_width": 1191
        },
        "alignment_params": {
            "auto_align": True,
            "match_col": 1,
            "max_steps": 20,
            "stride": 1,
            "thickness": 3
        },
        "outputs": {
            "show_image_level": 0
        }
    }

    with open(temp_dir / "config.json", "w") as f:
        json.dump(checker_config, f, indent=2)

    # Clean and create output directory
    output_dir = Path(args.out_dir)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Setup arguments dict for OMRChecker entry_point
    checker_args = {
        "input_paths": [temp_dir],
        "debug": False,
        "output_dir": str(output_dir),
        "autoAlign": True,
        "setLayout": False
    }

    # Execute OMRChecker
    try:
        entry_point(temp_dir, checker_args)
    except Exception as e:
        print(json.dumps({"error": f"OMRChecker execution failed: {str(e)}"}))
        sys.exit(1)

    # Read output results CSV
    results_dir = output_dir / "Results"
    csv_files = list(results_dir.glob("Results_*.csv"))
    if not csv_files:
        print(json.dumps({"error": "No results CSV file generated by OMRChecker"}))
        sys.exit(1)

    # Read the first Results CSV
    csv_path = csv_files[0]
    import csv
    
    rows = []
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    if not rows:
        print(json.dumps({"error": "Results CSV is empty"}))
        sys.exit(1)

    result_row = rows[0]

    # Map outputs back to our required format
    roll_number = result_row.get("Roll", "")
    
    # Map raw answers
    # Subject -> Question -> Answer
    answers = {}
    q_idx = 1
    for sub in subjects:
        sub_name = sub['name']
        answers[sub_name] = {}
        for q in range(sub['questionCount']):
            col_key = f"q{q_idx}"
            raw_val = result_row.get(col_key, "")
            
            # Map raw value to UI options:
            # - If empty, it's unattempted -> ""
            # - If length > 1 (e.g. "AB"), it's double marked -> "MULTIPLE"
            # - Otherwise, it's a single letter -> "A", "B", etc.
            if not raw_val:
                mapped_val = ""
            elif len(raw_val) > 1:
                mapped_val = "MULTIPLE"
            else:
                mapped_val = raw_val.upper()
                
            answers[sub_name][str(q + 1)] = mapped_val
            q_idx += 1

    # Extract checked/annotated image base64 if present
    scanned_image_base64 = None
    checked_omrs_dir = output_dir / "CheckedOMRs"
    image_files = list(checked_omrs_dir.glob("*.png"))
    if image_files:
        marked_img_path = image_files[0]
        with open(marked_img_path, "rb") as img_f:
            img_data = img_f.read()
            scanned_image_base64 = "data:image/png;base64," + base64.b64encode(img_data).decode('utf-8')

    # Alignment metadata for UI diagnostic info
    alignment_info = {
        "cornersDetected": n_detected,
        "warpApplied": WARP_OK,
        "deskewAngle": rot_angle,
        "detectedCorners": {},
        "expectedCorners": {
            "TL": [54, 54],
            "TR": [1137, 54],
            "BL": [54, 1630],
            "BR": [1137, 1630]
        }
    }

    # Output JSON to stdout
    output_result = {
        "studentInfo": {
            "name": None,
            "class": None,
            "section": None,
            "subject": None,
            "testDate": None
        },
        "rollNumber": roll_number if roll_number else None,
        "answers": answers,
        "scannedImage": scanned_image_base64,
        "alignmentInfo": alignment_info
    }

    print(json.dumps(output_result))

    # Clean up temp folder safely (ignore permission locks on Windows)
    try:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass

if __name__ == '__main__':
    main()
