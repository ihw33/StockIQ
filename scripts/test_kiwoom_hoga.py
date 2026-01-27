
import requests
import json
import os

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

def test_hoga():
    keys = load_env_keys()
    app_key = keys.get("KIWOOM_APP_KEY")
    secret_key = keys.get("KIWOOM_SECRET_KEY")
    
    if not app_key:
        print("❌ Missing Keys")
        return

    # 1. Auth
    url = "https://api.kiwoom.com/oauth2/token"
    headers = { "content-type": "application/json;charset=UTF-8", "api-id": "au10001" }
    data = { "grant_type": "client_credentials", "appkey": app_key, "secretkey": secret_key }
    
    res = requests.post(url, headers=headers, json=data)
    if res.status_code != 200:
        print("Auth Failed")
        return
        
    token = res.json()['token']
    print("✅ Auth OK")

    # 2. Hoga (ka10004)
    hoga_url = "https://api.kiwoom.com/api/dostk/mrkcond"
    hoga_headers = {
        "content-type": "application/json;charset=UTF-8",
        "api-id": "ka10004",
        "Authorization": f"Bearer {token}"
    }
    hoga_data = { "stk_cd": "005930" } # Samsung Ele
    
    print("🚀 Requesting OrderBook (ka10004)...")
    h_res = requests.post(hoga_url, headers=hoga_headers, json=hoga_data)
    
    if h_res.status_code == 200:
        h_json = h_res.json()
        print("✅ Hoga Received!")
        print(json.dumps(h_json, indent=2, ensure_ascii=False)[:3000]) # Print first 3000 chars
        
    else:
        print(f"❌ Hoga Failed: {h_res.text}")

if __name__ == "__main__":
    test_hoga()
