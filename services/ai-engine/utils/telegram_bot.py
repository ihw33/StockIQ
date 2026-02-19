
import os
import requests
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def send_telegram_message(message: str):
    """텔레그램 메시지 전송 (동기)"""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")

    if not token or not chat_id:
        logger.warning("Telegram token or chat_id missing. Skipping message.")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = {"chat_id": chat_id, "text": message}

    try:
        response = requests.post(url, json=data, timeout=5)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")


async def send_notification(message: str):
    """비동기 텔레그램 알림 전송"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, send_telegram_message, message)


# ==================== 알림 헬퍼 ====================

async def notify_sector_collected(date_str: str = None, mode: str = ""):
    """섹터 데이터 수집 완료 알림"""
    date_str = date_str or datetime.now().strftime("%Y-%m-%d %H:%M")
    await send_notification(f"[StockIQ] 섹터 데이터 수집 완료\n일시: {date_str} ({mode.upper()})")


async def notify_report_completed(stock_name: str, report_type: str = "분석"):
    """보고서 생성 완료 알림"""
    await send_notification(f"[StockIQ] {stock_name} {report_type} 보고서 완료")


async def notify_error(context: str, error: str):
    """에러 알림"""
    await send_notification(f"[StockIQ] ⚠️ 오류 발생\n{context}: {error[:100]}")
