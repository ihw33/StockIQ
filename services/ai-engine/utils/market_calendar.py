"""
한국 주식시장 개장일 유틸리티
- 주말 체크
- 한국 공휴일 체크 (holidays 라이브러리)
- 장 시간 체크 (09:00~15:30 KST)
"""
from datetime import datetime, date
from zoneinfo import ZoneInfo
import holidays

KST = ZoneInfo('Asia/Seoul')

# 한국 공휴일 캐시 (연도별)
_kr_holidays_cache: dict = {}


def get_kr_holidays(year: int):
    if year not in _kr_holidays_cache:
        _kr_holidays_cache[year] = holidays.KR(years=year)
    return _kr_holidays_cache[year]


def is_trading_day(target_date: date = None) -> bool:
    """
    해당 날짜가 거래일인지 확인
    - 주말 제외
    - 한국 공휴일 제외
    """
    if target_date is None:
        target_date = datetime.now(KST).date()

    # 주말 체크
    if target_date.weekday() >= 5:  # 5=토, 6=일
        return False

    # 공휴일 체크
    kr_holidays = get_kr_holidays(target_date.year)
    if target_date in kr_holidays:
        return False

    return True


def is_market_open() -> bool:
    """
    현재 시각 기준 장 개장 여부
    - 거래일 + 09:00~15:30 KST
    """
    now = datetime.now(KST)
    today = now.date()

    if not is_trading_day(today):
        return False

    hour = now.hour
    minute = now.minute

    if hour < 9 or hour > 15:
        return False
    if hour == 15 and minute > 30:
        return False

    return True


def get_holiday_name(target_date: date) -> str | None:
    """공휴일이면 공휴일 이름 반환, 아니면 None"""
    if target_date.weekday() == 5:
        return "토요일"
    if target_date.weekday() == 6:
        return "일요일"

    kr_holidays = get_kr_holidays(target_date.year)
    return kr_holidays.get(target_date)


def get_market_status(target_date: date = None) -> dict:
    """
    날짜의 시장 상태 반환
    {
        'is_trading_day': bool,
        'reason': str | None  # 쉬는 이유 (토요일/일요일/공휴일명)
    }
    """
    if target_date is None:
        target_date = datetime.now(KST).date()

    holiday_name = get_holiday_name(target_date)
    if holiday_name:
        return {'is_trading_day': False, 'reason': holiday_name}

    return {'is_trading_day': True, 'reason': None}
