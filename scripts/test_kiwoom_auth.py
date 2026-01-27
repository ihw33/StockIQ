
import requests
import json
import os
import datetime

# Hardcoded keys for immediate testing (safety verified in local env)
# In production, we load from .env, but for this diagnostics script, we read the file manually
ENV_PATH = "/Users/m4_macbook/Projects/Stockiq/services/ai-engine/.env"

def load_env_keys():
    keys = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#') and '=' in line:
                    key, value = line.strip().split('=', 1)
                    keys[key] = value
    return keys

def test_kiwoom_auth():
    keys = load_env_keys()
    app_key = keys.get("KIWOOM_APP_KEY")
    secret_key = keys.get("KIWOOM_SECRET_KEY")
    
    if not app_key or not secret_key:
        print("❌ Could not find keys in .env")
        return

    url = "https://api.kiwoom.com/oauth2/token"
    headers = {
        "content-type": "application/json;charset=UTF-8",
        "api-id": "au10001"
    }
    data = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "secretkey": secret_key
    }

    print(f"🚀 Sending Request to {url}...")
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            res_json = response.json()
            token = res_json.get('token', '')
            print("✅ Authentication Successful!")
            print(f"Token: {token[:10]}...")
            
            # Now test ka10003 (Quote)
            quote_url = "https://api.kiwoom.com/api/dostk/stkinfo"
            quote_headers = {
                "content-type": "application/json;charset=UTF-8",
                "api-id": "ka10003",
                "Authorization": f"Bearer {token}"
            }
            quote_data = {
                "stk_cd": "005930" # Samsung Electronics
            }
            
            print(f"🚀 Requesting Quote (ka10003) for 005930...")
            q_res = requests.post(quote_url, headers=quote_headers, json=quote_data, timeout=10)
            print(f"Quote Status: {q_res.status_code}")
            if q_res.status_code == 200:
                q_json = q_res.json()
                # print(json.dumps(q_json, indent=2, ensure_ascii=False)) # Verbose
                
                items = q_json.get('cntr_infr', [])
                if items:
                    latest = items[0]
                    print(f"💰 Price: {latest.get('cur_prc')} (Change: {latest.get('pre_rt')}%)")
                    print(f"🕒 Time: {latest.get('tm')}")
                else:
                    print("⚠️ No trade info returned")
            else:
                print("❌ Quote Failed")
                print(q_res.text)

        else:
            print("❌ Authentication Failed")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error during request: {e}")

if __name__ == "__main__":
    test_kiwoom_auth()
