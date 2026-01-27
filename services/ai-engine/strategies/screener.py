"""
Custom Stock Screener with Multiple Profiles
사용자 정의 조건으로 KOSPI/KOSDAQ 종목을 필터링합니다.
여러 스크리너 프로필을 지원합니다.
"""

import FinanceDataReader as fdr
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class ScreenerCondition:
    """스크리너 조건"""
    name: str
    description: str
    value: Any = None  # 파라미터 값
    min_value: Any = None
    max_value: Any = None
    enabled: bool = True


@dataclass
class ScreenerProfile:
    """스크리너 프로필"""
    id: str
    name: str
    description: str
    conditions: List[ScreenerCondition] = field(default_factory=list)


@dataclass
class ScreenerResult:
    """스크리너 결과"""
    symbol: str
    name: str
    market: str
    size_class: str  # large, mid, small
    close: float
    change_pct: float
    volume: int
    market_cap: float
    conditions_met: List[str]
    score: int  # 충족 조건 수


def get_size_class(market_cap: float) -> str:
    """시가총액 기준 규모 분류 (억 단위)"""
    if market_cap >= 10000:  # 1조 이상
        return "large"
    elif market_cap >= 3000:  # 3천억 이상
        return "mid"
    else:
        return "small"


# ==== 스크리너 프로필 정의 ====

SCREENER_PROFILES: Dict[str, ScreenerProfile] = {
    "momentum_surge": ScreenerProfile(
        id="momentum_surge",
        name="모멘텀 급등",
        description="전일 급등 후 눌림목 진입 타이밍을 찾는 스크리너",
        conditions=[
            ScreenerCondition("change_min", "최소 등락률 (%)", value=3.0, min_value=0.0, max_value=30.0),
            ScreenerCondition("change_max", "최대 등락률 (%)", value=10.0, min_value=0.0, max_value=30.0),
            ScreenerCondition("not_upper_limit", "상한가 제외", value=True),
            ScreenerCondition("volume_min_ratio", "거래량 배율 (최소)", value=1.5, min_value=1.0, max_value=10.0),
            ScreenerCondition("volume_max_ratio", "거래량 배율 (최대)", value=3.0, min_value=1.0, max_value=10.0),
            ScreenerCondition("bullish_candle", "양봉 조건", value=True),
            ScreenerCondition("upper_wick_pct", "윗꼬리 최소 (%)", value=1.0, min_value=0.0, max_value=10.0),
            ScreenerCondition("above_ma5", "5일선 위", value=True),
            ScreenerCondition("ma5_above_ma20", "정배열 (5>20)", value=True),
            ScreenerCondition("price_min", "최소 가격 (원)", value=3000, min_value=1000, max_value=100000),
            ScreenerCondition("price_max", "최대 가격 (원)", value=30000, min_value=1000, max_value=500000),
            ScreenerCondition("market_cap_min", "최소 시총 (억)", value=1000, min_value=100, max_value=100000),
        ]
    ),
    "value_bounce": ScreenerProfile(
        id="value_bounce",
        name="가치 반등",
        description="과매도 후 반등 시그널을 찾는 스크리너 (준비중)",
        conditions=[
            ScreenerCondition("rsi_max", "RSI 최대", value=30, min_value=10, max_value=50),
            ScreenerCondition("below_ma20", "20일선 아래", value=True),
            ScreenerCondition("volume_surge", "거래량 급증", value=2.0, min_value=1.0, max_value=10.0),
        ]
    ),
    "breakout": ScreenerProfile(
        id="breakout",
        name="신고가 돌파",
        description="52주 신고가 돌파 종목 (준비중)",
        conditions=[
            ScreenerCondition("new_high_52w", "52주 신고가", value=True),
            ScreenerCondition("volume_min_ratio", "거래량 배율", value=2.0, min_value=1.0, max_value=10.0),
        ]
    ),
}


class StockScreener:
    """커스텀 종목 스크리너"""
    
    def __init__(self):
        self.profiles = SCREENER_PROFILES
        self._stock_list_cache = None
        self._cache_date = None
    
    def get_profiles(self) -> List[Dict[str, Any]]:
        """모든 스크리너 프로필 반환"""
        return [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "conditions": [
                    {
                        "name": c.name,
                        "description": c.description,
                        "value": c.value,
                        "min_value": c.min_value,
                        "max_value": c.max_value,
                        "enabled": c.enabled,
                    }
                    for c in p.conditions
                ]
            }
            for p in self.profiles.values()
        ]
    
    def get_profile(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """특정 프로필 반환"""
        if profile_id not in self.profiles:
            return None
        p = self.profiles[profile_id]
        return {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "conditions": [
                {
                    "name": c.name,
                    "description": c.description,
                    "value": c.value,
                    "min_value": c.min_value,
                    "max_value": c.max_value,
                    "enabled": c.enabled,
                }
                for c in p.conditions
            ]
        }
    
    def get_stock_list(self, markets: List[str] = ["KOSPI", "KOSDAQ"]) -> pd.DataFrame:
        """종목 리스트 가져오기 (캐시 사용)"""
        today = datetime.now().date()
        
        if self._stock_list_cache is not None and self._cache_date == today:
            return self._stock_list_cache
        
        all_stocks = []
        for market in markets:
            try:
                df = fdr.StockListing(market)
                df['Market'] = market
                all_stocks.append(df)
            except Exception as e:
                logger.error(f"Failed to get {market} listing: {e}")
        
        if all_stocks:
            self._stock_list_cache = pd.concat(all_stocks, ignore_index=True)
            self._cache_date = today
            return self._stock_list_cache
        
        return pd.DataFrame()
    
    def get_stock_data(self, symbol: str, days: int = 30) -> Optional[pd.DataFrame]:
        """개별 종목 데이터 가져오기"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days + 10)  # 여유 있게 가져오기
            
            df = fdr.DataReader(symbol, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            
            if df is None or len(df) < 5:
                return None
            
            return df.tail(days)
        except Exception as e:
            logger.debug(f"Failed to get data for {symbol}: {e}")
            return None
    
    def check_momentum_surge(self, symbol: str, name: str, market: str, 
                             df: pd.DataFrame, market_cap: float,
                             params: Dict[str, Any]) -> Optional[ScreenerResult]:
        """모멘텀 급등 조건 체크"""
        if len(df) < 21:  # 최소 21일 데이터 필요
            return None
        
        # 파라미터 추출
        change_min = params.get("change_min", 3.0)
        change_max = params.get("change_max", 10.0)
        volume_min_ratio = params.get("volume_min_ratio", 1.5)
        volume_max_ratio = params.get("volume_max_ratio", 3.0)
        upper_wick_pct = params.get("upper_wick_pct", 1.0)
        price_min = params.get("price_min", 3000)
        price_max = params.get("price_max", 30000)
        market_cap_min = params.get("market_cap_min", 1000)
        
        # 최근 데이터
        today = df.iloc[-1]
        
        close = today['Close']
        open_price = today['Open']
        high = today['High']
        volume = today['Volume']
        
        # 전일 종가 대비 등락률
        if len(df) >= 2:
            prev_close = df.iloc[-2]['Close']
            change_pct = ((close - prev_close) / prev_close) * 100 if prev_close > 0 else 0
        else:
            change_pct = 0
        
        # 20일 평균 거래량
        vol_20d_avg = df['Volume'].tail(20).mean()
        
        # 5일선, 20일선
        ma5 = df['Close'].tail(5).mean()
        ma20 = df['Close'].tail(20).mean()
        
        # 상한가 (전일 종가 기준 +30%)
        if len(df) >= 2:
            prev_close = df.iloc[-2]['Close']
            upper_limit = prev_close * 1.30
        else:
            upper_limit = close * 1.30
        
        conditions_met = []
        
        # ① 전일 등락률 조건
        if change_min <= change_pct <= change_max:
            conditions_met.append("change_range")
        
        # ② 전일 종가 < 상한가
        if params.get("not_upper_limit", True) and close < upper_limit:
            conditions_met.append("not_upper_limit")
        
        # ③ 전일 거래량 >= 평균 * min_ratio
        if volume >= vol_20d_avg * volume_min_ratio:
            conditions_met.append("volume_min")
        
        # ④ 전일 거래량 <= 평균 * max_ratio
        if volume <= vol_20d_avg * volume_max_ratio:
            conditions_met.append("volume_max")
        
        # ⑤ 양봉
        if params.get("bullish_candle", True) and close >= open_price:
            conditions_met.append("bullish_candle")
        
        # ⑥ 윗꼬리
        if high > 0 and ((high - close) / high) >= (upper_wick_pct / 100):
            conditions_met.append("upper_wick")
        
        # ⑦ 5일선 위
        if params.get("above_ma5", True) and close > ma5:
            conditions_met.append("above_ma5")
        
        # ⑧ 정배열
        if params.get("ma5_above_ma20", True) and ma5 > ma20:
            conditions_met.append("ma5_above_ma20")
        
        # ⑨ 가격 범위
        if price_min <= close <= price_max:
            conditions_met.append("price_range")
        
        # ⑩ 시가총액
        if market_cap >= market_cap_min:
            conditions_met.append("market_cap")
        
        return ScreenerResult(
            symbol=symbol,
            name=name,
            market=market,
            close=close,
            change_pct=change_pct,
            volume=int(volume),
            market_cap=market_cap,
            conditions_met=conditions_met,
            score=len(conditions_met)
        )
    
    def run_screen(self, profile_id: str = "momentum_surge", 
                   params: Optional[Dict[str, Any]] = None,
                   min_score: int = 10, 
                   max_stocks: int = 500,
                   markets: Optional[List[str]] = None,
                   size_classes: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        스크리닝 실행
        
        Args:
            profile_id: 스크리너 프로필 ID
            params: 파라미터 오버라이드 (없으면 기본값 사용)
            min_score: 최소 충족 조건 수
            max_stocks: 최대 검사 종목 수
            markets: 마켓 필터 (["KOSPI", "KOSDAQ"] 등)
            size_classes: 규모 필터 (["large", "mid", "small"] 등)
        """
        logger.info(f"Starting screener '{profile_id}' with min_score={min_score}, max_stocks={max_stocks}, markets={markets}, size_classes={size_classes}")
        
        # 프로필에서 기본 파라미터 가져오기
        profile = self.profiles.get(profile_id)
        if not profile:
            logger.error(f"Unknown profile: {profile_id}")
            return []
        
        # 기본 파라미터 구성
        default_params = {c.name: c.value for c in profile.conditions}
        
        # 사용자 파라미터로 오버라이드
        if params:
            default_params.update(params)
        
        stock_list = self.get_stock_list()
        
        if stock_list.empty:
            logger.error("Failed to get stock list")
            return []
        
        results = []
        checked = 0
        
        # 가격/시총 필터용 파라미터
        price_min = default_params.get("price_min", 3000)
        price_max = default_params.get("price_max", 30000)
        market_cap_min = default_params.get("market_cap_min", 1000)
        
        for _, row in stock_list.iterrows():
            if checked >= max_stocks:
                break
            
            symbol = row.get('Code', row.get('Symbol', ''))
            name = row.get('Name', '')
            market = row.get('Market', 'KOSPI')
            
            # 타입 변환 (문자열일 수 있음)
            try:
                market_cap_raw = row.get('Marcap', 0)
                market_cap = float(market_cap_raw) / 100000000 if market_cap_raw else 0  # 원 -> 억
            except (ValueError, TypeError):
                market_cap = 0
            
            if not symbol or not name:
                continue
            
            # 시가총액 필터
            if market_cap < market_cap_min:
                continue
            
            # 가격 필터 (종목 리스트에 Close가 있으면 사용)
            try:
                close_price = float(row.get('Close', 0))
            except (ValueError, TypeError):
                close_price = 0
            
            if close_price > 0 and (close_price < price_min or close_price > price_max):
                continue
            
            checked += 1
            
            # 개별 종목 데이터 가져오기
            df = self.get_stock_data(symbol)
            
            if df is None:
                continue
            
            # 프로필에 따른 조건 체크
            if profile_id == "momentum_surge":
                result = self.check_momentum_surge(symbol, name, market, df, market_cap, default_params)
            else:
                # 다른 프로필은 아직 미구현
                continue
            
            if result and result.score >= min_score:
                results.append({
                    "symbol": result.symbol,
                    "name": result.name,
                    "market": result.market,
                    "close": result.close,
                    "change_pct": round(result.change_pct, 2),
                    "volume": result.volume,
                    "market_cap": round(result.market_cap, 0),
                    "conditions_met": result.conditions_met,
                    "score": result.score,
                })
        
        # 점수 높은 순으로 정렬
        results.sort(key=lambda x: (-x["score"], -x["change_pct"]))
        
        logger.info(f"Screener completed. Checked {checked} stocks, found {len(results)} matches")
        
        return results
    
    def get_conditions_info(self, profile_id: str = "momentum_surge") -> List[Dict[str, Any]]:
        """조건 정보 반환"""
        profile = self.profiles.get(profile_id)
        if not profile:
            return []
        
        return [
            {
                "name": c.name,
                "description": c.description,
                "value": c.value,
                "min_value": c.min_value,
                "max_value": c.max_value,
                "enabled": c.enabled
            }
            for c in profile.conditions
        ]


# 싱글톤 인스턴스
_screener_instance = None

def get_screener() -> StockScreener:
    global _screener_instance
    if _screener_instance is None:
        _screener_instance = StockScreener()
    return _screener_instance


async def run_custom_screen(
    profile_id: str = "momentum_surge",
    params: Optional[Dict[str, Any]] = None,
    min_score: int = 10, 
    max_stocks: int = 500
) -> Dict[str, Any]:
    """스크리너 실행 (API용)"""
    screener = get_screener()
    results = screener.run_screen(
        profile_id=profile_id, 
        params=params,
        min_score=min_score, 
        max_stocks=max_stocks
    )
    
    profile = screener.get_profile(profile_id)
    
    return {
        "timestamp": datetime.now().isoformat(),
        "profile": profile,
        "conditions": screener.get_conditions_info(profile_id),
        "min_score": min_score,
        "total_matches": len(results),
        "results": results
    }


async def get_screener_profiles() -> List[Dict[str, Any]]:
    """스크리너 프로필 목록 반환 (API용)"""
    screener = get_screener()
    return screener.get_profiles()
