import os
import requests
import pandas as pd
import logging
from datetime import datetime
from dotenv import load_dotenv

# Configure Logging
logger = logging.getLogger(__name__)

# Environment variables are loaded by main.py at FastAPI startup
# Standalone tests should explicitly load .env.local before importing this module
# load_dotenv(os.path.join(os.path.dirname(__file__), '../../../.env.local'))

class KiwoomCollector:
    def __init__(self):
        self.base_url = os.getenv("KIWOOM_BASE_URL", "https://openapi.kiwoom.com")
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
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Failed to get Kiwoom Token: {e} - Body: {e.response.text}")
            else:
                logger.error(f"Failed to get Kiwoom Token: {e}")
            return None

    def get_price_history(self, symbol: str, interval: str = "D", count: int = 60, adjusted: bool = True):
        token = self._get_token()
        if not token:
            logger.error("Checking Token Failed")
            return pd.DataFrame()

        # Determine Params
        # Daily: ka10081, Minute: ka10080
        api_id = "ka10081"
        req_body = {
            "stk_cd": symbol,
            "upd_stkpc_tp": "1" if adjusted else "0"
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
            print(f"[KiwoomCollector] Fetching {symbol} {interval} from Kiwoom API ({api_id})")
            print(f"[KiwoomCollector] Request body: {req_body}")
            res = requests.post(url, headers=headers, json=req_body, timeout=5)
            res.raise_for_status()
            data = res.json()
            
            # --- Dynamic List Finding ---
            items = []
            possible_keys = [
                "stk_day_pole_chart_qry",
                "stk_week_pole_chart_qry",
                "stk_stk_pole_chart_qry",
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

            if not items:
                logger.warning(f"No data items found for {symbol} {interval}. Response keys: {list(data.keys())}")
                print(f"[KiwoomCollector] ⚠️ Empty response for {symbol}. Response: {data}")
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
            logger.error(f"Kiwoom API Request Error for {symbol} {interval}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}, Body: {e.response.text[:500]}")
            print(f"[KiwoomCollector] ❌ Failed to fetch {symbol} {interval}: {str(e)[:200]}")
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
    
    def get_company_info(self, symbol: str):
        """
        Get company fundamental information (PER, PBR, ROE, EPS)
        Returns: {
            'per': float,  # 주가수익비율
            'pbr': float,  # 주가순자산비율  
            'roe': float,  # 자기자본이익률
            'eps': float,  # 주당순이익
            'bps': float,  # 주당순자산
            'market_cap': int,  # 시가총액 (억)
        }
        """
        token = self._get_token()
        if not token: return None
        
        url = f"{self.base_url}/api/dostk/stkinfo"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10001",
            "Authorization": f"Bearer {token}"
        }
        
        try:
            res = requests.post(url, headers=headers, json={"stk_cd": symbol}, timeout=5)
            res.raise_for_status()
            result = res.json()
            
            def safe_float(v):
                try: return float(v) if v else None
                except: return None

            def safe_int(v):
                try: return int(str(v).replace(',', '')) if v else None
                except: return None

            return {
                'per': safe_float(result.get('per')),
                'pbr': safe_float(result.get('pbr')),
                'roe': safe_float(result.get('roe')),
                'eps': safe_float(result.get('eps')),
                'bps': safe_float(result.get('bps')),
                'ev': safe_float(result.get('ev')),
                'market_cap': safe_int(result.get('mac')),
                'stk_nm': result.get('stk_nm', ''),
                'settle_month': result.get('setl_mm', ''),
                'face_value': safe_int(result.get('fav')),
                'capital': safe_int(result.get('cap')),
                'listed_shares': safe_int(result.get('flo_stk')),
                'credit_ratio': safe_float(result.get('crd_rt')),
                'year_high': safe_int(result.get('oyr_hgst')),
                'year_low': safe_int(result.get('oyr_lwst')),
                'high_250': safe_int(result.get('250hgst')),
                'low_250': safe_int(result.get('250lwst')),
                'foreign_ratio': safe_float(result.get('for_exh_rt')),
                'sales': safe_int(result.get('sale_amt')),
                'operating_profit': safe_int(result.get('bus_pro')),
                'net_income': safe_int(result.get('cup_nga')),
                'dividend_rate': safe_float(result.get('dstr_rt')),
                'cur_price': safe_int(result.get('cur_prc')),
                'volume': safe_int(result.get('trde_qty')),
                'trade_amount': safe_int(result.get('trde_pre')),
            }
        except Exception as e:
            logger.error(f"Error fetching company info for {symbol}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None

    def get_after_hours(self, symbol: str):
        """
        ka10087: 시간외 단일가 요청
        Returns after-hours trading data (price, volume, change)
        """
        token = self._get_token()
        if not token: return None

        url = f"{self.base_url}/api/dostk/mrkcond"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10087",
            "Authorization": f"Bearer {token}"
        }

        try:
            res = requests.post(url, headers=headers, json={"stk_cd": symbol}, timeout=5)
            res.raise_for_status()
            result = res.json()

            # Debug: log full response to identify field names
            print(f"[AfterHours] ka10087 response keys: {list(result.keys())}")
            # Print first few values for debugging
            for k, v in list(result.items())[:20]:
                if v and str(v).strip():
                    print(f"  {k}: {v}")

            def safe_int(v):
                try: return int(str(v).replace(',', '').replace('+', '')) if v and str(v).strip() else None
                except: return None

            def safe_float(v):
                try: return float(str(v).replace('+', '')) if v and str(v).strip() else None
                except: return None

            # Field names use 'ovt_sigpric_' prefix for after-hours single price
            cur_price = safe_int(result.get('ovt_sigpric_cur_prc'))
            change = safe_int(result.get('ovt_sigpric_pred_pre'))
            change_sign = result.get('ovt_sigpric_pred_pre_sig', '')
            if change and change_sign == '-':
                change = -change
            change_rate = safe_float(result.get('ovt_sigpric_flu_rt'))
            volume = safe_int(result.get('ovt_sigpric_acc_trde_qty'))

            # Ask/Bid (5 levels)
            ask1 = safe_int(result.get('ovt_sigpric_sel_bid_1'))
            bid1 = safe_int(result.get('ovt_sigpric_buy_bid_1'))

            return {
                'cur_price': cur_price,
                'change': change,
                'change_rate': change_rate,
                'volume': volume,
                'ask_price': ask1,
                'bid_price': bid1,
            }
        except Exception as e:
            logger.error(f"After-hours data error for {symbol}: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_next_market_price(self, symbol: str):
        """
        넥스트(NEXT/Nextrade) 시장 가격 조회.
        종목코드에 _NX(NEXT 전용), _AL(통합) 접미사를 붙여서
        ka10001(종목정보) API로 조회 시도.
        """
        token = self._get_token()
        if not token: return None

        url = f"{self.base_url}/api/dostk/stkinfo"

        def safe_int(v):
            try: return int(str(v).replace(',', '').replace('+', '')) if v and str(v).strip() else None
            except: return None

        def safe_float(v):
            try: return float(str(v).replace('+', '')) if v and str(v).strip() else None
            except: return None

        # Try _AL (integrated KRX+NXT) first, then _NX (NEXT only)
        for suffix in ['_AL', '_NX']:
            try:
                code = f"{symbol}{suffix}"
                headers = {
                    "content-type": "application/json;charset=UTF-8",
                    "api-id": "ka10001",
                    "Authorization": f"Bearer {token}"
                }
                print(f"[NEXT] Trying ka10001 with stk_cd={code}")
                res = requests.post(url, headers=headers, json={"stk_cd": code}, timeout=5)

                if res.status_code != 200:
                    print(f"[NEXT] {code} → HTTP {res.status_code}")
                    continue

                result = res.json()

                # Log response for debugging
                non_empty = {k: v for k, v in result.items() if v and str(v).strip()}
                print(f"[NEXT] {code} → {len(non_empty)} non-empty fields")
                for k, v in list(non_empty.items())[:15]:
                    print(f"  {k}: {v}")

                cur_price = safe_int(result.get('cur_prc'))
                if not cur_price:
                    print(f"[NEXT] {code} → no cur_prc, skipping")
                    continue

                # Get change info
                change = safe_int(result.get('pred_pre'))
                change_sign = result.get('pred_pre_sig', '')
                if change and change_sign == '-':
                    change = -change
                change_rate = safe_float(result.get('flu_rt'))
                volume = safe_int(result.get('trde_qty'))

                return {
                    'source': f'NEXT({suffix})',
                    'cur_price': cur_price,
                    'change': change,
                    'change_rate': change_rate,
                    'volume': volume,
                }
            except Exception as e:
                print(f"[NEXT] {symbol}{suffix} error: {e}")
                continue

        return None

    def get_investor_trends(self, symbol: str):
        """
        ka10059: 종목별투자자기관별요청
        Returns net buy/sell volume by investor type (foreign, institutional, individual)
        """
        token = self._get_token()
        if not token: return None

        url = f"{self.base_url}/api/dostk/stkinfo"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10059",
            "Authorization": f"Bearer {token}"
        }
        today = datetime.now().strftime("%Y%m%d")

        try:
            res = requests.post(url, headers=headers, json={
                "stk_cd": symbol,
                "dt": today,
                "amt_qty_tp": "1",  # 1=수량, 2=금액
                "trde_tp": "0",     # 0=순매수
                "unit_tp": "0",     # 0=주
            }, timeout=5)
            res.raise_for_status()
            result = res.json()

            # Debug: log full response
            print(f"[InvestorTrends] ka10059 response keys: {list(result.keys())}")
            for k, v in result.items():
                if isinstance(v, list):
                    print(f"  {k}: list[{len(v)}]")
                    if v:
                        print(f"    sample keys: {list(v[0].keys())[:15]}")
                        print(f"    sample: {v[0]}")
                elif v and str(v).strip():
                    print(f"  {k}: {v}")

            def safe_int(v):
                try:
                    s = str(v).replace(',', '').replace('+', '').strip()
                    return int(s) if s else None
                except:
                    return None

            # Data is in list (e.g. stk_invsr_orgn), first item = most recent
            row = None
            for k, v in result.items():
                if isinstance(v, list) and len(v) > 0:
                    row = v[0]
                    break
            if not row:
                row = result

            # Parse investor data
            foreign = safe_int(row.get('frgnr_invsr')) or 0   # 외국인
            finance = safe_int(row.get('fnnc_invt')) or 0      # 금융투자
            insurance = safe_int(row.get('insrnc')) or 0        # 보험
            invest_trust = safe_int(row.get('invtrt')) or 0     # 투신
            etc_finance = safe_int(row.get('etc_fnnc')) or 0    # 기타금융
            bank = safe_int(row.get('bank')) or 0               # 은행
            pension = safe_int(row.get('penfnd_etc')) or 0      # 연기금
            private_fund = safe_int(row.get('samo_fund')) or 0  # 사모펀드
            etc_corp = safe_int(row.get('etc_corp')) or 0       # 기타법인
            nation = safe_int(row.get('natn')) or 0             # 국가/지자체

            # 기관합계 = 소분류 합산 (orgn 필드가 장중 0으로 오는 경우 대비)
            institution = finance + insurance + invest_trust + etc_finance + bank + pension + private_fund

            # 개인 = 잔여분 (ind_invsr 필드가 장중 0으로 오는 경우 대비)
            ind_raw = safe_int(row.get('ind_invsr')) or 0
            individual = ind_raw if ind_raw != 0 else -(foreign + institution + etc_corp + nation)

            return {
                'date': row.get('dt'),
                'foreign': foreign,
                'institution': institution,
                'individual': individual,
                'finance': finance,
                'insurance': insurance,
                'pension': pension,
                'private_fund': private_fund,
                'etc_corp': etc_corp,
            }
        except Exception as e:
            logger.error(f"Investor trends error for {symbol}: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_market_investor_trends(self):
        """
        ka10066: KOSPI 전체 시장 투자자별 매매동향 (외국인/기관/개인)
        """
        token = self._get_token()
        if not token: return None

        today = datetime.now().strftime("%Y%m%d")
        url = f"{self.base_url}/api/dostk/mrkcond"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10066",
            "Authorization": f"Bearer {token}"
        }
        body = {
            "stk_cd": "001",       # KOSPI 전체
            "strtt_dt": today,
            "end_dt": today,
            "amt_qty_tp": "1",     # 수량
            "trde_tp": "0",        # 순매수
            "stex_tp": "1"         # 거래소
        }
        try:
            print(f"[MarketInvestorTrends] Calling ka10066 with body: {body}")
            res = requests.post(url, headers=headers, json=body, timeout=10)
            res.raise_for_status()
            data = res.json()
            print(f"[MarketInvestorTrends] Response keys: {list(data.keys())}")

            items = data.get("opaf_invsr_trde", [])
            if not items:
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0:
                        items = v
                        print(f"[MarketInvestorTrends] Found list in key '{k}', len={len(v)}")
                        break

            if not items:
                print(f"[MarketInvestorTrends] No data items found. Full response: {data}")
                return None

            row = items[0]
            print(f"[MarketInvestorTrends] keys: {list(row.keys())}")
            print(f"[MarketInvestorTrends] sample: {row}")

            def safe_int(v):
                try:
                    s = str(v).replace(',', '').replace('+', '').strip()
                    return int(s) if s else 0
                except:
                    return 0

            foreign = safe_int(row.get('frgnr_invsr'))
            finance = safe_int(row.get('fnnc_invt'))
            insurance = safe_int(row.get('insrnc'))
            invest_trust = safe_int(row.get('invtrt'))
            etc_finance = safe_int(row.get('etc_fnnc'))
            bank = safe_int(row.get('bank'))
            pension = safe_int(row.get('penfnd_etc'))
            private_fund = safe_int(row.get('samo_fund'))
            etc_corp = safe_int(row.get('etc_corp'))
            individual = safe_int(row.get('ind_invsr'))

            institution = finance + insurance + invest_trust + etc_finance + bank + pension + private_fund
            if individual == 0 and (foreign != 0 or institution != 0):
                individual = -(foreign + institution + etc_corp)

            return {
                'date': row.get('dt', today),
                'foreign': foreign,
                'institution': institution,
                'individual': individual,
            }
        except Exception as e:
            logger.error(f"Market investor trends error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_investor_trends_history(self, symbol: str, days: int = 60):
        """
        ka10059: 최근 N일 투자자별 매매동향 반환 (기관=소분류합산, 개인=잔여분)
        amt_qty_tp=1: 수량(주) — HTS 0796 동일
        """
        token = self._get_token()
        if not token: return None

        url = f"{self.base_url}/api/dostk/stkinfo"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10059",
            "Authorization": f"Bearer {token}"
        }
        today = datetime.now().strftime("%Y%m%d")

        try:
            res = requests.post(url, headers=headers, json={
                "stk_cd": symbol,
                "dt": today,
                "amt_qty_tp": "1",  # 수량(주) — HTS 0796 동일
                "trde_tp": "0",     # 순매수
                "unit_tp": "0",
            }, timeout=10)
            res.raise_for_status()
            result = res.json()

            def safe_int(v):
                try:
                    s = str(v).replace(',', '').replace('+', '').strip()
                    return int(s) if s else 0
                except:
                    return 0

            rows = []
            for k, v in result.items():
                if isinstance(v, list) and len(v) > 0:
                    rows = v[:days]
                    break

            history = []
            for row in rows:
                foreign = safe_int(row.get('frgnr_invsr'))
                finance = safe_int(row.get('fnnc_invt'))
                insurance = safe_int(row.get('insrnc'))
                invest_trust = safe_int(row.get('invtrt'))
                etc_finance = safe_int(row.get('etc_fnnc'))
                bank = safe_int(row.get('bank'))
                pension = safe_int(row.get('penfnd_etc'))
                private_fund = safe_int(row.get('samo_fund'))
                etc_corp = safe_int(row.get('etc_corp'))
                nation = safe_int(row.get('natn'))

                institution = finance + insurance + invest_trust + etc_finance + bank + pension + private_fund
                ind_raw = safe_int(row.get('ind_invsr'))
                individual = ind_raw if ind_raw != 0 else -(foreign + institution + etc_corp + nation)

                # 가격/거래량도 ka10059에서 직접 가져옴 (ka10081 별도 호출 불필요)
                close_raw = str(row.get('cur_prc', '0')).replace('+', '').replace('-', '').strip()
                change_raw = str(row.get('pred_pre', '0')).replace('+', '').strip()
                volume_raw = str(row.get('acc_trde_qty', '0')).replace('+', '').strip()

                history.append({
                    'date': row.get('dt'),
                    'close': safe_int(close_raw),
                    'change': safe_int(change_raw),
                    'volume': safe_int(volume_raw),
                    'foreign': foreign,
                    'institution': institution,
                    'individual': individual,
                })
            return history
        except Exception as e:
            logger.error(f"Investor trends history error for {symbol}: {e}")
            return None

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
