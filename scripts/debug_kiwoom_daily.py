import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

# Load Config
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env.local'))

APP_KEY = os.getenv('KIWOOM_APP_KEY')
APP_SECRET = os.getenv('KIWOOM_SECRET_KEY')
BASE_URL = "https://api.kiwoom.com"

# 1. Get Token
headers = { "content-type": "application/json;charset=UTF-8", "api-id": "au10001" }
data = { "grant_type": "client_credentials", "appkey": APP_KEY, "secretkey": APP_SECRET }
res = requests.post(f"{BASE_URL}/oauth2/token", headers=headers, json=data)
TOKEN = res.json()['token']

# 2. Test Daily (ka10081)
print("\n--- Testing Daily (ka10081) ---")
url = f"{BASE_URL}/api/dostk/chart"
headers = { "content-type": "application/json;charset=UTF-8", "api-id": "ka10081", "Authorization": f"Bearer {TOKEN}" }
req_body = {
    "stk_cd": "005930",
    "upd_stkpc_tp": "1",
    "base_dt": datetime.now().strftime("%Y%m%d")
}

print(f"Request Body: {json.dumps(req_body)}")
res = requests.post(url, headers=headers, json=req_body)

if res.status_code == 200:
    data = res.json()
    print(f"Response Keys: {list(data.keys())}")
    
    # Check for specific keys
    if 'stk_day_pole_chart_qry' in data:
         print("✅ Found 'stk_day_pole_chart_qry'")
         items = data['stk_day_pole_chart_qry']
         if len(items) > 0:
             print(f"First Item: {items[0]}")
         else:
             print("List is empty.")
    elif 'stk_dt_pole_chart_qry' in data:
         print("✅ Found 'stk_dt_pole_chart_qry'")
    else:
         print("❌ Neither key found. Dumping keys again.")
         print(list(data.keys()))
else:
    print(f"Error: {res.text}")
