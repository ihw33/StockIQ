
import os
import requests
import logging

logger = logging.getLogger(__name__)

def send_telegram_message(message: str):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        logger.warning("Telegram token or chat_id missing. Skipping message.")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = {
        "chat_id": chat_id,
        "text": message
    }

    try:
        response = requests.post(url, json=data, timeout=5)
        response.raise_for_status()
        # logger.info(f"Telegram Sent: {message}")
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")
