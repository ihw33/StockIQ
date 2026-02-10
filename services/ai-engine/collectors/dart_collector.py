"""
DartCollector: DART OpenAPI 기반 보유종목 공시 수집
- 종목코드 → DART corp_code 매핑
- 최근 N일 공시 검색 (/api/list.json)
- LLM 프롬프트용 텍스트 포맷
"""
import os
import requests
import logging
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

DART_API_KEY = os.getenv("DART_API_KEY")
DART_BASE_URL = "https://opendart.fss.or.kr/api"

# 종목코드 → DART corp_code 매핑 캐시
_corp_code_map: Dict[str, str] = {}
_corp_code_loaded_date: Optional[str] = None


def _load_corp_code_map() -> Dict[str, str]:
    """DART corp_code.xml 다운로드 후 {종목코드: corp_code} 매핑 반환 (1일 1회 캐싱)"""
    global _corp_code_map, _corp_code_loaded_date

    today = datetime.now().strftime("%Y-%m-%d")
    if _corp_code_map and _corp_code_loaded_date == today:
        return _corp_code_map

    if not DART_API_KEY:
        logger.warning("[DART] DART_API_KEY not set")
        return {}

    cache_path = "/tmp/dart_corp_code.zip"

    try:
        # 캐시 파일이 오늘 것인지 확인
        need_download = True
        if os.path.exists(cache_path):
            mtime = datetime.fromtimestamp(os.path.getmtime(cache_path))
            if mtime.strftime("%Y-%m-%d") == today:
                need_download = False

        if need_download:
            resp = requests.get(
                f"{DART_BASE_URL}/corpCode.xml",
                params={"crtfc_key": DART_API_KEY},
                timeout=30,
            )
            resp.raise_for_status()
            with open(cache_path, "wb") as f:
                f.write(resp.content)
            logger.info(f"[DART] corp_code.xml 다운로드 완료 ({len(resp.content)} bytes)")

        # ZIP 파싱
        mapping = {}
        with zipfile.ZipFile(cache_path) as z:
            with z.open(z.namelist()[0]) as f:
                tree = ET.parse(f)
                root = tree.getroot()
                for corp in root.findall(".//list"):
                    stock_code = corp.findtext("stock_code", "").strip()
                    corp_code = corp.findtext("corp_code", "").strip()
                    if stock_code and corp_code:
                        mapping[stock_code] = corp_code

        _corp_code_map = mapping
        _corp_code_loaded_date = today
        logger.info(f"[DART] corp_code 매핑 로드: {len(mapping)}개 상장사")
        return mapping

    except Exception as e:
        logger.error(f"[DART] corp_code 로드 실패: {e}")
        return _corp_code_map or {}


def collect_dart_filings(symbols: List[dict], days: int = 3) -> dict:
    """
    보유종목의 최근 공시 수집

    Args:
        symbols: [{"symbol": "005930", "name": "삼성전자"}, ...]
        days: 조회 기간 (기본 3일)

    Returns:
        {"filings_text": str, "filings": list}
    """
    if not DART_API_KEY:
        logger.warning("[DART] DART_API_KEY not set")
        return {"filings_text": "", "filings": []}

    if not symbols:
        return {"filings_text": "", "filings": []}

    corp_map = _load_corp_code_map()
    if not corp_map:
        return {"filings_text": "", "filings": []}

    end_date = datetime.now().strftime("%Y%m%d")
    bgn_date = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")

    all_filings = []
    for sym in symbols:
        stock_code = sym.get("symbol", "")
        name = sym.get("name", stock_code)
        corp_code = corp_map.get(stock_code)

        if not corp_code:
            continue

        try:
            resp = requests.get(
                f"{DART_BASE_URL}/list.json",
                params={
                    "crtfc_key": DART_API_KEY,
                    "corp_code": corp_code,
                    "bgn_de": bgn_date,
                    "end_de": end_date,
                    "page_count": 10,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") != "000":
                continue

            for item in data.get("list", []):
                report_nm = item.get("report_nm", "").strip()
                rcept_dt = item.get("rcept_dt", "")
                # 날짜 포맷: YYYYMMDD → MM/DD
                date_str = f"{rcept_dt[4:6]}/{rcept_dt[6:8]}" if len(rcept_dt) == 8 else rcept_dt

                all_filings.append({
                    "symbol": stock_code,
                    "name": name,
                    "date": date_str,
                    "title": report_nm,
                    "rcept_no": item.get("rcept_no", ""),
                })

        except Exception as e:
            logger.warning(f"[DART] {name}({stock_code}) 공시 조회 실패: {e}")

    # 텍스트 포맷 (LLM 프롬프트용)
    if not all_filings:
        filings_text = "최근 3일 내 공시 없음"
    else:
        lines = []
        for f in all_filings:
            lines.append(f"[{f['name']}] {f['date']} {f['title']}")
        filings_text = "\n".join(lines)

    logger.info(f"[DART] 공시 수집 완료: {len(all_filings)}건 ({len(symbols)}종목)")
    return {"filings_text": filings_text, "filings": all_filings}
