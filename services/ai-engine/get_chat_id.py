import requests
import json
import os

token = "7896879460:AAF-6X4lnckEhpBqjzeKtAsXhTFwY9k6KGc"
url = f"https://api.telegram.org/bot{token}/getUpdates"

print(f"Checking updates for bot...")
try:
    response = requests.get(url)
    data = response.json()
    print(json.dumps(data, indent=4, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
