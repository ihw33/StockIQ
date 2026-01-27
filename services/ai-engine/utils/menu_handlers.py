"""
Telegram Interactive Menu Handlers
/m 명령어 기반 인터랙티브 메뉴 시스템
"""
import logging
from telegram import Update
from telegram.ext import ContextTypes
from config.trading_config import config

logger = logging.getLogger(__name__)

# 사용자별 메뉴 상태
user_states = {}


def get_state(user_id: int) -> dict:
    """사용자 상태 가져오기"""
    if user_id not in user_states:
        user_states[user_id] = {
            "menu": "main",
            "selected_stock": None,
            "pending_action": None,
        }
    return user_states[user_id]


def reset_state(user_id: int):
    """메뉴 상태 초기화"""
    user_states[user_id] = {
        "menu": "main",
        "selected_stock": None,
        "pending_action": None,
    }


# ============================================================
# 메뉴 렌더링
# ============================================================

def render_main_menu() -> str:
    """메인 메뉴"""
    return (
        "🤖 StockIQ 설정\n\n"
        "1. 📊 보유 종목 관리\n"
        "2. 🎯 신규 매수 설정\n"
        "3. ⚙️ 전체 설정\n"
        "4. 📈 현재 상태\n\n"
        "0. 종료\n\n"
        "👉 번호 입력:"
    )


def render_holdings_menu(holdings: list) -> str:
    """보유 종목 목록"""
    if not holdings:
        return (
            "📊 보유 종목\n\n"
            "보유 중인 종목이 없습니다.\n\n"
            "0. ⬅️ 뒤로\n\n"
            "👉 번호:"
        )
    
    lines = ["📊 보유 종목\n"]
    for i, h in enumerate(holdings, 1):
        name = h.get('stk_nm', 'N/A')
        pl_rt = float(h.get('pl_rt', 0))
        sign = "+" if pl_rt >= 0 else ""
        lines.append(f"{i}. {name}  {sign}{pl_rt}%")
    
    lines.append("\n0. ⬅️ 뒤로\n")
    lines.append("👉 종목 번호:")
    return "\n".join(lines)


def render_stock_detail(stock_info: dict, symbol: str) -> str:
    """종목 상세 메뉴"""
    name = stock_info.get('stk_nm', symbol)
    pl_rt = float(stock_info.get('pl_rt', 0))
    sign = "+" if pl_rt >= 0 else ""
    
    stock_config = config.get_stock_config(symbol)
    tpr = stock_config['take_profit_rate']
    slr = stock_config['stop_loss_rate']
    
    return (
        f"📌 {name} {sign}{pl_rt}%\n\n"
        f"1. 익절 기준 변경 [현재: {tpr}%]\n"
        f"2. 손절 기준 변경 [현재: {slr}%]\n"
        f"3. 🔴 즉시 매도 (시장가)\n\n"
        f"0. ⬅️ 뒤로\n\n"
        f"👉 번호:"
    )


def render_value_select(param_name: str, current_value: float, value_type: str = "default") -> str:
    """값 선택 메뉴"""
    if value_type == "stop_loss":
        # 손절은 1%부터
        options = "1. 1%\n2. 2%\n3. 3%\n4. 5%\n5. 7%\n6. 직접 입력"
    else:
        # 익절/매수비율은 3%부터
        options = "1. 3%\n2. 5%\n3. 7%\n4. 10%\n5. 15%\n6. 직접 입력"
    
    return (
        f"📌 {param_name}\n\n"
        f"현재: {current_value}%\n\n"
        f"{options}\n\n"
        "👉 번호 또는 값:"
    )


def render_new_buy_settings() -> str:
    """신규 매수 설정 메뉴"""
    order_type_kr = "지정가" if config.buy_order_type == "limit" else "시장가"
    return (
        "🎯 신규 매수 설정\n\n"
        "조건검색 포착 시 적용됩니다.\n\n"
        f"1. 매수 비율 [{config.buy_ratio}%]\n"
        f"2. 익절 기준 [{config.take_profit_rate}%]\n"
        f"3. 손절 기준 [{config.stop_loss_rate}%]\n"
        f"4. 주문 타입 [{order_type_kr}]\n"
        f"5. 조건식 번호 [{config.condition_seq}번]\n\n"
        "0. ⬅️ 뒤로\n\n"
        "👉 번호:"
    )


def render_global_settings() -> str:
    """전체 설정 메뉴"""
    order_type_kr = "지정가" if config.buy_order_type == "limit" else "시장가"
    min_amt = int(config.min_buy_amount / 10000)
    return (
        "⚙️ 전체 설정\n\n"
        f"1. 매수 비율     [{config.buy_ratio}%]\n"
        f"2. 익절 기준     [{config.take_profit_rate}%]\n"
        f"3. 손절 기준     [{config.stop_loss_rate}%]\n"
        f"4. 주문 타입     [{order_type_kr}]\n"
        f"5. 최대 종목수   [{config.max_position_count}개]\n"
        f"6. 최소 금액     [{min_amt}만원]\n\n"
        "0. ⬅️ 뒤로\n\n"
        "👉 번호:"
    )


def render_order_type_select() -> str:
    """주문 타입 선택"""
    return (
        "🔧 주문 타입 선택\n\n"
        f"현재: {'지정가' if config.buy_order_type == 'limit' else '시장가'}\n\n"
        "1. 지정가 (현재 매도1호가)\n"
        "2. 시장가 (즉시 체결)\n\n"
        "👉 번호:"
    )


# ============================================================
# 값 매핑
# ============================================================

PRESET_VALUES = {
    "1": 3.0,
    "2": 5.0,
    "3": 7.0,
    "4": 10.0,
    "5": 15.0,
}

PRESET_VALUES_STOP_LOSS = {
    "1": 1.0,
    "2": 2.0,
    "3": 3.0,
    "4": 5.0,
    "5": 7.0,
}


def parse_value_input(text: str, value_type: str = "default") -> float | None:
    """입력값 파싱 (프리셋 또는 직접 입력)"""
    # 전처리: 공백, %, 마이너스 등 제거
    text = text.strip()
    text = text.replace('%', '').replace('％', '')  # % 기호 제거
    text = text.replace(' ', '')  # 공백 제거
    text = text.lstrip('-')  # 앞의 마이너스 제거 (손절은 자동으로 음수 처리)
    text = text.lstrip('+')  # 앞의 플러스 제거
    
    # 프리셋 번호 (타입에 따라 다른 매핑)
    presets = PRESET_VALUES_STOP_LOSS if value_type == "stop_loss" else PRESET_VALUES
    if text in presets:
        return presets[text]
    
    # 직접 입력 (숫자)
    try:
        val = float(text)
        if 0.1 <= val <= 50:
            return val
    except ValueError:
        pass
    
    return None

