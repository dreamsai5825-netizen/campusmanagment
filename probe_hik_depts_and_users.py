import requests
from requests.auth import HTTPDigestAuth
import json

ip = "192.168.1.250"
auth = HTTPDigestAuth("admin", "AGI@2026@")

# Let's test various GET & POST ISAPI endpoints for Department/Organization & User Department assignment
urls = [
    ("Organization GET", f"http://{ip}/ISAPI/AccessControl/Organization?format=json", "GET", None),
    ("Organization List GET", f"http://{ip}/ISAPI/AccessControl/Organization/List?format=json", "GET", None),
    ("Department GET", f"http://{ip}/ISAPI/AccessControl/Department?format=json", "GET", None),
    ("UserInfo Search", f"http://{ip}/ISAPI/AccessControl/UserInfo/Search?format=json", "POST", {"UserInfoSearchCond": {"searchID": "dept_check", "searchResultPosition": 0, "maxResults": 10}}),
]

for name, url, method, payload in urls:
    try:
        if method == "POST":
            r = requests.post(url, json=payload, auth=auth, timeout=5)
        else:
            r = requests.get(url, auth=auth, timeout=5)
        print(f"=== {name} ({r.status_code}) ===")
        print(r.text[:600])
    except Exception as e:
        print(f"Error {name}: {e}")
    print("\n" + "="*50 + "\n")
