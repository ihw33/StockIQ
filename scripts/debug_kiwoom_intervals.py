
import os
import requests
import json
import yaml
from datetime import datetime

# Load Config (Simulating)
# You should ensure .env.local or similar has keys, but for script we might need manual input or read file.
# Let's read .env.local manually
env_path = os.path.join(os.path.dirname(__file__), '../.env.local')
config = {}
print(f"Reading config from {env_path}")
try:
    with open(env_path, 'r') as f:
        for line in f:
            if '=' in line:
                k, v = line.strip().split('=', 1)
                config[k] = v.strip('"')
except Exception as e:
    print(f"Error reading .env.local: {e}")
    # Fallback to hardcoded for testing if needed or fail
    exit(1)

APP_KEY = config.get('KIWOOM_APP_KEY')
APP_SECRET = config.get('KIWOOM_SECRET_KEY')
BASE_URL = "https://api.kiwoom.com"

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
    print(f"Key used: {APP_KEY}")
    exit(1)

TOKEN = res.json()['token']
print("Token Received!")

# 2. Test Function
def test_chart(name, api_id, list_key, interval_type, tic_scope=None):
    print(f"\n--- Testing {name} ({api_id}) ---")
    
    today = datetime.now().strftime("%Y%m%d")
    chart_url = f"{BASE_URL}/api/dostk/chart"
    chart_headers = {
        "content-type": "application/json;charset=UTF-8",
        "api-id": api_id,
        "Authorization": f"Bearer {TOKEN}"
    }
    
    req_body = {
        "stk_cd": "005930",
        "upd_stkpc_tp": "1"
    }
    
    if interval_type == 'D':
        req_body["base_dt"] = today
    elif interval_type == 'W': # Weekly
        req_body["base_dt"] = today
    elif interval_type == 'M': # Monthly
        req_body["base_dt"] = today
    elif interval_type == 'Y': # Yearly
        req_body["base_dt"] = today
    elif interval_type == 'Min': # Minute
        req_body["tic_scope"] = tic_scope
    
    # Tick Chart Special?
    if api_id == 'ka10079':
        # Tick might assume 'tic_scope' too.
        if tic_scope:
             req_body["tic_scope"] = tic_scope
        else:
             req_body["tic_scope"] = "1"
    
    print(f"Request Body: {json.dumps(req_body)}")
    
    c_res = requests.post(chart_url, headers=chart_headers, json=req_body)
    
    if c_res.status_code == 200:
        c_json = c_res.json()
        print(f"Response Keys: {list(c_json.keys())}")
        
        items = c_json.get(list_key)
        if items:
            print(f"✅ Success! Got {len(items)} items.")
            print(f"First Item: {items[0]}")
        else:
            print(f"❌ Failed to find key '{list_key}' or empty.")
            # Print full response if failed
            print(json.dumps(c_json, indent=2, ensure_ascii=False)[:3000])
    else:
        print(f"❌ HTTP Error: {c_res.status_code} {c_res.text}")

# 3. Run Tests
# Weekly
test_chart("Weekly", "ka10082", "stk_week_pole_chart_qry", "W")

# Monthly
test_chart("Monthly", "ka10083", "stk_mont_pole_chart_qry", "M")

# Yearly
test_chart("Yearly", "ka10084", "stk_year_pole_chart_qry", "Y")

# 3-Minute
test_chart("3-Minute", "ka10080", "stk_min_pole_chart_qry", "Min", "3")

# Tick
test_chart("Tick", "ka10079", "stk_tick_pole_chart_qry", "Min", "1")
