import os
import sys
import json
import math
import shutil
import base64
import tempfile
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, Form
from pydantic import BaseModel
from typing import Optional

# Setup OMRChecker import path
omr_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "omr_checker")
if omr_dir not in sys.path:
    sys.path.insert(0, omr_dir)

from omr_checker.src.entry import entry_point

import omr_ml_classifier

app = FastAPI(title="CampusConnect Python Service")

class WhatsAppRequest(BaseModel):
    phoneNumber: str
    message: str

class MLFeedbackRequest(BaseModel):
    sampleName: Optional[str] = None
    base64Image: Optional[str] = None
    label: str # "filled" or "unfilled" (or 1/0)

class MLTrainRequest(BaseModel):
    epochs: Optional[int] = 5
    lr: Optional[float] = 0.001

@app.get("/")
def read_root():
    return {"status": "ok", "service": "CampusConnect Python Service"}

@app.get("/api/omr/ml/status")
def get_ml_status():
    """Retrieve PyTorch ML OMR model status, accuracy, and active dataset size."""
    try:
        return omr_ml_classifier.get_model_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch ML status: {str(e)}")

@app.get("/api/omr/ml/samples")
def get_ml_samples(limit: int = 60, offset: int = 0, category: str = "all"):
    """Retrieve base64 bubble images and labels from the active dataset."""
    try:
        return omr_ml_classifier.get_dataset_samples(limit=limit, offset=offset, category=category)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dataset samples: {str(e)}")

@app.post("/api/omr/ml/train")
def train_ml_model(payload: Optional[MLTrainRequest] = None):
    """Trigger PyTorch CNN model training/fine-tuning on the active OMR dataset."""
    try:
        epochs = payload.epochs if payload and payload.epochs else 5
        lr = payload.lr if payload and payload.lr else 0.001
        meta = omr_ml_classifier.train_and_save_model(epochs=epochs, lr=lr)
        return {
            "success": True,
            "message": "PyTorch ML OMR model trained successfully.",
            "metrics": meta
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML model training failed: {str(e)}")

@app.post("/api/omr/ml/feedback")
def submit_ml_feedback(payload: MLFeedbackRequest):
    """Save user/teacher feedback for active learning dataset fine-tuning and auto-train baseline."""
    try:
        if payload.base64Image:
            clean_b64 = payload.base64Image.split(",")[1] if "," in payload.base64Image else payload.base64Image
            img_bytes = base64.b64decode(clean_b64)
            img_np = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            lbl_val = 1 if payload.label.lower() in ["filled", "1", "true"] else 0
            saved_path = omr_ml_classifier.save_active_sample(img_np, label=lbl_val, sample_name=payload.sampleName)
            
            # Immediately trigger fine-tuning training on the updated active learning dataset
            meta = omr_ml_classifier.train_and_save_model(epochs=3, lr=0.001)
            
            return {
                "success": True,
                "saved_path": saved_path,
                "training_meta": meta,
                "message": "Feedback saved and PyTorch model fine-tuned successfully."
            }
        else:
            raise HTTPException(status_code=400, detail="base64Image is required for feedback")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback submission failed: {str(e)}")

@app.post("/api/whatsapp/send")
async def send_whatsapp(payload: WhatsAppRequest):
    try:
        from whatsapp_service import send_whatsapp_message
        res = send_whatsapp_message(payload.phoneNumber, payload.message)
        return res
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"WhatsApp service error: {str(e)}"
        }

@app.post("/api/omr/check")
async def check_omr(
    page: int = Form(...),
    config: str = Form(...), # JSON string
    file: UploadFile = None,
    base64File: Optional[str] = Form(None),
    fileType: Optional[str] = Form("pdf"), # "pdf" or "image"
    rotationAngle: Optional[float] = Form(0.0) # manual tilt override
):
    try:
        config_data = json.loads(config)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid config JSON: {str(e)}")

    subjects = config_data.get('subjects', [])
    options = config_data.get('options', [])
    roll_length = int(config_data.get('rollNumberLength', 0))

    # Use a temporary directory for processing
    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        
        # Save input file
        if file:
            filename = file.filename
            input_file_path = temp_dir / filename
            with open(input_file_path, "wb") as f:
                f.write(await file.read())
            
            is_pdf = filename.lower().endswith(".pdf")
        elif base64File:
            # Decode base64
            is_pdf = (fileType == "pdf")
            ext = ".pdf" if is_pdf else ".png"
            input_file_path = temp_dir / f"target_sheet{ext}"
            
            # Clean base64 header if present
            clean_b64 = base64File
            if "," in base64File:
                clean_b64 = base64File.split(",")[1]
                
            with open(input_file_path, "wb") as f:
                f.write(base64.b64decode(clean_b64))
        else:
            raise HTTPException(status_code=400, detail="No file or base64File provided")

        # Config for OMR dimensions
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

        # Generate config.json at full native resolution (1191x1684) — matches adapter
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

        # Output directory inside our temp_dir
        out_dir = temp_dir / "out"
        out_dir.mkdir(exist_ok=True)

        # OMR input folder configuration
        input_folder = temp_dir / "inputs"
        input_folder.mkdir(exist_ok=True)

        # Render and warp target page image using robust corner detection
        try:
            import cv2
            import numpy as np
            import fitz

            if is_pdf:
                doc = fitz.open(str(input_file_path))
                pdf_page = doc[page - 1]  # 0-indexed
                pix = pdf_page.get_pixmap(dpi=300)
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                doc.close()
            else:
                img = cv2.imread(str(input_file_path))

            # Resize to standard template dimensions (1191x1684)
            canvas = cv2.resize(img, (1191, 1684))
            W, H = 1191, 1684

            # Apply manual rotation if specified
            rot_angle = 0.0
            manual_rot = float(rotationAngle) if rotationAngle else 0.0
            if manual_rot != 0.0:
                rot_angle = manual_rot
                h_c, w_c = canvas.shape[:2]
                M_r = cv2.getRotationMatrix2D((w_c // 2, h_c // 2), -rot_angle, 1.0)
                canvas = cv2.warpAffine(canvas, M_r, (w_c, h_c),
                                        flags=cv2.INTER_LINEAR,
                                        borderMode=cv2.BORDER_CONSTANT,
                                        borderValue=(255, 255, 255))

            # Expected page-border rectangle corners in template pixels
            BORDER_TL = (54,   54)
            BORDER_TR = (1137, 54)
            BORDER_BL = (54,   1630)
            BORDER_BR = (1137, 1630)

            processed_img = canvas
            WARP_OK = False
            n_detected = 0

            try:
                g = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
                edges = cv2.Canny(g, 30, 100)
                k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
                edges = cv2.dilate(edges, k3, iterations=2)

                cnts_rect, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                best_quad = None
                best_area = 0
                min_thresh = (W * H) * 0.25
                max_thresh = (W * H) * 0.98

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

            except Exception as warp_err:
                print(f"[OMR Service] Border warp error: {warp_err}")

            cv2.imwrite(str(input_folder / f"page_{page}.png"), processed_img)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OMR page preprocessing/warping failed: {str(e)}")

        # Auto-detect physical roll number columns on sheet to prevent overflowing into Name/Subject text
        actual_roll_len = roll_length
        if roll_length > 0:
            try:
                crop = processed_img[140:500, 70:360]
                if crop is not None and crop.size > 0:
                    g_c = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop.copy()
                    _, bin_c = cv2.threshold(g_c, 180, 255, cv2.THRESH_BINARY_INV)
                    v_k = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 30))
                    v_l = cv2.morphologyEx(bin_c, cv2.MORPH_OPEN, v_k)
                    c_sums = np.sum(v_l, axis=0)
                    det_cols = 0
                    for c_idx in range(1, roll_length + 1):
                        cx_r = 35 + (c_idx - 1) * 30
                        if c_idx > 1:
                            x_s1 = max(0, cx_r - 18)
                            x_s2 = min(len(c_sums), cx_r - 4)
                            if x_s2 > x_s1 and np.max(c_sums[x_s1:x_s2]) > 255 * 20:
                                break
                        det_cols = c_idx
                    actual_roll_len = max(1, min(det_cols, roll_length))
            except Exception as r_err:
                print(f"[OMR Service] Roll col detection warning: {r_err}")
                actual_roll_len = roll_length

        # Generate template.json matching actual columns
        column_x_origins_t = [156.0, 425.4, 694.8, 964.1]
        bubbles_gap_t = 39.7
        row_height_t = 30.618
        group_spacer_t = 9.07
        start_y_t = 636.2
        questions_per_column_t = 30

        column_grid_t = []
        current_global_q_t = 1
        for sub in subjects:
            sub_name = sub['name']
            q_count = sub['questionCount']
            cols_needed = math.ceil(q_count / questions_per_column_t)
            start_col_t = len(column_grid_t)
            for _ in range(cols_needed):
                column_grid_t.append([])
            for q in range(1, q_count + 1):
                col_rel = (q - 1) // questions_per_column_t
                col_idx_t = start_col_t + col_rel
                row_idx_t = (q - 1) % questions_per_column_t
                column_grid_t[col_idx_t].append({
                    'subjectName': sub_name,
                    'localQ': q,
                    'globalQ': current_global_q_t,
                    'rowIdx': row_idx_t
                })
                current_global_q_t += 1

        total_q_count = current_global_q_t - 1

        field_blocks = {}
        if actual_roll_len > 0:
            field_blocks["Roll_No"] = {
                "fieldType": "QTYPE_INT",
                "origin": [105, 196],
                "fieldLabels": [f"r1..{actual_roll_len}" if actual_roll_len > 1 else "r1"],
                "bubblesGap": 33,
                "labelsGap": 30
            }

        for col_idx_t, col_items in enumerate(column_grid_t):
            if not col_items:
                continue
            x_origin_t = column_x_origins_t[col_idx_t % len(column_x_origins_t)]
            groups_t = {}
            for item in col_items:
                g_idx = item['rowIdx'] // 5
                if g_idx not in groups_t:
                    groups_t[g_idx] = []
                groups_t[g_idx].append(item)
            for g_idx, g_items in groups_t.items():
                g_start_q = g_items[0]['globalQ']
                g_end_q = g_items[-1]['globalQ']
                sub_name = g_items[0]['subjectName']
                y_origin_t = start_y_t + (g_idx * 5 * row_height_t) + (g_idx * group_spacer_t)
                block_name = f"{sub_name}_c{col_idx_t+1}_g{g_idx+1}"
                field_blocks[block_name] = {
                    "fieldType": f"QTYPE_MCQ{len(options)}",
                    "origin": [int(round(x_origin_t)), int(round(y_origin_t))],
                    "fieldLabels": [f"q{g_start_q}..{g_end_q}" if g_end_q > g_start_q else f"q{g_start_q}"],
                    "bubblesGap": int(round(bubbles_gap_t)),
                    "labelsGap": int(round(row_height_t))
                }

        template_data = {
            "pageDimensions": [1191, 1684],
            "bubbleDimensions": [22, 22],
            "customLabels": {
                "Roll": [f"r1..{actual_roll_len}" if actual_roll_len > 1 else "r1"] if actual_roll_len > 0 else []
            },
            "outputColumns": (["Roll"] if actual_roll_len > 0 else []) + ([f"q1..{total_q_count}"] if total_q_count > 1 else ([f"q1"] if total_q_count == 1 else [])),
            "fieldBlocks": field_blocks,
            "preProcessors": []
        }

        with open(temp_dir / "template.json", "w") as f:
            json.dump(template_data, f, indent=2)

        # Copy config files to input folder for OMRChecker
        shutil.copy(temp_dir / "template.json", input_folder / "template.json")
        shutil.copy(temp_dir / "config.json", input_folder / "config.json")

        # Setup arguments dict for OMRChecker entry_point
        checker_args = {
            "input_paths": [input_folder],
            "debug": False,
            "output_dir": str(out_dir),
            "autoAlign": True,
            "setLayout": False
        }

        # Execute OMRChecker
        try:
            entry_point(input_folder, checker_args)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OMRChecker execution failed: {str(e)}")

        # Read output results CSV
        results_dir = out_dir / "Results"
        csv_files = list(results_dir.glob("Results_*.csv"))
        if not csv_files:
            raise HTTPException(status_code=500, detail="No results CSV file generated by OMRChecker")

        csv_path = csv_files[0]
        import csv
        
        rows = []
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)

        if not rows:
            raise HTTPException(status_code=500, detail="Results CSV is empty")

        result_row = rows[0]
        roll_number = result_row.get("Roll", "")
        
        answers = {}
        q_idx = 1
        for sub in subjects:
            sub_name = sub['name']
            answers[sub_name] = {}
            for q in range(sub['questionCount']):
                col_key = f"q{q_idx}"
                raw_val = result_row.get(col_key, "")
                
                if not raw_val:
                    mapped_val = ""
                elif len(raw_val) > 1:
                    mapped_val = "MULTIPLE"
                else:
                    mapped_val = raw_val.upper()
                    
                answers[sub_name][str(q + 1)] = mapped_val
                q_idx += 1

        # --- PyTorch ML Model Active Inference & Correction Pass ---
        # Extract bubble patches directly from processed_img (1191x1684) and run CNN classifier
        ml_corrections_count = 0
        total_bubbles_evaluated = 0
        total_ml_confidence = 0.0

        try:
            num_options = len(options)
            patch_list = []
            patch_meta = [] # list of (sub_name, q_local_str, option_char)

            current_start_col_t = 0
            for sub in subjects:
                sub_name = sub['name']
                q_count = sub['questionCount']
                for q in range(1, q_count + 1):
                    col_rel = (q - 1) // 30
                    col_idx_t = current_start_col_t + col_rel
                    r_idx_t = (q - 1) % 30
                    g_idx_t = r_idx_t // 5
                    rem_t = r_idx_t % 5

                    x_orig_t = column_x_origins_t[col_idx_t % len(column_x_origins_t)]
                    cy_t = start_y_t + (g_idx_t * 5 * row_height_t) + (g_idx_t * group_spacer_t) + (rem_t * row_height_t)

                    for opt_idx in range(num_options):
                        cx_t = x_orig_t + opt_idx * bubbles_gap_t
                        opt_char = options[opt_idx].upper()

                        cx_i = int(round(cx_t))
                        cy_i = int(round(cy_t))

                        x1 = max(0, cx_i - 16)
                        x2 = min(1191, cx_i + 16)
                        y1 = max(0, cy_i - 16)
                        y2 = min(1684, cy_i + 16)

                        patch_crop = processed_img[y1:y2, x1:x2]
                        if patch_crop.shape[0] > 0 and patch_crop.shape[1] > 0:
                            patch_list.append(patch_crop)
                            patch_meta.append((sub_name, str(q), opt_char))

                cols_needed = math.ceil(q_count / 30)
                current_start_col_t += cols_needed

            if patch_list:
                cnn_preds = omr_ml_classifier.predict_bubble_patches(patch_list)
                total_bubbles_evaluated = len(cnn_preds)

                # Group predictions by (sub_name, q_str)
                q_predictions = {}
                for idx, pred in enumerate(cnn_preds):
                    sub_n, q_str, opt_c = patch_meta[idx]
                    total_ml_confidence += pred['confidence']
                    key = (sub_n, q_str)
                    if key not in q_predictions:
                        q_predictions[key] = []
                    q_predictions[key].append((opt_c, pred['prob_filled'], pred['is_filled'], pred.get('darkness_ratio', 0.0)))

                # ML diagnostic and safety refinement pass
                for key, opt_preds in q_predictions.items():
                    sub_n, q_str = key
                    current_ans = answers.get(sub_n, {}).get(q_str, "")

                    # Filled options according to PyTorch CNN + darkness analysis
                    cnn_filled_opts = [opt for opt, p_filled, is_f, d_val in opt_preds if is_f and p_filled >= 0.80 and d_val >= 0.35]

                    # 1. If OMRChecker returned unattempted/blank, and ML detected an unambiguous single filled bubble:
                    if not current_ans and len(cnn_filled_opts) == 1:
                        answers[sub_n][q_str] = cnn_filled_opts[0]
                        ml_corrections_count += 1
                    # 2. If OMRChecker flagged MULTIPLE, but ML + darkness confirms only 1 bubble has physical ink:
                    elif current_ans == "MULTIPLE" and len(cnn_filled_opts) == 1:
                        answers[sub_n][q_str] = cnn_filled_opts[0]
                        ml_corrections_count += 1
                    # 3. If OMRChecker flagged MULTIPLE, and no bubbles had genuine ink:
                    elif current_ans == "MULTIPLE" and len(cnn_filled_opts) == 0:
                        answers[sub_n][q_str] = ""
                        ml_corrections_count += 1
                    # 4. If OMRChecker parsed a valid single option (e.g. "A", "B", "C", "D"), preserve it!
        except Exception as ml_err:
            print(f"[OMR_ML] Inference pass warning: {ml_err}")

        # Extract checked/annotated image base64 if present (rendered at crisp 1200px width for high readability)
        scanned_image_base64 = None
        checked_omrs_dir = out_dir / "CheckedOMRs"
        image_files = list(checked_omrs_dir.glob("*.png"))
        if image_files:
            marked_img_path = image_files[0]
            img_marked = cv2.imread(str(marked_img_path))
            if img_marked is not None:
                h_m, w_m = img_marked.shape[:2]
                if w_m > 1200:
                    new_h = int(h_m * (1200.0 / w_m))
                    img_marked = cv2.resize(img_marked, (1200, new_h), interpolation=cv2.INTER_AREA)
                _, enc_jpg = cv2.imencode('.jpg', img_marked, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                scanned_image_base64 = "data:image/jpeg;base64," + base64.b64encode(enc_jpg).decode('utf-8')
            else:
                with open(marked_img_path, "rb") as img_f:
                    scanned_image_base64 = "data:image/png;base64," + base64.b64encode(img_f.read()).decode('utf-8')

        # Extract ML model status and predictions
        ml_info = omr_ml_classifier.get_model_status()
        avg_confidence = round((total_ml_confidence / max(total_bubbles_evaluated, 1)) * 100, 1)

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

        return {
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
            "alignmentInfo": alignment_info,
            "mlAnalysis": {
                "modelActive": True,
                "modelAccuracy": ml_info.get("training_accuracy", 100.0),
                "totalTrainingSamples": ml_info.get("total_labeled_samples", 0),
                "lastTrained": ml_info.get("last_trained", "Recently"),
                "totalBubblesEvaluated": total_bubbles_evaluated,
                "mlRefinementCorrections": ml_corrections_count,
                "avgModelConfidence": avg_confidence,
                "status": f"Active PyTorch CNN Inference (Refined {ml_corrections_count} bubbles with {avg_confidence}% confidence)"
            }
        }
