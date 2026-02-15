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


# KSIC 주요 업종코드 → 업종명 매핑
_KSIC_MAP: Dict[str, str] = {
    "011": "식료품", "012": "음료", "013": "담배", "014": "섬유",
    "020": "의복·모피", "021": "가죽·가방·신발", "022": "목재·나무",
    "023": "펄프·종이", "024": "인쇄·기록매체", "025": "코크스·석유",
    "026": "화학물질·화학제품", "027": "의료용 물질·의약품",
    "028": "고무·플라스틱", "029": "비금속 광물",
    "030": "1차 금속", "031": "금속가공", "032": "전자부품·컴퓨터",
    "033": "의료·정밀·광학기기", "034": "전기장비",
    "035": "기타 기계·장비", "036": "자동차·트레일러",
    "037": "기타 운송장비", "038": "가구", "039": "기타 제조업",
    "041": "전기·가스·증기", "042": "수도사업", "045": "건설업",
    "046": "도매·소매", "049": "운수업", "052": "출판·영상·통신",
    "058": "금융업", "062": "부동산업", "063": "전문·과학·기술",
    "064": "사업시설관리", "070": "교육서비스", "085": "보건·사회복지",
    "090": "예술·스포츠·여가", "095": "기타 서비스",
    "261": "반도체", "262": "전자부품", "263": "컴퓨터·주변장치",
    "264": "통신·방송장비", "265": "영상·음향기기",
    "271": "의약품", "272": "의료기기",
    "291": "자동차 부품", "292": "조선",
    "301": "전력", "351": "소프트웨어", "352": "IT 서비스",
    "461": "종합 무역", "501": "통신", "502": "방송",
    "521": "인터넷·포털", "522": "게임",
    "601": "은행", "602": "증권", "603": "보험", "604": "기타 금융",
}


# 기업개황 캐시 (메모리, 1일)
_company_overview_cache: Dict[str, dict] = {}
_company_overview_date: Optional[str] = None


def get_company_overview(stock_code: str) -> Optional[dict]:
    """
    DART 기업개황 API로 기업 기본정보 조회
    Returns: {corp_name, ceo_nm, induty_code, induty_name, est_dt, hm_url, ...}
    """
    global _company_overview_cache, _company_overview_date

    if not DART_API_KEY:
        logger.warning("[DART] DART_API_KEY not set")
        return None

    today = datetime.now().strftime("%Y-%m-%d")
    if _company_overview_date != today:
        _company_overview_cache = {}
        _company_overview_date = today

    if stock_code in _company_overview_cache:
        return _company_overview_cache[stock_code]

    corp_map = _load_corp_code_map()
    corp_code = corp_map.get(stock_code)
    if not corp_code:
        logger.warning(f"[DART] corp_code not found for {stock_code}")
        return None

    try:
        resp = requests.get(
            f"{DART_BASE_URL}/company.json",
            params={"crtfc_key": DART_API_KEY, "corp_code": corp_code},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "000":
            logger.warning(f"[DART] company.json error: {data.get('message')}")
            return None

        induty_code = data.get("induty_code", "")
        induty_name = _KSIC_MAP.get(induty_code, induty_code)

        result = {
            "corp_name": data.get("corp_name", ""),
            "stock_name": data.get("stock_name", ""),
            "ceo_nm": data.get("ceo_nm", ""),
            "induty_code": induty_code,
            "induty_name": induty_name,
            "est_dt": data.get("est_dt", ""),
            "hm_url": data.get("hm_url", ""),
            "acc_mt": data.get("acc_mt", ""),
            "adres": data.get("adres", ""),
        }
        _company_overview_cache[stock_code] = result
        logger.info(f"[DART] 기업개황 조회: {result['corp_name']} ({induty_name})")
        return result

    except Exception as e:
        logger.error(f"[DART] 기업개황 조회 실패 ({stock_code}): {e}")
        return None


# 재무제표 캐시 (메모리, 1일)
_financial_statement_cache: Dict[str, dict] = {}
_financial_statement_date: Optional[str] = None


def get_financial_statement(stock_code: str) -> Optional[dict]:
    """
    DART 단일회사 전체 재무제표 API로 Q1+Q2+Q3 합산하여 누적 데이터 조회
    Returns: {
        'revenue': int,  # 매출액 (원, Q1+Q2+Q3 누적)
        'operating_profit': int,  # 영업이익 (원, Q1+Q2+Q3 누적)
        'operating_profit_growth': float,  # 영업이익증가율 (%, 전년 동기 대비)
        'year': str,  # 회계연도
        'quarter': str,  # "Q1-Q3 누적" 또는 "Annual"
    }
    """
    global _financial_statement_cache, _financial_statement_date

    if not DART_API_KEY:
        logger.warning("[DART] DART_API_KEY not set")
        return None

    today = datetime.now().strftime("%Y-%m-%d")
    if _financial_statement_date != today:
        _financial_statement_cache = {}
        _financial_statement_date = today

    if stock_code in _financial_statement_cache:
        return _financial_statement_cache[stock_code]

    corp_map = _load_corp_code_map()
    corp_code = corp_map.get(stock_code)
    if not corp_code:
        logger.warning(f"[DART] corp_code not found for {stock_code}")
        return None

    current_year = datetime.now().year

    # Helper function to fetch quarter data
    def fetch_quarter(year: str, reprt_code: str, fs_div: str = "CFS") -> tuple:
        """Returns (revenue, operating_profit) or (0, 0) if not found"""
        try:
            resp = requests.get(
                f"{DART_BASE_URL}/fnlttSinglAcntAll.json",
                params={
                    "crtfc_key": DART_API_KEY,
                    "corp_code": corp_code,
                    "bsns_year": year,
                    "reprt_code": reprt_code,
                    "fs_div": fs_div,
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") != "000":
                return (0, 0)

            revenue = 0
            operating_profit = 0

            for item in data.get("list", []):
                sj_div = item.get("sj_div", "")
                if sj_div not in ["IS", "CIS"]:
                    continue

                account_nm = item.get("account_nm", "").strip()
                thstrm_amount = item.get("thstrm_amount", "")

                # 매출액
                if account_nm in ["매출액", "수익(매출액)", "매출"]:
                    try:
                        revenue = int(str(thstrm_amount).replace(",", "")) if thstrm_amount and thstrm_amount != '-' else 0
                    except:
                        pass

                # 영업이익
                if account_nm in ["영업이익", "영업이익(손실)"]:
                    try:
                        operating_profit = int(str(thstrm_amount).replace(",", "")) if thstrm_amount and thstrm_amount != '-' else 0
                    except:
                        pass

            return (revenue, operating_profit)
        except:
            return (0, 0)

    try:
        # 1. 최신 연도 결정 (2025년 또는 2024년)
        # 현재 월이 4월 이전이면 전년도 사용
        target_year = str(current_year - 1)  # 2025

        # 2. Q1, Q2, Q3 조회 (CFS 우선, 없으면 OFS)
        fs_div = "CFS"
        q1_rev, q1_op = fetch_quarter(target_year, "11013", fs_div)
        q2_rev, q2_op = fetch_quarter(target_year, "11012", fs_div)
        q3_rev, q3_op = fetch_quarter(target_year, "11014", fs_div)

        # CFS에 데이터가 없으면 OFS 시도
        if q1_rev == 0 and q2_rev == 0 and q3_rev == 0:
            fs_div = "OFS"
            q1_rev, q1_op = fetch_quarter(target_year, "11013", fs_div)
            q2_rev, q2_op = fetch_quarter(target_year, "11012", fs_div)
            q3_rev, q3_op = fetch_quarter(target_year, "11014", fs_div)

        # 3. 합산
        revenue_cumulative = q1_rev + q2_rev + q3_rev
        operating_profit_cumulative = q1_op + q2_op + q3_op

        print(f"[DART-DEBUG] {target_year} Q1+Q2+Q3 합산: 매출 {revenue_cumulative/1000000000000:.1f}조, 영업이익 {operating_profit_cumulative/1000000000000:.1f}조 ({fs_div})")
        print(f"[DART-DEBUG]   Q1: {q1_rev/1000000000000:.1f}조 / Q2: {q2_rev/1000000000000:.1f}조 / Q3: {q3_rev/1000000000000:.1f}조")

        # 데이터가 없으면 연간 보고서 시도
        if revenue_cumulative == 0:
            print(f"[DART-DEBUG] 분기 데이터 없음, 연간 보고서 조회 시도")
            annual_year = str(current_year - 2)  # 2024
            revenue_cumulative, operating_profit_cumulative = fetch_quarter(annual_year, "11011", fs_div)

            if revenue_cumulative > 0:
                target_year = annual_year
                quarter_label = "Annual"
            else:
                logger.warning(f"[DART] No financial data found for {stock_code}")
                return None
        else:
            # 가장 최근 분기 결정
            if q3_rev > 0:
                quarter_label = "Q1-Q3 누적"
            elif q2_rev > 0:
                quarter_label = "Q1-Q2 누적"
            else:
                quarter_label = "Q1"

        # 4. 전년 동기 대비 증가율 계산
        prev_year = str(int(target_year) - 1)
        prev_q1_rev, prev_q1_op = fetch_quarter(prev_year, "11013", fs_div)
        prev_q2_rev, prev_q2_op = fetch_quarter(prev_year, "11012", fs_div)
        prev_q3_rev, prev_q3_op = fetch_quarter(prev_year, "11014", fs_div)
        prev_operating_profit_cumulative = prev_q1_op + prev_q2_op + prev_q3_op

        operating_profit_growth = 0.0
        if prev_operating_profit_cumulative and prev_operating_profit_cumulative != 0:
            operating_profit_growth = ((operating_profit_cumulative - prev_operating_profit_cumulative) / abs(prev_operating_profit_cumulative)) * 100

        result = {
            "revenue": revenue_cumulative,
            "operating_profit": operating_profit_cumulative,
            "operating_profit_growth": round(operating_profit_growth, 2),
            "year": target_year,
            "quarter": quarter_label,
        }

        _financial_statement_cache[stock_code] = result
        logger.info(f"[DART] 재무제표 조회: {stock_code} ({target_year} {quarter_label}) - 매출 {revenue_cumulative:,}원, 영업이익 {operating_profit_cumulative:,}원")
        return result

    except Exception as e:
        logger.error(f"[DART] 재무제표 조회 실패 ({stock_code}): {e}")
        import traceback
        traceback.print_exc()
        return None
