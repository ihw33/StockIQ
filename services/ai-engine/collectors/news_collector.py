"""
NewsCollector: Perplexity API 기반 시장 뉴스 수집
- 쿼리 1: 글로벌 매크로 뉴스 (달러, 유가, 금리, 증시)
- 쿼리 2: 보유종목 관련 뉴스 (포트폴리오 연동)
"""
import os
import requests
import logging
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger(__name__)

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"


def _call_perplexity(query: str, system_prompt: str = "") -> Optional[str]:
    """Perplexity sonar 모델 호출"""
    if not PERPLEXITY_API_KEY:
        logger.warning("[NewsCollector] PERPLEXITY_API_KEY not set")
        return None

    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "sonar",
        "messages": [
            {"role": "system", "content": system_prompt or "한국어로 답변하세요."},
            {"role": "user", "content": query},
        ],
        "max_tokens": 1500,
        "temperature": 0.3,
        "return_citations": True,
    }

    try:
        resp = requests.post(PERPLEXITY_URL, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = data.get("citations", [])
        return content, citations
    except Exception as e:
        logger.error(f"[NewsCollector] Perplexity error: {e}")
        return None, []


def collect_macro_news() -> dict:
    """글로벌 매크로 뉴스 수집"""
    from datetime import timedelta

    now = datetime.now()
    today = now.strftime("%Y년 %m월 %d일")
    today_en = now.strftime("%B %d, %Y")  # 영문 날짜
    yesterday = (now - timedelta(days=1)).strftime("%Y년 %m월 %d일")

    system = f"""당신은 금융시장 뉴스 전문가입니다.
오늘은 {today} ({today_en})입니다.

**중요**: 지난 24시간 이내 (past 24 hours) 뉴스만 수집하세요.
- 각 뉴스에 발생 시점을 명시하세요 (예: "오늘 오전", "어제 밤")
- [출처] 제목 — 핵심 영향 형식
- 최대 8개, 중요도 순서
- 중요한 진행 중인 이슈라도 "오늘/어제 새로운 소식"이 있을 때만 포함"""

    query = f"""Search for financial market news from the PAST 24 HOURS ONLY ({today_en}):

Must be from {yesterday} evening to {today} morning.

1. US stocks (Nasdaq, S&P500) - TODAY's movement and causes
2. Dollar Index (DXY) and USD/KRW - LATEST changes (within 24h)
3. Oil (WTI) - RECENT price changes and reasons
4. US Treasury yields and Fed - Any NEW statements or data TODAY
5. Events affecting Korean market - LATEST developments
6. This week's economic calendar - Upcoming releases

⚠️ IMPORTANT: Only include news from the PAST 24 HOURS.
If a multi-day story (like "Fed chair nomination"), only include if there's NEW information TODAY.

한국어로 답변하되, 각 뉴스의 발생 시점을 명시하세요."""

    content, citations = _call_perplexity(query, system)
    return {
        "macro_news": content or "",
        "macro_citations": citations or [],
    }


def collect_portfolio_news(symbols: List[dict]) -> dict:
    """보유종목 관련 뉴스 수집. symbols: [{"symbol": "005930", "name": "삼성전자"}, ...]"""
    if not symbols:
        return {"portfolio_news": "", "portfolio_citations": []}

    names = [s.get("name", s.get("symbol", "")) for s in symbols[:5]]  # 최대 5종목
    names_str = ", ".join(names)
    today = datetime.now().strftime("%Y년 %m월 %d일")

    system = f"""당신은 한국 주식 뉴스 전문가입니다.
오늘은 {today}입니다. 이 정보는 주식 투자 매매 판단에 사용됩니다.
어제~오늘 핵심 뉴스/공시를 아래 표 형식으로 정리하세요.

| 종목 | 날짜 | 뉴스/공시 | 영향 |
|------|------|----------|------|
| 삼성전자 | 02/10 | 자사주 1조원 매입 결정 | 긍정 |

규칙:
- 종목당 최대 2건, 중요도 순
- 영향: 긍정/부정/중립 중 택1
- 뉴스가 없는 종목도 "특이사항 없음"으로 포함"""

    query = f"""{today} 기준, 다음 종목들의 최신 뉴스와 공시를 알려주세요: {names_str}

우선순위:
1. 공시 (M&A, 인수합병, 유상증자, 자사주 매입, 대주주 변동)
2. 실적 발표 / 어닝 서프라이즈
3. 업종 정책/규제 변화
4. 수급 변화 (외국인/기관 대량 매매)
5. 주가에 영향을 줄 기타 이벤트"""

    content, citations = _call_perplexity(query, system)
    return {
        "portfolio_news": content or "",
        "portfolio_citations": citations or [],
    }


def collect_realtime_market_context() -> dict:
    """브리핑 요청 시점 기준 실시간 시장 컨텍스트 수집 (일반적 분위기만)"""
    from datetime import timedelta

    now = datetime.now()
    today = now.strftime("%Y년 %m월 %d일")
    time_str = now.strftime("%H:%M")

    system = f"""당신은 실시간 시장 분석가입니다.
현재 시각: {today} {time_str}

**목표**: 지금 이 순간 글로벌/한국 시장의 전반적 분위기와 흐름을 파악하세요.
- 전체적인 시장 분위기 (risk-on / risk-off)
- 주요 자금 흐름 (채권 ↔ 주식, 글로벌 ↔ 한국)
- 투자자 심리 변화
- 글로벌 이슈가 한국에 미치는 영향

**주의**: 특정 섹터나 종목은 언급하지 말고, 거시적 흐름만 전달하세요.
최대 3-4개 포인트, 간결하게."""

    query = f"""Search for CURRENT global and Korean market context ({today} {time_str}):

1. Overall market sentiment: Risk-on or risk-off? (전반적 투자 심리)
2. Major capital flows: Bonds vs Stocks, US vs Asia (자금 흐름)
3. Key global factors affecting Korean markets TODAY (한국 시장 영향 요인)
4. Investor positioning changes in past 2-3 hours (최근 투자자 포지션 변화)

⚠️ IMPORTANT:
- Only information from the PAST 2-3 HOURS
- Focus on MACRO trends, NOT specific sectors/stocks
- General market mood, NOT specific price targets

한국어로 답변하되, "지금", "현재" 같은 시점 표현 사용."""

    content, citations = _call_perplexity(query, system)
    return {
        "realtime_context": content or "",
        "realtime_citations": citations or [],
    }


def collect_all_news(portfolio_symbols: Optional[List[dict]] = None, include_realtime: bool = False) -> dict:
    """매크로 + 포트폴리오 뉴스 한번에 수집"""
    result = collect_macro_news()

    if portfolio_symbols:
        portfolio = collect_portfolio_news(portfolio_symbols)
        result.update(portfolio)
    else:
        result["portfolio_news"] = ""
        result["portfolio_citations"] = ""

    # 실시간 시장 컨텍스트 (브리핑 요청 시)
    if include_realtime:
        realtime = collect_realtime_market_context()
        result.update(realtime)

    return result
