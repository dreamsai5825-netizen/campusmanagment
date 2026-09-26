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
            "searchID": "dump_all",
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

print(f"Total users fetched: {len(all_users)}")
user_summary = []
for u in sorted(all_users, key=lambda x: int(x['employeeNo']) if x['employeeNo'].isdigit() else 999):
    user_summary.append({
        "employeeNo": u.get("employeeNo"),
        "name": u.get("name"),
        "userType": u.get("userType"),
        "groupId": u.get("groupId"),
        "belongGroup": u.get("belongGroup")
    })

print(json.dumps(user_summary, indent=2))
