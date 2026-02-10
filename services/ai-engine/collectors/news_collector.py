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
    today = datetime.now().strftime("%Y년 %m월 %d일")

    system = f"""당신은 금융시장 뉴스 수집가입니다.
오늘은 {today}입니다.
어제~오늘 사이 발생한 주요 시장 뉴스만 정리하세요.
각 뉴스는 [출처] 제목 — 핵심 영향 형식으로 작성하세요.
최대 8개, 중요도 순서로."""

    query = f"""{today} 기준 글로벌 금융시장 주요 뉴스를 알려주세요:
1. 미국 증시 (나스닥, S&P500) 움직임과 원인
2. 달러 인덱스(DXY) 및 원/달러 환율 동향
3. 유가(WTI) 변동과 원인 (OPEC, 지정학 등)
4. 미국 국채 금리 및 연준(Fed) 관련 뉴스
5. 한국 시장에 영향을 줄 수 있는 이벤트
6. 이번 주 주요 경제 일정 (CPI, 고용, FOMC 등)"""

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


def collect_all_news(portfolio_symbols: Optional[List[dict]] = None) -> dict:
    """매크로 + 포트폴리오 뉴스 한번에 수집"""
    result = collect_macro_news()

    if portfolio_symbols:
        portfolio = collect_portfolio_news(portfolio_symbols)
        result.update(portfolio)
    else:
        result["portfolio_news"] = ""
        result["portfolio_citations"] = ""

    return result
