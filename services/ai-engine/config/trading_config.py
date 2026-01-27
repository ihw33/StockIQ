"""
TradingConfig - 자동매매 파라미터 중앙 관리
"""
import logging

logger = logging.getLogger(__name__)


class TradingConfig:
    """중앙 집중식 매매 파라미터 관리"""
    
    _instance = None  # Singleton
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        
        # 매수 설정
        self.buy_ratio = 5.0           # 예수금 대비 매수 비율 (%)
        self.buy_order_type = "limit"  # "limit"(지정가) or "market"(시장가)
        self.min_buy_amount = 50000    # 최소 매수 금액 (원)
        self.max_position_count = 10   # 최대 보유 종목 수
        
        # 익절/손절 설정 (기본값)
        self.take_profit_rate = 5.0    # 익절 기준 (%)
        self.stop_loss_rate = -5.0     # 손절 기준 (%)
        
        # 조건검색
        self.condition_seq = "0"       # 조건검색식 번호
        
        # 종목별 개별 설정 (symbol_code -> config dict)
        self.stock_overrides = {}
        
        logger.info("TradingConfig initialized with defaults")
    
    def get_stock_config(self, symbol: str) -> dict:
        """종목별 설정 반환 (개별설정 우선, 없으면 기본값)"""
        base = {
            "take_profit_rate": self.take_profit_rate,
            "stop_loss_rate": self.stop_loss_rate,
        }
        if symbol in self.stock_overrides:
            base.update(self.stock_overrides[symbol])
        return base
    
    def set_stock_override(self, symbol: str, key: str, value):
        """종목별 개별 설정"""
        if symbol not in self.stock_overrides:
            self.stock_overrides[symbol] = {}
        self.stock_overrides[symbol][key] = value
        logger.info(f"Stock override: {symbol} {key}={value}")
    
    def clear_stock_override(self, symbol: str):
        """종목별 개별 설정 초기화"""
        if symbol in self.stock_overrides:
            del self.stock_overrides[symbol]
    
    def to_summary(self) -> str:
        """현재 설정 요약"""
        order_type_kr = "지정가" if self.buy_order_type == "limit" else "시장가"
        return (
            f"⚙️ 현재 설정\n\n"
            f"💰 매수: {self.buy_ratio}% | {order_type_kr}\n"
            f"📈 익절: +{self.take_profit_rate}%\n"
            f"📉 손절: {self.stop_loss_rate}%\n"
            f"📋 조건식: {self.condition_seq}번\n\n"
            f"0. ⬅️ 뒤로\n\n"
            f"👉 번호:"
        )


# 전역 인스턴스
config = TradingConfig()
