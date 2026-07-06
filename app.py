import os
import sys
import json
import shutil
import base64
import tempfile
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, Form
from pydantic import BaseModel
from typing import Optional

# Setup OMRChecker import path
omr_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "omr_checker")
sys.path.insert(0, omr_dir)
from src.entry import entry_point

app = FastAPI(title="CampusConnect Python Service")

class WhatsAppRequest(BaseModel):
    phoneNumber: str
    message: str

@app.get("/")
def read_root():
    return {"status": "ok", "service": "CampusConnect Python Service"}

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
    fileType: Optional[str] = Form("pdf") # "pdf" or "image"
):
    try:
        config_data = json.loads(config)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid config JSON: {str(e)}")

    subjects = config_data.get('subjects', [])
    options = config_data.get('options', [])
    roll_length = config_data.get('rollNumberLength', 6)

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

            col_idx = idx % len(column_x_origins)
            x_origin = column_x_origins[col_idx]
            bubbles_gap = column_bubbles_gaps[col_idx]

            # Split into 5 groups of 5 questions each
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
                    "labelsGap": 30
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

        # Write template.json
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
                "pdf_page": [page]
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
        
        # Copy input sheet and config files to input folder for OMRChecker
        shutil.copy(temp_dir / "template.json", input_folder / "template.json")
        shutil.copy(temp_dir / "config.json", input_folder / "config.json")
        shutil.copy(input_file_path, input_folder / ("target_sheet.pdf" if is_pdf else f"target_sheet{input_file_path.suffix}"))

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

        # Extract checked/annotated image base64 if present
        scanned_image_base64 = None
        checked_omrs_dir = out_dir / "CheckedOMRs"
        image_files = list(checked_omrs_dir.glob("*.png"))
        if image_files:
            marked_img_path = image_files[0]
            with open(marked_img_path, "rb") as img_f:
                img_data = img_f.read()
                scanned_image_base64 = "data:image/png;base64," + base64.b64encode(img_data).decode('utf-8')

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
            "scannedImage": scanned_image_base64
        }
