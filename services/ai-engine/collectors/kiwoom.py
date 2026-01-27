import os
import requests
import pandas as pd
import logging
from datetime import datetime
from dotenv import load_dotenv

# Configure Logging
logger = logging.getLogger(__name__)

# Load env variables from .env.local (assuming relative path from services/ai-engine)
# services/ai-engine/collectors/kiwoom.py -> ../../../.env.local
load_dotenv(os.path.join(os.path.dirname(__file__), '../../../.env.local'))

class KiwoomCollector:
    def __init__(self):
        self.base_url = "https://api.kiwoom.com"
        self.app_key = os.getenv("KIWOOM_APP_KEY")
        self.app_secret = os.getenv("KIWOOM_SECRET_KEY")
        self.token = None
        
        if not self.app_key or not self.app_secret:
            logger.error("Kiwoom API Keys not found in environment variables!")

    def _get_token(self):
        if self.token: return self.token
        
        url = f"{self.base_url}/oauth2/token"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "au10001"
        }
        data = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "secretkey": self.app_secret
        }
        try:
            res = requests.post(url, headers=headers, json=data, timeout=5)
            res.raise_for_status()
            self.token = res.json().get('token')
            return self.token
        except Exception as e:
            logger.error(f"Failed to get Kiwoom Token: {e}")
            return None

    def get_price_history(self, symbol: str, interval: str = "D", count: int = 60):
        token = self._get_token()
        if not token: 
            logger.error("Checking Token Failed")
            return pd.DataFrame()

        # Determine Params
        # Daily: ka10081, Minute: ka10080
        api_id = "ka10081"
        req_body = {
            "stk_cd": symbol,
            "upd_stkpc_tp": "1"
        }
        today = datetime.now().strftime("%Y%m%d")

        if interval == "D":
            api_id = "ka10081"
            req_body["base_dt"] = today
        elif interval.endswith("m"): # 5m, 15m -> ka10080
            api_id = "ka10080"
            tick = interval.replace("m", "")
            req_body["tic_scope"] = tick
        elif interval == "W":
            api_id = "ka10082"
            req_body["base_dt"] = today
        
        url = f"{self.base_url}/api/dostk/chart"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": api_id,
            "Authorization": f"Bearer {token}"
        }

        try:
            # print(f"[DEBUG] Fetching {symbol} {interval} from Kiwoom Cloud API ({api_id})")
            res = requests.post(url, headers=headers, json=req_body, timeout=10)
            res.raise_for_status()
            data = res.json()
            
            # --- Dynamic List Finding ---
            items = []
            possible_keys = [
                "stk_day_pole_chart_qry", 
                "stk_week_pole_chart_qry", 
                "stk_mth_pole_chart_qry", 
                "stk_min_pole_chart_qry",
                "stk_tic_pole_chart_qry"
            ]
            
            for key in possible_keys:
                if key in data and isinstance(data[key], list):
                    items = data[key]
                    break
            
            if not items:
                # Fallback scan
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0:
                        sample = v[0]
                        if any(x in sample for x in ['dt', 'date', 'cur_prc', 'close', 'open_pric']):
                            items = v
                            break

            # print(f"[DEBUG] Found {len(items)} items")

            if not items:
                logger.warning(f"No data for {symbol}. Resp: {str(data.keys())}")
                return pd.DataFrame()

            # DataFrame & Mapping
            df = pd.DataFrame(items)
            column_map = {
                '일자': 'date', 'dt': 'date',
                '시가': 'open', 'open_pric': 'open',
                '고가': 'high', 'high_pric': 'high',
                '저가': 'low', 'low_pric': 'low',
                '종가': 'close', 'cur_prc': 'close',
                '거래량': 'volume', 'trde_qty': 'volume',
                '체결시간': 'time', 'cntr_tm': 'time'
            }
            df = df.rename(columns=column_map)
            
            for col in ['open', 'high', 'low', 'close', 'volume']:
                if col in df.columns:
                    # Kiwoom returns signed strings (e.g., -245000) for drops. We need absolute values.
                    df[col] = pd.to_numeric(df[col], errors='coerce').abs()
            
            if 'date' in df.columns: df = df.sort_values('date')
            elif 'time' in df.columns: df = df.sort_values('time')

            return df.tail(count)

        except Exception as e:
            logger.error(f"Kiwoom Request Error: {e}")
            return pd.DataFrame()

    def get_master_name(self, symbol: str):
        """fn_ka10001: Get Stock Name"""
        token = self._get_token()
        if not token: return ""
        
        url = f"{self.base_url}/api/dostk/stkinfo"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10001",
            "Authorization": f"Bearer {token}"
        }
        try:
            res = requests.post(url, headers=headers, json={"stk_cd": symbol}, timeout=5)
            res.raise_for_status()
            return res.json().get('stk_nm', '')
        except Exception as e:
            logger.error(f"Failed to get name for {symbol}: {e}")
            return ""

    def get_balance(self, account_no: str):
        """fn_kt00001: Get Deposit (Jesus)"""
        token = self._get_token()
        if not token: return 0
        
        url = f"{self.base_url}/api/dostk/acnt"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "kt00001",
            "Authorization": f"Bearer {token}"
        }
        params = {
            "acc_no": account_no,
            "qry_tp": "3" # Deposit
        }
        try:
            res = requests.post(url, headers=headers, json=params, timeout=5)
            res.raise_for_status()
            # User script uses 'entr', but previously we saw 'ord_alow_amt'. 
            # User script: entry = response.json()['entr']
            # Let's try 'ord_alow_amt' (Order Allowable) as it's safer for trading.
            data = res.json()
            val = data.get('ord_alow_amt') or data.get('entr') or '0'
            return int(val)
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return 0

    def get_holdings(self, account_no: str):
        """fn_kt00004: Get Holdings"""
        token = self._get_token()
        if not token: return []
        
        url = f"{self.base_url}/api/dostk/acnt"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "kt00004",
            "Authorization": f"Bearer {token}"
        }
        params = {
            "acc_no": account_no,
            "qry_tp": "0",
            "dmst_stex_tp": "KRX"
        }
        try:
            res = requests.post(url, headers=headers, json=params, timeout=5)
            res.raise_for_status()
            return res.json().get('stk_acnt_evlt_prst', [])
        except Exception as e:
            logger.error(f"Failed to get holdings: {e}")
            return []

    def get_hoga(self, symbol: str):
        """fn_ka10004: Get Sell Ask Price (Best Ask)"""
        token = self._get_token()
        if not token: return 0
        
        url = f"{self.base_url}/api/dostk/mrkcond"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10004",
            "Authorization": f"Bearer {token}"
        }
        try:
            res = requests.post(url, headers=headers, json={"stk_cd": symbol}, timeout=5)
            res.raise_for_status()
            # sel_fpr_bid = Sell First Price Bid (Best Ask)
            val = res.json().get('sel_fpr_bid', '0')
            return abs(float(val))
        except Exception as e:
            logger.error(f"Failed to get hoga for {symbol}: {e}")
            return 0

    def place_order(self, account_no: str, symbol: str, qty: int, price: int, type: str = 'buy'):
        """fn_kt10000 (Buy) / fn_kt10001 (Sell)"""
        token = self._get_token()
        if not token: return False
        
        url = f"{self.base_url}/api/dostk/ordr"
        # Buy: kt10000, Sell: kt10001
        api_id = "kt10000" if type == 'buy' else "kt10001"
        # Trade Type: 00(Limit), 03(Market)
        # User script used '0' (Limit?) for Buy and '3' (Market) for Sell.
        # Let's standardize: If price is 0, Market (03), else Limit (00).
        # Actually user script `buy_stock` had `trde_tp`: '0' (Limit) and passed `ord_uv`.
        
        trade_type = "00" # Limit
        if price == 0: trade_type = "03" # Market
        
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": api_id,
            "Authorization": f"Bearer {token}"
        }
        params = {
            "acc_no": account_no,
            "dmst_stex_tp": "KRX",
            "stk_cd": symbol,
            "ord_qty": str(qty),
            "ord_uv": str(price) if price > 0 else "0",
            "trde_tp": trade_type,
            "ord_gb": trade_type, # Some docs say ord_gb, user script says trde_tp. Keep both or follow user.
            # User script: 'trde_tp': '0'
            # Kiwoom REST specs vary. Let's include what user script had + standard.
            "ord_type": "1" if type == 'buy' else "2" # 1: New
        }
        
        try:
            res = requests.post(url, headers=headers, json=params, timeout=5)
            res.raise_for_status()
            ret_code = res.json().get('return_code')
            if ret_code == '0' or ret_code == 0:
                logger.info(f"Order Placed: {type.upper()} {symbol} {qty}ea")
                return True
            else:
                logger.error(f"Order Failed: {res.json().get('return_msg')}")
                return False
        except Exception as e:
            logger.error(f"Order Request Error: {e}")
            return False
