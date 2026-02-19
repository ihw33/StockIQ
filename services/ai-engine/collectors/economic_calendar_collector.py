"""
EconomicCalendarCollector: 주요 경제지표 발표 일정 수집
- ForexFactory (faireconomy.media) → USD High/Medium 경제지표
"""
import time
import requests
import logging
from datetime import datetime
from typing import Dict, List

logger = logging.getLogger(__name__)

FOREXFACTORY_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"


def collect_economic_events(max_retries: int = 2) -> List[Dict]:
    """ForexFactory에서 이번 주 경제지표 일정 수집 (USD High/Medium)"""
    for attempt in range(max_retries + 1):
        try:
            resp = requests.get(
                FOREXFACTORY_URL,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
                timeout=20,
            )
            resp.raise_for_status()

            # Rate limit 응답 체크 (HTML 반환 시)
            content_type = resp.headers.get("Content-Type", "")
            if "json" not in content_type:
                logger.warning(f"[Calendar] Non-JSON response (attempt {attempt+1}), retrying...")
                if attempt < max_retries:
                    time.sleep(3)
                    continue
                return []

            events = resp.json()

            result = []
            for e in events:
                if e.get("country") != "USD":
                    continue
                if e.get("impact") not in ("High", "Medium"):
                    continue
                result.append({
                    "title": e.get("title", ""),
                    "date": e.get("date", ""),
                    "impact": e.get("impact", ""),
                    "forecast": e.get("forecast", ""),
                    "previous": e.get("previous", ""),
                })

            logger.info(f"[Calendar] Economic events: {len(result)} USD High/Medium")
            return result
        except Exception as e:
            logger.warning(f"[Calendar] ForexFactory error (attempt {attempt+1}): {e}")
            if attempt < max_retries:
                time.sleep(3)

    return []


def collect_calendar() -> Dict:
    """경제지표 일정 수집"""
    economic = collect_economic_events()

    return {
        "economic_events": economic,
        "collected_at": datetime.now().isoformat(),
    }
