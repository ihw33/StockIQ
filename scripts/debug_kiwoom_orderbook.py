import os
import requests
import json
from dotenv import load_dotenv

# Load Config
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env.local'))

APP_KEY = os.getenv('KIWOOM_APP_KEY')
APP_SECRET = os.getenv('KIWOOM_SECRET_KEY')
BASE_URL = "https://api.kiwoom.com"

if not APP_KEY:
    print("Error: KIWOOM_APP_KEY not found in .env.local")
    exit(1)

# 1. Get Token
print("Getting Access Token...")
headers = {
    "content-type": "application/json;charset=UTF-8",
    "api-id": "au10001"
}
data = {
    "grant_type": "client_credentials",
    "appkey": APP_KEY,
    "secretkey": APP_SECRET
}
res = requests.post(f"{BASE_URL}/oauth2/token", headers=headers, json=data)
if res.status_code != 200:
    print(f"Auth Failed: {res.text}")
    exit(1)

TOKEN = res.json()['token']
print("Token Received!")

# 2. Test Order Book (ka10004)
print("\n--- Testing Order Book (ka10004) ---")
url = f"{BASE_URL}/api/dostk/mrkcond"
headers = {
    "content-type": "application/json;charset=UTF-8",
    "api-id": "ka10004",
    "Authorization": f"Bearer {TOKEN}"
}
req_body = {
    "stk_cd": "005930" # Samsung Electronics
}

print(f"Request Body: {json.dumps(req_body)}")

res = requests.post(url, headers=headers, json=req_body)

if res.status_code == 200:
    data = res.json()
    print(f"Response Keys: {list(data.keys())}")
    
    # Print first few keys/values to identify structure
    # Check if 'output' or root
    if 'output' in data:
        print("Data is in 'output' field.")
        print(json.dumps(data['output'], indent=2, ensure_ascii=False)[:1000])
    else:
        print("Data is in Root.")
        print(json.dumps(data, indent=2, ensure_ascii=False)[:3000])
else:
    print(f"❌ HTTP Error: {res.status_code} {res.text}")
