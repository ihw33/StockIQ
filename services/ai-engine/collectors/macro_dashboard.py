"""
MacroDashboardCollector: 6축 2-Tier 외국인 스탠스 분석
Tier A (선행 40%): DXY, US 10Y, VIX  — Yahoo Finance
Tier B (동행 60%): 외국인현물, 선물, 공매도 — Kiwoom REST API
"""
import os
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple, List
import pytz
import pandas as pd

KST = pytz.timezone('Asia/Seoul')
DAY_NAMES_KR = ['월', '화', '수', '목', '금', '토', '일']

logger = logging.getLogger(__name__)

# ============================================================
# Scoring Thresholds
# ============================================================
# These are initial values. The self-calibration system will
# adjust weights (not thresholds) based on prediction accuracy.

SCORE_LABELS = {
    -2: "매우 부정", -1: "부정", 0: "중립", 1: "긍정", 2: "매우 긍정"
}

SCORE_DETAILS = {
    "dxy": {
        -2: "달러지수 급등(+1.5%↑), 신흥국 자금 대규모 이탈 압력. EM 통화 약세 → 외국인 환헤지 비용 증가로 한국시장 이탈 가속",
        -1: "달러지수 상승(+0.5%↑), 신흥국 자금이탈 압력. 원/달러 환율 상승 시 외국인 차익실현 가능성",
        0: "달러지수 보합. 환율 변수 중립, 수급 외 다른 지표에 주목",
        1: "달러지수 하락(-0.5%↓), 신흥국 자금유입 기대. 원화 강세로 외국인 매수세 유입 환경",
        2: "달러지수 급락(-1.5%↓), 신흥국 자금 대규모 유입 기대. 외국인 적극 매수 전환 시그널"
    },
    "us10y": {
        -2: "미국 금리 급등(+10bp↑), 위험자산 회피 심화. 글로벌 자금이 미국채로 이동 중 → 한국 성장주 타격",
        -1: "미국 금리 상승(+3bp↑), 자금이탈 압력. 고PER 성장주 중심 하락 압력, 가치주/배당주 상대적 유리",
        0: "미국 금리 보합. 금리 변수 중립, 국내 수급에 집중",
        1: "미국 금리 하락(-3bp↓), 위험자산 선호. 성장주/기술주 매수 환경 조성",
        2: "미국 금리 급락(-10bp↓), 신흥국 자금유입 강화. 한국 IT·반도체 외국인 대규모 매수 기대"
    },
    "vix": {
        -2: "공포지수 30↑, 극단적 위험회피. 패닉셀 구간 — 역발상 저가매수 기회이나 낙폭 확대 주의",
        -1: "공포지수 25↑, 시장 불안 확대. 변동성 매매 유의, 비중 축소 또는 헤지 고려",
        0: "공포지수 15~25, 정상 범위. 개별 종목 펀더멘털 기반 매매 유효",
        1: "공포지수 12~15, 시장 안정. 리스크온 환경, 베타 높은 종목 유리",
        2: "공포지수 12↓, 강한 낙관. 과열 주의 — 급등 후 되돌림 가능성 체크"
    },
    "foreign": {
        -2: "외국인 대규모 순매도(5,000억↑). 프로그램 매도 동반 시 지수 급락 — 추격 매도 금지, 지지선 확인 후 대응",
        -1: "외국인 소규모 순매도. 방향성 약하나 연속 매도 시 추세 전환 경계",
        0: "외국인 매매 중립. 관망 구간, 뚜렷한 방향성 부재",
        1: "외국인 소규모 순매수. 매수세 유입 초기 — 대형주 중심 긍정, 지속성 모니터링",
        2: "외국인 대규모 순매수(5,000억↑). 강한 매수 시그널 — 삼성전자·SK하이닉스 등 대형주 동반 상승 기대"
    },
    "futures": {
        -2: "외국인 선물 대규모 매도(1만계약↑). 하방 베팅 → 현물 연쇄 매도 유발 가능. 지수 풋옵션 헤지 고려",
        -1: "외국인 선물 소규모 매도. 단기 하방 압력, 현물과 방향 불일치 시 혼조세",
        0: "외국인 선물 중립. 만기일 근접 시 롤오버 방향 주시",
        1: "외국인 선물 소규모 매수. 상방 베팅 시작 — 현물 동반 매수 시 상승 모멘텀",
        2: "외국인 선물 대규모 매수(1만계약↑). 강력한 상방 시그널 — 지수 상승 추세 진입 가능"
    },
    "short": {
        -2: "공매도/대차잔고 급증(+30%↑). 기관·외국인 하방 베팅 강화. 공매도 과열 종목 회피, 숏커버 랠리 가능성도 염두",
        -1: "공매도/대차잔고 소폭 증가(+10%↑). 특정 섹터 타겟 매도 가능성, 업종별 공매도 비중 체크",
        0: "공매도 정상 수준. 공매도 변수 중립",
        1: "공매도/대차잔고 감소(-10%↓). 숏커버 수요 발생 → 단기 반등 촉매 가능",
        2: "공매도/대차잔고 급감(-30%↓). 대규모 숏커버 진행 — 급반등 가능성, 기존 매도 포지션 청산 압력"
    }
}

# Safety Level별 종합 액션 지침
ACTION_GUIDANCE = {
    1: {
        "title": "🟢 적극 매수 환경",
        "actions": [
            "외국인 수급 우호적 — 대형주 중심 비중 확대 유효",
            "분할매수 전략: 1차 진입(40%) → 눌림목 2차(30%) → 돌파 시 3차(30%)",
            "코스피200·대형 IT 중심 포트폴리오 구성 유리",
            "손절 기준: 직전 저점 -3% 이탈 시"
        ]
    },
    2: {
        "title": "🟡 선별적 대응 구간",
        "actions": [
            "방향성 불분명 — 신규 진입보다 기존 포지션 관리 우선",
            "대형주·우량주 위주 보수적 접근, 테마·소형주 비중 축소",
            "Tier A·B 방향이 엇갈리면 동행지표(Tier B) 방향에 가중치",
            "현금 비중 30~50% 유지, 급변 시 대응 여력 확보"
        ]
    },
    3: {
        "title": "🔴 방어적 전략 필수",
        "actions": [
            "외국인 이탈 신호 — 신규 매수 자제, 현금 비중 최대화",
            "보유 종목: 손절 라인 엄수, 반등 시 비중 축소 (물타기 금지)",
            "인버스 ETF·달러 자산으로 헤지 검토",
            "패닉 매도 구간까지 하락 시(VIX 30↑) 분할 저가매수 준비"
        ]
    }
}

# Default tier weights
DEFAULT_WEIGHTS = {
    "dxy": 0.4 / 3,      # ~0.133
    "us10y": 0.4 / 3,
    "vix": 0.4 / 3,
    "foreign": 0.6 / 3,  # 0.2
    "futures": 0.6 / 3,
    "short": 0.6 / 3,
}


class MacroDashboardCollector:

    def __init__(self):
        self.base_url = os.getenv("KIWOOM_BASE_URL", "https://openapi.kiwoom.com")
        self.app_key = os.getenv("KIWOOM_APP_KEY")
        self.app_secret = os.getenv("KIWOOM_SECRET_KEY")
        self.token = None

    # ─── Token (same as KiwoomCollector) ───────────────────
    def _get_token(self) -> Optional[str]:
        if self.token:
            return self.token
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
            logger.error(f"[MacroDashboard] Token error: {e}")
            return None

    # ─── Tier A: Global Sentiment (Yahoo Finance) ──────────
    def collect_global_sentiment(self) -> Dict:
        """DXY, US 10Y, VIX를 한번에 수집"""
        try:
            import yfinance as yf
            tickers = ["DX-Y.NYB", "^TNX", "^VIX"]
            data = yf.download(tickers, period="5d", progress=False, threads=False)

            if data.empty or len(data) < 2:
                logger.warning("[MacroDashboard] Yahoo Finance data empty")
                return self._empty_global()

            close = data['Close']
            today_row = close.iloc[-1]
            prev_row = close.iloc[-2]

            # DXY
            dxy_val = float(today_row["DX-Y.NYB"]) if "DX-Y.NYB" in today_row else None
            dxy_prev = float(prev_row["DX-Y.NYB"]) if "DX-Y.NYB" in prev_row else None
            dxy_chg = ((dxy_val - dxy_prev) / dxy_prev * 100) if (dxy_val and dxy_prev) else 0

            # US 10Y
            us10y_val = float(today_row["^TNX"]) if "^TNX" in today_row else None
            us10y_prev = float(prev_row["^TNX"]) if "^TNX" in prev_row else None
            us10y_chg_bps = ((us10y_val - us10y_prev) * 100) if (us10y_val is not None and us10y_prev is not None) else 0

            # VIX
            vix_val = float(today_row["^VIX"]) if "^VIX" in today_row else None
            vix_prev = float(prev_row["^VIX"]) if "^VIX" in prev_row else None
            vix_chg = ((vix_val - vix_prev) / vix_prev * 100) if (vix_val and vix_prev) else 0

            return {
                "dxy": {
                    "value": round(dxy_val, 3) if dxy_val else None,
                    "change_pct": round(dxy_chg, 3),
                    "score": self._score_dxy(dxy_chg)
                },
                "us10y": {
                    "value": round(us10y_val, 3) if us10y_val else None,
                    "change_bps": round(us10y_chg_bps, 3),
                    "score": self._score_us10y(us10y_chg_bps)
                },
                "vix": {
                    "value": round(vix_val, 2) if vix_val else None,
                    "change_pct": round(vix_chg, 3),
                    "score": self._score_vix(vix_val, vix_chg)
                }
            }
        except Exception as e:
            logger.error(f"[MacroDashboard] Global sentiment error: {e}")
            return self._empty_global()

    def _empty_global(self):
        return {
            "dxy": {"value": None, "change_pct": 0, "score": 0},
            "us10y": {"value": None, "change_bps": 0, "score": 0},
            "vix": {"value": None, "change_pct": 0, "score": 0},
        }

    def _empty_global_markets(self):
        empty = {"value": None, "change_pct": 0}
        return {"nasdaq": empty.copy(), "sp500": empty.copy(), "oil": empty.copy(), "gold": empty.copy(), "bitcoin": empty.copy(), "krw_usd": {"value": None, "change": 0, "change_pct": 0}}

    # ─── Tier A + Global Markets (Yahoo Finance) ─────────
    def collect_global_all(self) -> Dict:
        """Tier A (DXY, US10Y, VIX) + 글로벌 시장 (나스닥, S&P500, 유가, 금, 비트코인) 한번에 수집"""
        try:
            import yfinance as yf

            tickers = ["DX-Y.NYB", "^TNX", "^VIX", "^IXIC", "^GSPC", "CL=F", "GC=F", "BTC-USD", "KRW=X"]
            data = yf.download(tickers, period="5d", progress=False, threads=False)

            if data.empty or len(data) < 2:
                logger.warning("[MacroDashboard] Yahoo Finance data empty")
                return {
                    "tier_a": self._empty_global(),
                    "global_markets": self._empty_global_markets(),
                    "krw_usd": {"value": None, "change": 0, "change_pct": 0},
                    "us_market_date": None,
                    "us_market_day": None,
                }

            close = data['Close']
            today_row = close.iloc[-1]
            prev_row = close.iloc[-2]

            # US market date from index
            us_market_dt = data.index[-1]
            us_market_date = us_market_dt.strftime("%Y-%m-%d")
            us_market_day = DAY_NAMES_KR[us_market_dt.weekday()]

            # --- Tier A ---
            # DXY
            dxy_val = float(today_row["DX-Y.NYB"]) if pd.notna(today_row.get("DX-Y.NYB")) else None
            dxy_prev = float(prev_row["DX-Y.NYB"]) if pd.notna(prev_row.get("DX-Y.NYB")) else None
            dxy_chg = ((dxy_val - dxy_prev) / dxy_prev * 100) if (dxy_val and dxy_prev) else 0

            # US 10Y
            us10y_val = float(today_row["^TNX"]) if pd.notna(today_row.get("^TNX")) else None
            us10y_prev = float(prev_row["^TNX"]) if pd.notna(prev_row.get("^TNX")) else None
            us10y_chg_bps = ((us10y_val - us10y_prev) * 100) if (us10y_val is not None and us10y_prev is not None) else 0

            # VIX
            vix_val = float(today_row["^VIX"]) if pd.notna(today_row.get("^VIX")) else None
            vix_prev = float(prev_row["^VIX"]) if pd.notna(prev_row.get("^VIX")) else None
            vix_chg = ((vix_val - vix_prev) / vix_prev * 100) if (vix_val and vix_prev) else 0

            tier_a = {
                "dxy": {
                    "value": round(dxy_val, 3) if dxy_val else None,
                    "change_pct": round(dxy_chg, 3),
                    "score": self._score_dxy(dxy_chg)
                },
                "us10y": {
                    "value": round(us10y_val, 3) if us10y_val else None,
                    "change_bps": round(us10y_chg_bps, 3),
                    "score": self._score_us10y(us10y_chg_bps)
                },
                "vix": {
                    "value": round(vix_val, 2) if vix_val else None,
                    "change_pct": round(vix_chg, 3),
                    "score": self._score_vix(vix_val, vix_chg)
                }
            }

            # --- Global Markets ---
            def _calc_market(ticker):
                val = float(today_row[ticker]) if pd.notna(today_row.get(ticker)) else None
                prev = float(prev_row[ticker]) if pd.notna(prev_row.get(ticker)) else None
                chg = round(((val - prev) / prev * 100), 3) if (val and prev) else 0
                return {"value": round(val, 2) if val else None, "change_pct": chg}

            global_markets = {
                "nasdaq": _calc_market("^IXIC"),
                "sp500": _calc_market("^GSPC"),
                "oil": _calc_market("CL=F"),
                "gold": _calc_market("GC=F"),
                "bitcoin": _calc_market("BTC-USD"),
            }

            # --- KRW/USD ---
            krw_val = float(today_row["KRW=X"]) if pd.notna(today_row.get("KRW=X")) else None
            krw_prev = float(prev_row["KRW=X"]) if pd.notna(prev_row.get("KRW=X")) else None
            krw_change = round(krw_val - krw_prev, 2) if (krw_val and krw_prev) else 0
            krw_change_pct = round(((krw_val - krw_prev) / krw_prev * 100), 3) if (krw_val and krw_prev) else 0

            global_markets["krw_usd"] = {"value": round(krw_val, 2) if krw_val else None, "change": krw_change, "change_pct": krw_change_pct}

            return {
                "tier_a": tier_a,
                "global_markets": global_markets,
                "krw_usd": global_markets["krw_usd"],
                "us_market_date": us_market_date,
                "us_market_day": us_market_day,
            }
        except Exception as e:
            logger.error(f"[MacroDashboard] Global all error: {e}")
            return {
                "tier_a": self._empty_global(),
                "global_markets": self._empty_global_markets(),
                "krw_usd": {"value": None, "change": 0, "change_pct": 0},
                "us_market_date": None,
                "us_market_day": None,
            }

    # ─── Tier B: 외국인 현물 (ka10066) ─────────────────────
    def collect_foreign_cash(self) -> Dict:
        token = self._get_token()
        if not token:
            return {"net_amount": 0, "score": 0}

        today = datetime.now().strftime("%Y%m%d")
        url = f"{self.base_url}/api/dostk/mrkcond"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10066",
            "Authorization": f"Bearer {token}"
        }
        body = {
            "stk_cd": "001",
            "strtt_dt": today,
            "end_dt": today,
            "amt_qty_tp": "1",
            "trde_tp": "0",
            "stex_tp": "1"
        }
        try:
            res = requests.post(url, headers=headers, json=body, timeout=10)
            res.raise_for_status()
            data = res.json()

            # Defensive: scan for the response list
            items = data.get("opaf_invsr_trde", [])
            if not items:
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0:
                        items = v
                        break

            if items:
                latest = items[0]
                foreign_net = int(latest.get("frgnr_invsr", "0").replace(",", ""))
                score = self._score_foreign_cash(foreign_net)
                return {"net_amount": foreign_net, "score": score, "raw": items[:3]}

            return {"net_amount": 0, "score": 0}
        except Exception as e:
            logger.error(f"[MacroDashboard] Foreign cash error: {e}")
            return {"net_amount": 0, "score": 0}

    # ─── Tier B: 선물 (ka10014) ────────────────────────────
    def collect_futures(self) -> Dict:
        token = self._get_token()
        if not token:
            return {"net": 0, "score": 0}

        url = f"{self.base_url}/api/dostk/chart"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10014",
            "Authorization": f"Bearer {token}"
        }
        body = {
            "mrkt_tp": "000",
            "amt_qty_tp": "2",
            "trde_tp": "0",
            "stk_cd": "101"
        }
        try:
            res = requests.post(url, headers=headers, json=body, timeout=10)
            res.raise_for_status()
            data = res.json()

            items = data.get("opmr_invsr_trde_cha", [])
            if not items:
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0:
                        items = v
                        break

            if items:
                latest = items[0]
                frgn_net = int(latest.get("frgn_invsr", "0").replace(",", ""))
                score = self._score_futures(frgn_net)
                return {"net": frgn_net, "score": score, "raw": items[:3]}

            return {"net": 0, "score": 0}
        except Exception as e:
            logger.error(f"[MacroDashboard] Futures error: {e}")
            return {"net": 0, "score": 0}

    # ─── Tier B: 공매도/대차 (ka10068) ─────────────────────
    def collect_short_selling(self) -> Dict:
        token = self._get_token()
        if not token:
            return {"volume": 0, "change_pct": 0, "score": 0}

        today = datetime.now().strftime("%Y%m%d")
        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y%m%d")

        url = f"{self.base_url}/api/dostk/slb"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10068",
            "Authorization": f"Bearer {token}"
        }
        body = {
            "strt_dt": week_ago,
            "end_dt": today,
            "all_tp": "0"
        }
        try:
            res = requests.post(url, headers=headers, json=body, timeout=10)
            res.raise_for_status()
            data = res.json()

            items = data.get("dbrt_trde_trnsn", [])
            if not items:
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0:
                        items = v
                        break

            if len(items) >= 2:
                today_vol = abs(int(items[0].get("rmnd", items[0].get("dbrt_trde_cntrcnt", "0")).replace(",", "")))
                prev_vol = abs(int(items[1].get("rmnd", items[1].get("dbrt_trde_cntrcnt", "0")).replace(",", "")))
                change_pct = ((today_vol - prev_vol) / max(prev_vol, 1)) * 100
                score = self._score_short(change_pct)
                return {
                    "volume": today_vol,
                    "change_pct": round(change_pct, 3),
                    "score": score,
                    "raw": items[:5]
                }
            elif items:
                return {"volume": 0, "change_pct": 0, "score": 0}

            return {"volume": 0, "change_pct": 0, "score": 0}
        except Exception as e:
            logger.error(f"[MacroDashboard] Short selling error: {e}")
            return {"volume": 0, "change_pct": 0, "score": 0}

    # ═══════════════════════════════════════════════════════
    # Scoring Functions
    # ═══════════════════════════════════════════════════════

    def _score_dxy(self, change_pct: float) -> int:
        """DXY ↑ = 달러 강세 = 신흥국 부정"""
        if change_pct >= 1.5: return -2
        if change_pct >= 0.5: return -1
        if change_pct > -0.5: return 0
        if change_pct > -1.5: return 1
        return 2

    def _score_us10y(self, change_bps: float) -> int:
        """US 10Y ↑ = 금리 상승 = 위험자산 회피"""
        if change_bps >= 10: return -2
        if change_bps >= 3: return -1
        if change_bps > -3: return 0
        if change_bps > -10: return 1
        return 2

    def _score_vix(self, value: Optional[float], change_pct: float) -> int:
        """VIX 절대값 기준 (변동률보다 레벨이 중요)"""
        if value is None:
            return 0
        if value >= 30: return -2
        if value >= 25: return -1
        if value >= 15: return 0
        if value >= 12: return 1
        return 2

    def _score_foreign_cash(self, net_amount: int) -> int:
        """순매매 금액 (억원). 양수 = 순매수."""
        if net_amount <= -5000: return -2
        if net_amount < -500: return -1
        if net_amount <= 500: return 0
        if net_amount < 5000: return 1
        return 2

    def _score_futures(self, net_contracts: int) -> int:
        """선물 순매매 계약수. 양수 = 순매수."""
        if net_contracts <= -10000: return -2
        if net_contracts < -2000: return -1
        if net_contracts <= 2000: return 0
        if net_contracts < 10000: return 1
        return 2

    def _score_short(self, change_pct: float) -> int:
        """공매도 잔고 변동률. 증가 = 부정."""
        if change_pct >= 30: return -2
        if change_pct >= 10: return -1
        if change_pct > -10: return 0
        if change_pct > -30: return 1
        return 2

    # ═══════════════════════════════════════════════════════
    # Composite Calculation
    # ═══════════════════════════════════════════════════════

    def calculate_overall(self, scores: Dict[str, int],
                          weights: Optional[Dict[str, float]] = None) -> Tuple[float, int, str]:
        """가중 평균으로 종합점수 산출"""
        w = weights or DEFAULT_WEIGHTS

        weighted_sum = sum(scores[k] * w.get(k, 0) for k in scores)
        total_weight = sum(w.get(k, 0) for k in scores)
        overall = round(weighted_sum / max(total_weight, 0.001), 2)

        # Safety level
        if overall >= 0.5:
            level = 1
        elif overall <= -0.5:
            level = 3
        else:
            level = 2

        # Prediction direction
        if overall >= 0.3:
            pred_dir = "bullish"
        elif overall <= -0.3:
            pred_dir = "bearish"
        else:
            pred_dir = "neutral"

        # Interpretation text
        level_labels = {1: "🟢 외국인 우호적", 2: "🟡 중립/관망", 3: "🔴 외국인 이탈 경고"}
        lines = [f"{level_labels[level]} (종합: {overall:+.2f})"]
        lines.append("")

        # Tier A 요약
        tier_a_keys = ["dxy", "us10y", "vix"]
        tier_b_keys = ["foreign", "futures", "short"]
        tier_a_avg = sum(scores[k] for k in tier_a_keys) / 3
        tier_b_avg = sum(scores[k] for k in tier_b_keys) / 3

        if tier_a_avg < -0.3 and tier_b_avg > 0.3:
            lines.append("⚡ Tier A(글로벌)↓ vs Tier B(수급)↑ — 글로벌 악재에도 국내 수급 방어 중. 단기 괴리 주시")
        elif tier_a_avg > 0.3 and tier_b_avg < -0.3:
            lines.append("⚡ Tier A(글로벌)↑ vs Tier B(수급)↓ — 글로벌 호조에도 외국인 실제 매도. 차익실현 가능성")
        elif tier_a_avg < -0.3 and tier_b_avg < -0.3:
            lines.append("🚨 Tier A·B 동반 악화 — 글로벌+수급 모두 부정. 방어 모드 전환 필요")
        elif tier_a_avg > 0.3 and tier_b_avg > 0.3:
            lines.append("🚀 Tier A·B 동반 호조 — 글로벌+수급 동조. 높은 신뢰도의 상승 시그널")
        lines.append("")

        indicator_names = {
            "dxy": "DXY", "us10y": "US 10Y", "vix": "VIX",
            "foreign": "외국인현물", "futures": "선물", "short": "공매도"
        }

        lines.append("[ Tier A: 글로벌 센티먼트 ]")
        for key in tier_a_keys:
            score = scores[key]
            name = indicator_names[key]
            label = SCORE_LABELS.get(score, "중립")
            detail = SCORE_DETAILS.get(key, {}).get(score, "")
            lines.append(f"  {name}: {label}({score:+d}) — {detail}")
        lines.append("")

        lines.append("[ Tier B: 실제 수급 ]")
        for key in tier_b_keys:
            score = scores[key]
            name = indicator_names[key]
            label = SCORE_LABELS.get(score, "중립")
            detail = SCORE_DETAILS.get(key, {}).get(score, "")
            lines.append(f"  {name}: {label}({score:+d}) — {detail}")
        lines.append("")

        # 액션 지침
        guidance = ACTION_GUIDANCE.get(level, ACTION_GUIDANCE[2])
        lines.append(f"━━━ {guidance['title']} ━━━")
        for action in guidance["actions"]:
            lines.append(f"  → {action}")

        interpretation = "\n".join(lines)
        return overall, level, interpretation, pred_dir

    def generate_chain_analysis(self, scores: Dict[str, int], tier_a: Dict, global_markets: Dict, tier_b: Dict,
                                kr_date: str = "", us_market_date: str = "") -> str:
        """
        학술 근거 기반 연쇄 분석 생성.
        실제 데이터로 경제 흐름을 설명하여 반복 학습 가능하도록 구성.
        """
        lines = []

        # 시간 맥락 결정
        kr_now = datetime.now(KST)
        kr_weekday = kr_now.weekday()  # 0=월 ~ 6=일
        is_weekend = kr_weekday >= 5

        # US 데이터가 오늘이 아닌 경우 (월요일엔 금요일 데이터)
        us_label = "어젯밤"  # 기본값 (화~금)
        if is_weekend:
            us_label = "지난 금요일"
        elif kr_weekday == 0:  # 월요일
            us_label = "지난 금요일"

        if is_weekend:
            lines.append("━━━ 연쇄 분석: 주말 시장 정리 ━━━")
            lines.append("")
            lines.append(f"📅 오늘은 {DAY_NAMES_KR[kr_weekday]}요일로 한국·미국 시장이 모두 휴장입니다.")
            lines.append(f"  아래 분석은 지난 금요일({us_market_date or '?'}) 미국 종가 기준입니다.")
            lines.append(f"  월요일 한국 장 시작 전에 이 흐름을 점검하세요.")
            lines.append("")
        else:
            lines.append("━━━ 연쇄 분석: 오늘의 자금 흐름 ━━━")
            lines.append("")

        dxy_chg = tier_a.get("dxy", {}).get("change_pct", 0)
        us10y_val = tier_a.get("us10y", {}).get("value")
        us10y_chg = tier_a.get("us10y", {}).get("change_bps", 0)
        vix_val = tier_a.get("vix", {}).get("value")
        vix_chg = tier_a.get("vix", {}).get("change_pct", 0)

        nasdaq_chg = global_markets.get("nasdaq", {}).get("change_pct", 0)
        sp500_chg = global_markets.get("sp500", {}).get("change_pct", 0)
        oil_chg = global_markets.get("oil", {}).get("change_pct", 0)
        gold_chg = global_markets.get("gold", {}).get("change_pct", 0)
        btc_chg = global_markets.get("bitcoin", {}).get("change_pct", 0)
        krw = global_markets.get("krw_usd", {})
        krw_chg = krw.get("change", 0)
        krw_val = krw.get("value")

        foreign_net = tier_b.get("foreign_cash", {}).get("net_amount", 0)
        futures_net = tier_b.get("futures", {}).get("net", 0)

        # ──── 1. 달러 → 환율 → 외국인 연쇄 ────
        lines.append("[ 1. 달러 → 환율 → 외국인 자금 흐름 ]")
        if dxy_chg > 0.3:
            lines.append(f"  {us_label} 달러지수가 {dxy_chg:+.2f}% 상승했습니다.")
            lines.append(f"  → 달러가 강해지면 원화 가치가 떨어집니다 (원/달러 {krw_val or '?'}원, {krw_chg:+.0f}원).")
            lines.append(f"  → 외국인 입장에서 한국 주식의 달러 환산 수익이 줄어들어 매도 압력이 생깁니다.")
            if foreign_net < -500:
                lines.append(f"  → 실제로 오늘 외국인은 {foreign_net:,.0f}억원 순매도했습니다. 달러 강세와 일치하는 흐름입니다.")
            elif foreign_net > 500:
                lines.append(f"  → 그러나 오늘 외국인은 {foreign_net:,.0f}억원 순매수 중입니다. 달러 강세에도 불구하고 한국 시장에 매력을 느끼는 것입니다.")
            lines.append(f"  (근거: BIS 2024 — 달러 10% 강세 시 신흥국 통화 ~4% 약세, 주가 ~4% 하락)")
        elif dxy_chg < -0.3:
            lines.append(f"  {us_label} 달러지수가 {dxy_chg:+.2f}% 하락했습니다.")
            lines.append(f"  → 달러가 약해지면 원화 가치가 올라갑니다 (원/달러 {krw_val or '?'}원, {krw_chg:+.0f}원).")
            lines.append(f"  → 외국인에게 한국 주식 투자 매력이 높아져 자금 유입이 기대됩니다.")
            if foreign_net > 500:
                lines.append(f"  → 실제로 외국인 {foreign_net:,.0f}억원 순매수로 확인됩니다.")
            lines.append(f"  (근거: BIS 2024 — 달러 약세 시 신흥국 자금 유입 확대)")
        else:
            lines.append(f"  달러지수 변동이 크지 않습니다 ({dxy_chg:+.2f}%). 환율 변수는 오늘 중립입니다.")
            if krw_val:
                lines.append(f"  → 현재 원/달러 {krw_val:.0f}원 (전일비 {krw_chg:+.0f}원)")
        lines.append("")

        # ──── 2. 미국 증시 → KOSPI 영향 ────
        lines.append("[ 2. 미국 증시 → KOSPI 영향 ]")
        us_avg = (nasdaq_chg + sp500_chg) / 2
        if abs(us_avg) > 1.0:
            direction = "상승" if us_avg > 0 else "하락"
            lines.append(f"  {us_label} 미국 증시가 큰 폭으로 {direction}했습니다 (나스닥 {nasdaq_chg:+.2f}%, S&P {sp500_chg:+.2f}%).")
            if us_avg < -1.0:
                lines.append(f"  → 한국 시장은 미국 야간 하락을 갭다운으로 반영할 가능성이 높습니다.")
                lines.append(f"  → 단, 학술 연구에 따르면 한국 투자자는 미국 소식에 '과잉반응'하는 경향이 있어")
                lines.append(f"    장 초반 급락 후 장중 되돌림이 발생하는 패턴이 자주 관찰됩니다.")
            else:
                lines.append(f"  → 한국 시장도 갭업으로 시작할 가능성이 있습니다.")
                lines.append(f"  → 다만 미국 호재에 대한 과잉반응으로 시가 고점 후 눌림도 가능합니다.")
            lines.append(f"  (근거: 변동성 전이 계수 한국 16.11bps — Earticle / T&F)")
        elif abs(us_avg) > 0.3:
            direction = "소폭 상승" if us_avg > 0 else "소폭 하락"
            lines.append(f"  미국 증시 {direction} (나스닥 {nasdaq_chg:+.2f}%, S&P {sp500_chg:+.2f}%).")
            lines.append(f"  → KOSPI에 미치는 영향은 제한적이며, 국내 수급이 더 중요한 구간입니다.")
        else:
            lines.append(f"  미국 증시 보합 (나스닥 {nasdaq_chg:+.2f}%, S&P {sp500_chg:+.2f}%). 외부 변수 중립.")
        lines.append("")

        # ──── 3. 유가 → 인플레/금리 기대 ────
        lines.append("[ 3. 유가 → 인플레이션 → 금리 기대 ]")
        if oil_chg > 2.0:
            lines.append(f"  {us_label} 유가가 {oil_chg:+.2f}% 상승했습니다.")
            lines.append(f"  → 유가 상승은 기업 비용 증가와 인플레이션 재점화 우려를 낳습니다.")
            lines.append(f"  → 중앙은행이 금리를 더 오래 높게 유지하거나 추가 인상할 가능성이 높아집니다.")
            if us10y_chg > 3:
                lines.append(f"  → 실제로 미국 국채 10년 금리가 {us10y_chg:+.1f}bp 상승하며 이를 반영하고 있습니다.")
            lines.append(f"  (근거: SF Fed 2025 — 유가 3% 상승 시 2년물 국채금리 4.5bp 상승)")
        elif oil_chg < -2.0:
            lines.append(f"  유가가 {oil_chg:+.2f}% 하락했습니다.")
            lines.append(f"  → 유가 하락은 인플레이션 완화 기대를 높여 금리인하 가능성을 키웁니다.")
            lines.append(f"  → 이는 성장주와 기술주에 긍정적인 환경입니다.")
        else:
            lines.append(f"  유가 변동 제한적 ({oil_chg:+.2f}%). 인플레이션 경로에 큰 변화 없습니다.")
        lines.append("")

        # ──── 4. 안전자산 동향 ────
        lines.append("[ 4. 안전자산 vs 위험자산 흐름 ]")
        # Gold: NOT a safe haven for Korea per Baur & McDermott 2010
        # Bitcoin: risk-ON asset per ArXiv 2025
        if gold_chg > 1.0 and us_avg < -0.5:
            lines.append(f"  금 {gold_chg:+.2f}% 상승 + 미국 증시 하락 → 글로벌 '위험 회피' 모드입니다.")
            lines.append(f"  → 단, 금은 미국/유럽에서는 안전자산이지만 한국 시장의 안전자산으로는 작동하지 않습니다.")
            lines.append(f"  → 핵심은 금 자체가 아니라, 금이 오르게 만든 '불확실성'이 한국에 미치는 영향입니다.")
            lines.append(f"  (근거: Baur & McDermott 2010 — 금은 신흥국 안전자산 아님)")
        elif gold_chg > 1.0 and us_avg > 0.5:
            lines.append(f"  금 {gold_chg:+.2f}% 상승이지만 미국 증시도 상승 → 인플레 헤지 수요일 가능성이 높습니다.")
            lines.append(f"  → 이 경우 위험 회피가 아닌 원자재 전반의 상승세로 해석합니다.")

        if btc_chg > 3.0 and nasdaq_chg > 0.5:
            lines.append(f"  비트코인 {btc_chg:+.2f}% + 나스닥 상승 → 'risk-on' 분위기입니다.")
            lines.append(f"  → 2024년 ETF 승인 이후 비트코인은 나스닥과 같은 방향으로 움직이는 '위험자산'입니다.")
            lines.append(f"  → 비트코인 상승은 시장의 위험 선호를 보여주는 지표입니다.")
            lines.append(f"  (근거: ArXiv 2025 — 비트코인은 post-ETF risk-on 자산)")
        elif btc_chg < -3.0 and nasdaq_chg < -0.5:
            lines.append(f"  비트코인 {btc_chg:+.2f}% + 나스닥 하락 → 위험자산 전반 매도세입니다.")
            lines.append(f"  → 비트코인은 이제 안전자산이 아닌 위험자산이므로, 나스닥과 함께 하락합니다.")

        if gold_chg <= 1.0 and abs(btc_chg) <= 3.0:
            lines.append(f"  금 ({gold_chg:+.2f}%), 비트코인 ({btc_chg:+.2f}%) — 안전자산/위험자산 특별한 시그널 없음.")
        lines.append("")

        # ──── 5. 선물·공매도 선행 신호 ────
        lines.append("[ 5. 선물·공매도 → 내일의 시장 방향 ]")
        if futures_net < -5000:
            lines.append(f"  외국인이 선물을 대규모 매도했습니다 ({futures_net:,.0f}계약).")
            lines.append(f"  → 선물 시장은 현물보다 빠르게 움직입니다. 정보를 가진 투자자들이 먼저 선물에서 베팅합니다.")
            lines.append(f"  → 선물 대량 매도는 '내일 현물 하락'의 선행 신호로 작용할 가능성이 높습니다.")
            lines.append(f"  (근거: ScienceDirect 2013 — 외국인 선물 거래량이 다음날 현물 수익률 예측)")
        elif futures_net > 5000:
            lines.append(f"  외국인이 선물을 대규모 매수했습니다 ({futures_net:,.0f}계약).")
            lines.append(f"  → 선물 대량 매수는 상방 베팅으로, 현물 시장의 상승을 선행하는 경우가 많습니다.")
            lines.append(f"  (근거: ScienceDirect 2013 — 외국인 정보 우위 → 선물이 현물을 선행)")
        else:
            lines.append(f"  선물 순매매 {futures_net:,.0f}계약으로 뚜렷한 방향성은 없습니다.")
        lines.append("")

        # ──── 6. 지표별 스코어 종합 ────
        lines.append("[ 6. 지표별 스코어 종합 ]")

        tier_a_keys = ["dxy", "us10y", "vix"]
        tier_b_keys = ["foreign", "futures", "short"]
        indicator_names = {
            "dxy": "DXY(달러지수)", "us10y": "US10Y(미국채)", "vix": "VIX(공포지수)",
            "foreign": "외국인 현물", "futures": "외국인 선물", "short": "공매도/대차"
        }
        tier_a_avg = sum(scores[k] for k in tier_a_keys) / 3
        tier_b_avg = sum(scores[k] for k in tier_b_keys) / 3

        lines.append(f"  Tier A 평균: {tier_a_avg:+.1f}  |  Tier B 평균: {tier_b_avg:+.1f}")
        for key in tier_a_keys + tier_b_keys:
            score = scores[key]
            name = indicator_names[key]
            label = SCORE_LABELS.get(score, "중립")
            detail = SCORE_DETAILS.get(key, {}).get(score, "")
            lines.append(f"  {'▶' if abs(score) >= 2 else '·'} {name}: {label}({score:+d}) — {detail}")
        lines.append("")

        # Tier A vs B 괴리 분석
        if tier_a_avg < -0.3 and tier_b_avg > 0.3:
            lines.append("  ⚡ 글로벌(Tier A)은 부정적이지만 국내 수급(Tier B)은 긍정적입니다.")
            lines.append("  → 외국인이 글로벌 악재에도 한국 시장을 아직 이탈하지 않은 것입니다.")
            lines.append("  → 이 괴리가 해소될 때 방향이 정해집니다 — 수급이 버틸지, 글로벌에 굴복할지 주시.")
        elif tier_a_avg > 0.3 and tier_b_avg < -0.3:
            lines.append("  ⚡ 글로벌(Tier A)은 우호적이지만 외국인이 실제로는 매도 중입니다.")
            lines.append("  → 글로벌 호재가 이미 가격에 반영된 후 차익실현 중일 수 있습니다.")
            lines.append("  → 또는 한국 고유의 리스크(정치, 환율, 실적)가 작용 중일 수 있습니다.")
        elif tier_a_avg < -0.3 and tier_b_avg < -0.3:
            lines.append("  🚨 글로벌 환경과 국내 수급이 모두 부정적입니다.")
            lines.append("  → 두 축이 동시에 나빠지면 하락 강도와 기간이 커질 수 있습니다.")
        elif tier_a_avg > 0.3 and tier_b_avg > 0.3:
            lines.append("  🟢 글로벌 환경과 국내 수급이 동시에 긍정적입니다.")
            lines.append("  → 가장 신뢰도 높은 상승 시그널입니다.")
        lines.append("")

        # ──── 7. 종합 판단 + 액션 ────
        lines.append("[ 종합: 오늘의 핵심 메시지 ]")

        # 복합 시그널
        triple_pressure = dxy_chg > 0.3 and oil_chg > 1.0 and krw_chg > 5
        risk_off_global = gold_chg > 1.0 and vix_chg > 5 and dxy_chg > 0.3
        strong_bearish = us_avg < -1.0 and futures_net < -2000
        risk_on = nasdaq_chg > 0.5 and btc_chg > 1.0 and dxy_chg < -0.1
        strong_bullish = us_avg > 1.0 and futures_net > 2000 and foreign_net > 500

        if triple_pressure:
            lines.append(f"  ⚠️ '삼중 압력' 상황: 달러 강세 + 유가 상승 + 원화 약세")
            lines.append(f"  → 세 가지가 동시에 발생하면 외국인 이탈이 가속됩니다.")
            lines.append(f"  → 수입 기업(원자재 의존)의 비용 증가 + 환차손 → 외국인 매도 압력 강화")
        elif risk_off_global:
            lines.append(f"  ⚠️ 글로벌 위험 회피 모드: 금↑ + VIX↑ + 달러↑")
            lines.append(f"  → 글로벌 투자자들이 안전자산으로 이동하고 있습니다.")
            lines.append(f"  → 신흥국(한국 포함)에서 자금이 빠질 수 있는 환경입니다.")
        elif strong_bearish:
            lines.append(f"  ⚠️ 강한 하락 시그널: 미국 증시 급락 + 선물 매도")
            lines.append(f"  → 두 지표가 동시에 부정적일 때 KOSPI 하락 확률이 높습니다.")
            lines.append(f"  → 다만 갭다운 후 장중 되돌림 패턴도 빈번하므로, 공포 매도는 자제하세요.")
        elif strong_bullish:
            lines.append(f"  🟢 강한 상승 시그널: 미국 상승 + 선물 매수 + 외국인 현물 매수")
            lines.append(f"  → 글로벌 환경과 국내 수급이 모두 긍정적입니다.")
            lines.append(f"  → 대형주 중심의 상승이 기대되는 구간입니다.")
        elif risk_on:
            lines.append(f"  🟢 Risk-on 전환: 나스닥↑ + 비트코인↑ + 달러↓")
            lines.append(f"  → 위험자산 선호 심리가 강해지고 있습니다.")
            lines.append(f"  → 성장주·기술주에 우호적인 환경입니다.")
        else:
            lines.append(f"  지표들이 혼재되어 있어 뚜렷한 방향성을 찾기 어렵습니다.")
            lines.append(f"  → 이런 날은 개별 종목의 펀더멘털과 국내 수급에 집중하세요.")
            lines.append(f"  → Tier B(외국인 현물/선물/공매도)의 방향에 더 가중치를 두세요.")
        lines.append("")

        # 액션 지침
        overall_score = sum(scores[k] * DEFAULT_WEIGHTS.get(k, 0) for k in scores) / max(sum(DEFAULT_WEIGHTS.get(k, 0) for k in scores), 0.001)
        if overall_score >= 0.5:
            action_level = 1
        elif overall_score <= -0.5:
            action_level = 3
        else:
            action_level = 2
        guidance = ACTION_GUIDANCE.get(action_level, ACTION_GUIDANCE[2])
        lines.append(f"━━━ {guidance['title']} (종합 {overall_score:+.2f}) ━━━")
        for action in guidance["actions"]:
            lines.append(f"  → {action}")

        return "\n".join(lines)

    # ═══════════════════════════════════════════════════════
    # Self-Calibration (Feedback Loop)
    # ═══════════════════════════════════════════════════════

    def evaluate_prediction(self, prediction_dir: str,
                            actual_kospi_change: float,
                            actual_foreign_net: int) -> Dict:
        """예측 vs 실제 비교"""
        if actual_kospi_change > 0.3:
            actual_dir = "bullish"
        elif actual_kospi_change < -0.3:
            actual_dir = "bearish"
        else:
            actual_dir = "neutral"

        hit = (prediction_dir == actual_dir)
        return {"actual_direction": actual_dir, "hit": hit}

    def calculate_indicator_accuracy(self, history: List[Dict]) -> Dict[str, float]:
        """최근 N일 데이터에서 지표별 적중률 계산"""
        if not history:
            return {}

        indicator_keys = ["dxy", "us10y", "vix", "foreign", "futures", "short"]
        score_field_map = {
            "dxy": "dxy_score", "us10y": "us10y_score", "vix": "vix_score",
            "foreign": "foreign_score", "futures": "futures_score", "short": "short_score"
        }

        accuracy = {}
        for key in indicator_keys:
            hits = 0
            total = 0
            for row in history:
                actual_kospi = row.get("actual_kospi_change")
                if actual_kospi is None:
                    continue
                score = row.get(score_field_map[key], 0)
                # Score > 0 predicts bullish, < 0 predicts bearish
                if score > 0:
                    pred = "bullish"
                elif score < 0:
                    pred = "bearish"
                else:
                    pred = "neutral"

                if actual_kospi > 0.3:
                    actual = "bullish"
                elif actual_kospi < -0.3:
                    actual = "bearish"
                else:
                    actual = "neutral"

                if pred == actual:
                    hits += 1
                total += 1

            accuracy[key] = round(hits / max(total, 1), 3)

        return accuracy

    def get_adjusted_weights(self, accuracy: Dict[str, float]) -> Dict[str, float]:
        """적중률 기반 가중치 조정. Tier 합계 유지."""
        if not accuracy:
            return DEFAULT_WEIGHTS.copy()

        avg_acc = sum(accuracy.values()) / max(len(accuracy), 1)
        if avg_acc == 0:
            return DEFAULT_WEIGHTS.copy()

        adjusted = {}
        for key, base_w in DEFAULT_WEIGHTS.items():
            acc = accuracy.get(key, avg_acc)
            adjusted[key] = base_w * (acc / avg_acc)

        # Normalize: Tier A sum = 0.4, Tier B sum = 0.6
        tier_a_keys = ["dxy", "us10y", "vix"]
        tier_b_keys = ["foreign", "futures", "short"]

        tier_a_sum = sum(adjusted.get(k, 0) for k in tier_a_keys)
        tier_b_sum = sum(adjusted.get(k, 0) for k in tier_b_keys)

        if tier_a_sum > 0:
            for k in tier_a_keys:
                adjusted[k] = round(adjusted[k] / tier_a_sum * 0.4, 4)
        if tier_b_sum > 0:
            for k in tier_b_keys:
                adjusted[k] = round(adjusted[k] / tier_b_sum * 0.6, 4)

        return adjusted

    # ═══════════════════════════════════════════════════════
    # Daily Review
    # ═══════════════════════════════════════════════════════

    def generate_daily_review(self, yesterday: Dict) -> Optional[Dict]:
        """전날 예측 vs 실제 비교 리뷰 생성"""
        if not yesterday:
            return None

        pred_dir = yesterday.get("prediction_direction")
        actual_kospi = yesterday.get("actual_kospi_change")
        actual_foreign = yesterday.get("actual_foreign_net")

        if actual_kospi is None:
            return None

        # Actual direction
        if actual_kospi > 0.3:
            actual_dir = "bullish"
        elif actual_kospi < -0.3:
            actual_dir = "bearish"
        else:
            actual_dir = "neutral"

        hit = (pred_dir == actual_dir)

        # Build prediction summary
        scores_summary = []
        for key, field, label in [
            ("dxy", "dxy_change_pct", "DXY"),
            ("us10y", "us10y_change_bps", "US10Y"),
            ("vix", "vix_value", "VIX"),
        ]:
            val = yesterday.get(field)
            score = yesterday.get(f"{key}_score", 0)
            if val is not None and score != 0:
                unit = "%" if key != "us10y" else "bp"
                scores_summary.append(f"{label} {val:+.1f}{unit}")

        for key, field, label in [
            ("foreign", "foreign_net_amount", "외국인"),
            ("futures", "futures_net", "선물"),
        ]:
            val = yesterday.get(field)
            score = yesterday.get(f"{key}_score", 0)
            if val is not None and score != 0:
                if key == "foreign":
                    scores_summary.append(f"{label} {val:+,}억")
                else:
                    scores_summary.append(f"{label} {val:+,}계약")

        dir_labels = {"bullish": "상승", "bearish": "하락", "neutral": "중립"}
        level_labels = {1: "🟢 우호적", 2: "🟡 중립", 3: "🔴 경고"}

        pred_summary = ", ".join(scores_summary[:3]) if scores_summary else "데이터 부족"
        pred_level = yesterday.get("safety_level", 2)
        pred_overall = yesterday.get("overall_score", 0)

        # Evaluation comment
        tier_a_avg = sum(yesterday.get(f"{k}_score", 0) for k in ["dxy", "us10y", "vix"]) / 3
        tier_b_avg = sum(yesterday.get(f"{k}_score", 0) for k in ["foreign", "futures", "short"]) / 3

        tier_a_correct = (tier_a_avg > 0 and actual_kospi > 0) or (tier_a_avg < 0 and actual_kospi < 0)
        tier_b_correct = (tier_b_avg > 0 and actual_kospi > 0) or (tier_b_avg < 0 and actual_kospi < 0)

        if tier_a_correct and tier_b_correct:
            eval_comment = "글로벌 + 수급 동조. 높은 예측 신뢰도"
        elif tier_a_correct and not tier_b_correct:
            eval_comment = "글로벌 신호(Tier A)는 정확. 국내 수급이 반대로 움직임 → 선행지표 가중치 상향"
        elif not tier_a_correct and tier_b_correct:
            eval_comment = "글로벌과 무관한 국내 독자 장세. 수급 지표(Tier B) 신뢰도 높았음"
        else:
            eval_comment = "예상 밖 시장 움직임. 외부 이벤트 가능성"

        return {
            "date": str(yesterday.get("date", "")),
            "prediction": {
                "direction": dir_labels.get(pred_dir, "중립"),
                "overall_score": float(pred_overall) if pred_overall else 0,
                "safety_level": pred_level,
                "level_label": level_labels.get(pred_level, "🟡 중립"),
                "summary": pred_summary
            },
            "actual": {
                "kospi_change": float(actual_kospi),
                "foreign_net": int(actual_foreign) if actual_foreign else 0,
                "direction": dir_labels.get(actual_dir, "중립")
            },
            "evaluation": {
                "hit": hit,
                "label": "✅ 적중" if hit else "⚠️ 실패",
                "comment": eval_comment
            }
        }

    # ═══════════════════════════════════════════════════════
    # Main Entry Point
    # ═══════════════════════════════════════════════════════

    def collect_all(self, adjusted_weights: Optional[Dict] = None) -> Dict:
        """6축 전체 수집 + 스코어링 + 종합"""
        logger.info("[MacroDashboard] Starting collection...")

        global_all = self.collect_global_all()
        global_data = global_all["tier_a"]
        foreign = self.collect_foreign_cash()
        futures = self.collect_futures()
        short = self.collect_short_selling()

        scores = {
            "dxy": global_data["dxy"]["score"],
            "us10y": global_data["us10y"]["score"],
            "vix": global_data["vix"]["score"],
            "foreign": foreign["score"],
            "futures": futures["score"],
            "short": short["score"],
        }

        weights = adjusted_weights or DEFAULT_WEIGHTS
        overall, level, interpretation, pred_dir = self.calculate_overall(scores, weights)

        # 한국 날짜
        kr_now = datetime.now(KST)
        kr_date = kr_now.strftime("%Y-%m-%d")

        # Generate chain analysis (needs dates for time context)
        chain_analysis = self.generate_chain_analysis(
            scores, global_data,
            global_all.get("global_markets", self._empty_global_markets()),
            {"foreign_cash": foreign, "futures": futures, "short_selling": short},
            kr_date=kr_date,
            us_market_date=global_all.get("us_market_date", ""),
        )
        kr_day = DAY_NAMES_KR[kr_now.weekday()]

        return {
            "date": kr_date,
            "kr_market_day": kr_day,
            "us_market_date": global_all.get("us_market_date"),
            "us_market_day": global_all.get("us_market_day"),
            "tier_a": global_data,
            "tier_b": {
                "foreign_cash": foreign,
                "futures": futures,
                "short_selling": short,
            },
            "global_markets": global_all.get("global_markets", self._empty_global_markets()),
            "scores": scores,
            "overall_score": overall,
            "safety_level": level,
            "prediction_direction": pred_dir,
            "interpretation": interpretation,
            "chain_analysis": chain_analysis,
            "weights": weights,
            "raw_data": {
                "foreign_raw": foreign.get("raw"),
                "futures_raw": futures.get("raw"),
                "short_raw": short.get("raw"),
            }
        }
