import requests
from requests.auth import HTTPDigestAuth
import json

ip = "192.168.1.250"
auth = HTTPDigestAuth("admin", "AGI@2026@")

url = f"http://{ip}/ISAPI/AccessControl/UserInfo/Search?format=json"

pos = 0
all_users = []
while True:
    payload = {
        "UserInfoSearchCond": {
            "searchID": "auto_map_depts",
            "searchResultPosition": pos,
            "maxResults": 30
        }
    }
    r = requests.post(url, json=payload, auth=auth, timeout=5)
    data = r.json()
    info_list = data.get("UserInfoSearch", {}).get("UserInfo", [])
    if not info_list:
        break
    all_users.extend(info_list)
    pos += len(info_list)
    if pos >= data.get("UserInfoSearch", {}).get("totalMatches", 0):
        break

GROUP_MAP = {
    1: "ADMINISTRATOR",
    2: "DEGREE",
    3: "PARAMEDICAL",
    8: "NURSING"
}

dept_counts = {}
user_dept_mapping = []

for u in all_users:
    empNo = u.get("employeeNo", "").strip()
    name = u.get("name", "").strip()
    gId = u.get("groupId")
    dept = GROUP_MAP.get(gId, "General Faculty")
    
    dept_counts[dept] = dept_counts.get(dept, 0) + 1
    user_dept_mapping.append({
        "empNo": empNo,
        "name": name,
        "groupId": gId,
        "department": dept
    })

print("=== Department Counts from Hikvision Group Mapping ===")
print(json.dumps(dept_counts, indent=2))

# Save mapping to JSON so Node import / sync can use it or API endpoint can apply it
with open("hik_user_dept_map.json", "w") as f:
    json.dump(user_dept_mapping, f, indent=2)

print("Saved hik_user_dept_map.json successfully!")
