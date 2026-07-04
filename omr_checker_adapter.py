import os
import sys
import json
import argparse
import shutil
import base64
from pathlib import Path

# Add omr_checker directory to sys.path so that OMRChecker absolute imports (e.g. from src.logger) resolve correctly
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "omr_checker"))

from src.entry import entry_point

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=False, default=None, type=str, help='Path to input PDF')
    parser.add_argument('--image', required=False, default=None, type=str, help='Path to input Image')
    parser.add_argument('--page', required=True, type=int, help='Page number (1-indexed)')
    parser.add_argument('--config', required=True, type=str, help='Path to config JSON')
    parser.add_argument('--out-dir', required=True, type=str, help='Output directory')
    args = parser.parse_args()

    # Load configuration from JSON file
    with open(args.config, 'r', encoding='utf-8') as config_f:
        config_data = json.load(config_f)

    subjects = config_data['subjects']
    options = config_data['options']
    roll_length = config_data['rollNumberLength']
    page_number = args.page

    # Create a temporary directory inside the workspace for OMRChecker inputs
    temp_dir = Path("omr_checker_temp")
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Save target file to the temporary directory
    if args.pdf:
        target_file_path = temp_dir / "target_sheet.pdf"
        shutil.copy(args.pdf, target_file_path)
    elif args.image:
        # Get extension of input image
        ext = Path(args.image).suffix
        target_file_path = temp_dir / f"target_sheet{ext}"
        shutil.copy(args.image, target_file_path)
    else:
        print(json.dumps({"error": "Either --pdf or --image must be provided"}))
        sys.exit(1)

    # Generate template.json
    field_blocks = {
        "Roll_No": {
            "fieldType": "QTYPE_INT",
            "origin": [108, 215],
            "fieldLabels": [f"r1..{roll_length}"],
            "bubblesGap": 33,
            "labelsGap": 29
        }
    }

    column_x_origins = [158, 416, 678, 946]
    column_bubbles_gaps = [38.5, 38.5, 38.5, 39.0]

    q_start = 1
    total_q_count = 0
    for idx, sub in enumerate(subjects):
        sub_name = sub['name']
        q_count = sub['questionCount']
        q_end = q_start + q_count - 1
        total_q_count += q_count

        # Map to columns sequentially
        col_idx = idx % len(column_x_origins)
        x_origin = column_x_origins[col_idx]
        bubbles_gap = column_bubbles_gaps[col_idx]

        # Split into 5 groups of 5 questions each to account for the vertical layout spacers
        current_y = 645.0
        for g in range(5):
            g_start = q_start + g * 5
            g_end = g_start + 4
            block_name = f"{sub_name}_g{g+1}"
            
            field_blocks[block_name] = {
                "fieldType": f"QTYPE_MCQ{len(options)}",
                "origin": [int(round(x_origin)), int(round(current_y))],
                "fieldLabels": [f"q{g_start}..{g_end}"],
                "bubblesGap": int(round(bubbles_gap)),
                "labelsGap": 30 # round 29.5 pt row height
            }
            current_y += 5 * 29.5 + 9.0

        q_start = q_end + 1

    template_data = {
        "pageDimensions": [1191, 1684],
        "bubbleDimensions": [22, 22],
        "customLabels": {
            "Roll": [f"r1..{roll_length}"]
        },
        "outputColumns": [
            "Roll",
            f"q1..{total_q_count}"
        ],
        "fieldBlocks": field_blocks,
        "preProcessors": []
    }

    # Write template.json to the temp directory
    with open(temp_dir / "template.json", "w") as f:
        json.dump(template_data, f, indent=2)

    # Generate config.json with target page number
    checker_config = {
        "dimensions": {
            "display_height": 2480,
            "display_width": 1640,
            "processing_height": 820,
            "processing_width": 666
        },
        "alignment_params": {
            "auto_align": True,
            "match_col": 5,
            "max_steps": 20,
            "stride": 1,
            "thickness": 3
        },
        "outputs": {
            "show_image_level": 0
        },
        "pdf_params": {
            "pdf_page": [page_number]
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
        "scannedImage": scanned_image_base64
    }

    print(json.dumps(output_result))

    # Clean up temp folder
    if temp_dir.exists():
        shutil.rmtree(temp_dir)

if __name__ == '__main__':
    main()
