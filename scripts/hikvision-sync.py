import os
import sys
import time
import threading
import requests
from requests.auth import HTTPDigestAuth
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Global configuration state
device_config = {
    "enabled": False,
    "device_ip": "",
    "username": "",
    "password": "",
    "last_updated": None
}

config_lock = threading.Lock()
sync_trigger = threading.Event()

# 1. Initialize Firebase Admin SDK
# Path to your Firebase service account JSON key file.
FIREBASE_KEY_PATH = "cms-011-firebase-adminsdk.json" 

if not os.path.exists(FIREBASE_KEY_PATH):
    print(f"Error: Firebase credential file '{FIREBASE_KEY_PATH}' not found in the project root.")
    print("Please download your firebase-service-account.json and rename it to 'cms-011-firebase-adminsdk.json'.")
    sys.exit(1)

# Check command line arguments
if len(sys.argv) < 2:
    print("Usage: python scripts/hikvision-sync.py <COLLEGE_ID>")
    print("Example: python scripts/hikvision-sync.py college_011")
    sys.exit(1)

COLLEGE_ID = sys.argv[1]

cred = credentials.Certificate(FIREBASE_KEY_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

LAST_SYNC_FILE = f"last_sync_timestamp_{COLLEGE_ID}.txt"

def get_last_sync_time():
    if os.path.exists(LAST_SYNC_FILE):
        with open(LAST_SYNC_FILE, "r") as f:
            return f.read().strip()
    return None

def save_last_sync_time(timestamp):
    with open(LAST_SYNC_FILE, "w") as f:
        f.write(timestamp)

def process_and_sync_record(emp_no, event_time, device_name):
    # Lookup the teacher profile matching the biometric ID for this specific college
    teachers_ref = db.collection("teachers")
    query = teachers_ref.where("collegeId", "==", COLLEGE_ID).where("biometricId", "==", emp_no).limit(1).get()
    
    if not query:
        print(f"[{datetime.now()}] [Sync] Unregistered Biometric ID: '{emp_no}' (Skipped)")
        return
        
    teacher_doc = query[0]
    teacher_id = teacher_doc.id
    teacher_data = teacher_doc.to_dict()
    teacher_name = teacher_data.get("name")
    
    # Parse event timestamp
    try:
        dt = datetime.fromisoformat(event_time.replace("Z", "+00:00"))
    except ValueError:
        print(f"[{datetime.now()}] [Error] Invalid event timestamp format: '{event_time}'")
        return
        
    date_str = dt.strftime("%Y-%m-%d")
    doc_id = f"{date_str}_{teacher_id}"
    
    # Reference to the daily attendance document
    attendance_ref = db.collection("facultyAttendance").document(doc_id)
    doc_snap = attendance_ref.get()
    
    log_entry = {
        "time": dt.isoformat(),
        "type": "Check-In" if dt.hour < 13 else "Check-Out",
        "deviceId": device_name
    }
    
    if doc_snap.exists:
        att_data = doc_snap.to_dict()
        logs = att_data.get("logs", [])
        
        # Check for duplicate timestamp
        if not any(l["time"] == log_entry["time"] for l in logs):
            logs.append(log_entry)
            logs.sort(key=lambda x: x["time"]) # Keep chronological
            
            updates = {
                "logs": logs,
                "lastCheckOut": logs[-1]["time"]
            }
            attendance_ref.update(updates)
            print(f"[{datetime.now()}] [Sync] Updated attendance for {teacher_name} ({emp_no}) at {dt.strftime('%H:%M:%S')}")
    else:
        # Create new record for the day
        new_record = {
            "teacherId": teacher_id,
            "teacherName": teacher_name,
            "collegeId": COLLEGE_ID,
            "date": date_str,
            "firstCheckIn": dt.isoformat(),
            "lastCheckOut": dt.isoformat(),
            "status": "Present",
            "logs": [log_entry]
        }
        attendance_ref.set(new_record)
        print(f"[{datetime.now()}] [Sync] First check-in registered for {teacher_name} ({emp_no}) at {dt.strftime('%H:%M:%S')}")

def sync_logs():
    with config_lock:
        enabled = device_config["enabled"]
        ip = device_config["device_ip"]
        user = device_config["username"]
        pw = device_config["password"]

    if not enabled:
        return

    if not ip or not user or not pw:
        print(f"[{datetime.now()}] [Sync] Warning: Biometrics enabled, but credentials are incomplete.")
        return

    last_sync = get_last_sync_time()
    
    # Hikvision event search query body
    search_payload = {
        "AcsEventCond": {
            "searchID": f"sync_{COLLEGE_ID}",
            "maxResults": 50,
            "major": 5,    # Access Control Event
            "minor": 75,   # Legal Card Pass / Face Recognized
        }
    }
    
    if last_sync:
        search_payload["AcsEventCond"]["startTime"] = last_sync

    url = f"http://{ip}/ISAPI/AccessControl/AcsEvent?format=json"

    try:
        response = requests.post(
            url,
            json=search_payload,
            auth=HTTPDigestAuth(user, pw),
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 401:
            print(f"[{datetime.now()}] [Sync Error] Authentication failed (401) for device at {ip}")
            return
        elif response.status_code != 200:
            print(f"[{datetime.now()}] [Sync Error] Device returned HTTP {response.status_code}: {response.text}")
            return
            
        data = response.json()
        events = data.get("AcsEvent", {}).get("InfoList", [])
        
        if not events:
            return

        print(f"[{datetime.now()}] [Sync] Synchronising {len(events)} biometric swipes to Firestore...")
        
        latest_timestamp = last_sync
        
        for event in events:
            emp_no = event.get("employeeNoString")
            event_time = event.get("time")
            device_name = event.get("deviceName", "Wi-Fi Terminal")
            
            if not emp_no:
                continue
                
            if not latest_timestamp or event_time > latest_timestamp:
                latest_timestamp = event_time
                
            process_and_sync_record(emp_no, event_time, device_name)
            
        if latest_timestamp:
            save_last_sync_time(latest_timestamp)
            
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now()}] [Connection Status] Offline. Could not connect to device at {ip} (Is it on this Wi-Fi network?)")
    except Exception as e:
        print(f"[{datetime.now()}] [Sync Error] unexpected failure: {e}")

# Real-time listener for Firestore document
def on_college_document_change(doc_snapshot, changes, read_time):
    global device_config
    
    for doc in doc_snapshot:
        data = doc.to_dict()
        biometrics = data.get("biometricSettings")
        
        if not biometrics:
            print(f"[{datetime.now()}] [Config] Biometrics is not configured for this college.")
            with config_lock:
                device_config["enabled"] = False
            return
            
        new_enabled = biometrics.get("enabled", False)
        new_ip = biometrics.get("deviceIp", "")
        new_user = biometrics.get("username", "")
        new_pw = biometrics.get("password", "")
        new_updated = biometrics.get("updatedAt", "")
        
        with config_lock:
            # Check if config has actually changed or been toggled on
            has_changed = (
                device_config["device_ip"] != new_ip or
                device_config["username"] != new_user or
                device_config["password"] != new_pw or
                device_config["enabled"] != new_enabled or
                device_config["last_updated"] != new_updated
            )
            
            if has_changed:
                device_config.update({
                    "enabled": new_enabled,
                    "device_ip": new_ip,
                    "username": new_user,
                    "password": new_pw,
                    "last_updated": new_updated
                })
                
                print(f"\n[{datetime.now()}] [Config] New configuration detected (Save pressed in Admin Panel)!")
                print(f" - Integration Active: {new_enabled}")
                if new_enabled:
                    print(f" - Local Device IP: {new_ip}")
                    print(f" - Username: {new_user}")
                    print("---------------------------------------------------------")
                    print("Running immediate hardware integration check and sync...")
                    # Trigger the background daemon thread to run sync immediately
                    sync_trigger.set()

def run_polling_loop():
    while True:
        # Wait up to 5 minutes (300s) or until custom trigger occurs
        triggered = sync_trigger.wait(timeout=300)
        
        if triggered:
            # Clear trigger immediately
            sync_trigger.clear()
            
        # Run sync function
        sync_logs()

if __name__ == "__main__":
    print("=========================================================================")
    print("         CampusConnect Hikvision Biometric Attendance Sync Service        ")
    print("=========================================================================")
    print(f"College Scope: {COLLEGE_ID}")
    print("Monitoring configuration settings in cloud database for real-time changes...")
    
    # Start the real-time Firestore listener
    college_ref = db.collection("colleges").document(COLLEGE_ID)
    doc_watch = college_ref.on_snapshot(on_college_document_change)
    
    # Run sync daemon in a background thread
    daemon_thread = threading.Thread(target=run_polling_loop, daemon=True)
    daemon_thread.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutdown signal received. Stopping local sync service.")
        sys.exit(0)
