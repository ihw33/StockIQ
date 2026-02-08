"""
LLMAnalyzer: 매크로 데이터 + 뉴스 → Sonnet 4.5 팀 브리핑 생성
OpenRouter API 사용
"""
import os
import json
import requests
import logging
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "anthropic/claude-sonnet-4"

TEAM_SYSTEM_PROMPT = """당신은 신입 애널리스트를 교육하는 StockIQ 매크로 전략팀입니다.
읽는 사람은 경제 초보 개인 투자자입니다. 매일 이 보고서를 반복해서 읽으며 "글로벌 자금이 어떻게 흘러서 내 주식에 영향을 주는지" 감을 잡으려 합니다.

## 팀 구성
[수석 전략가] 오늘 시장을 관통하는 하나의 테마. 자금흐름의 큰 그림.
[FX/금리 전문가] 환율·금리·채권. 달러-원 환율이 한국에 미치는 영향. 초보에게 비유로 설명.
[퀀트] 알고리즘 보고서의 스코어와 뉴스가 일치하는지 교차검증. 모순 시 어느 쪽을 믿을지 판단.
[업종 전략] 매크로 변화 → 한국 섹터별 자금 유입/이탈 예측. 보유종목·관심종목 영향.
[리스크] 오늘 가장 주의할 변수. 방어 전략.

## 핵심 원칙 (반드시 지킬 것)
1. **뉴스↔데이터 교차분석 필수**: 단순 요약 금지. "이 뉴스가 이 숫자를 만들었다" 또는 "뉴스와 데이터가 모순된다"를 반드시 보여주세요.
2. **인과 체인 명시**: 이벤트 → 지표 변화 → 자금 이동 → 한국 영향 → 섹터 → 종목 순서로 연결하세요.
3. **알고리즘 보고서와 중복 금지**: 퀀트 엔진이 이미 계산한 스코어/연쇄분석은 반복하지 말고, 뉴스를 더해서 "알고리즘이 못 잡은 것"을 분석하세요.
4. **교육적 설명**: 어려운 개념이 나오면 즉시 한 문장으로 풀어주세요. (예: "이격도란 주가가 평균에서 얼마나 벗어났는지를 나타냅니다")
5. **전문가 간 상호작용**: 다른 전문가의 분석에 보충하거나 반론할 수 있습니다. 기계적으로 각자 말하지 마세요.

## 참고 학술 근거 (필요할 때 인용)
- BIS(2024): USD 10% 상승 → 신흥국 통화 4% 절하 → 주식시장 ~4% 하락
- SF Fed(2025): 유가 3% 상승 → 미국채 수익률 4.5bp 상승
- Baur & McDermott(2010): 금은 한국 투자자에게 안전자산이 아님
- ArXiv(2025): BTC는 2024 ETF 승인 이후 위험자산(Risk-ON)으로 행동
- ScienceDirect(2013): 외국인 선물 순매수 → 익일 현물 수익률 양(+)의 예측력"""


def _build_user_prompt(macro_data: Dict, news: Dict, portfolio_symbols: Optional[List[dict]] = None) -> str:
    """매크로 데이터 + 뉴스 → 사용자 프롬프트 조립"""

    # 매크로 데이터 요약 (토큰 절약용)
    ta = macro_data.get("tier_a", {})
    tb = macro_data.get("tier_b", {})
    gm = macro_data.get("global_markets", {})
    scores = macro_data.get("scores", {})

    data_section = f"""## 매크로 데이터 ({macro_data.get('date', '?')}, {macro_data.get('kr_market_day', '')}요일)
미국 시장일: {macro_data.get('us_market_date', '?')} ({macro_data.get('us_market_day', '')}요일)

Tier A (글로벌): DXY {ta.get('dxy',{}).get('value','?')} ({ta.get('dxy',{}).get('change_pct',0):+.2f}%, 스코어:{scores.get('dxy',0)}) | US10Y {ta.get('us10y',{}).get('value','?')} ({ta.get('us10y',{}).get('change_bps',0):+.1f}bp, 스코어:{scores.get('us10y',0)}) | VIX {ta.get('vix',{}).get('value','?')} ({ta.get('vix',{}).get('change_pct',0):+.2f}%, 스코어:{scores.get('vix',0)})

Tier B (수급): 외국인현물 {tb.get('foreign_cash',{}).get('net_amount',0):,}억 (스코어:{scores.get('foreign',0)}) | 선물 {tb.get('futures',{}).get('net',0):,}계약 (스코어:{scores.get('futures',0)}) | 공매도 {tb.get('short_selling',{}).get('change_pct',0):+.1f}% (스코어:{scores.get('short',0)})

글로벌 시장: 나스닥 {gm.get('nasdaq',{}).get('value','?')} ({gm.get('nasdaq',{}).get('change_pct',0):+.2f}%) | S&P500 {gm.get('sp500',{}).get('value','?')} ({gm.get('sp500',{}).get('change_pct',0):+.2f}%) | WTI {gm.get('oil',{}).get('value','?')} ({gm.get('oil',{}).get('change_pct',0):+.2f}%) | 금 {gm.get('gold',{}).get('value','?')} ({gm.get('gold',{}).get('change_pct',0):+.2f}%) | BTC {gm.get('bitcoin',{}).get('value','?')} ({gm.get('bitcoin',{}).get('change_pct',0):+.2f}%) | 원/달러 {gm.get('krw_usd',{}).get('value','?')} ({gm.get('krw_usd',{}).get('change_pct',0):+.2f}%)

종합 스코어: {macro_data.get('overall_score', 0):+.2f}"""

    # 경제 캘린더
    calendar_section = ""
    cal = macro_data.get("economic_calendar", {})
    cal_events = cal.get("economic_events", []) if cal else []
    if cal_events:
        calendar_section = "\n## 이번 주 주요 경제지표 발표 일정"
        for ev in cal_events:
            impact_mark = "🔴" if ev.get("impact") == "High" else "🟡"
            fcst = f" (예상: {ev['forecast']}, 이전: {ev['previous']})" if ev.get("forecast") else ""
            calendar_section += f"\n- {impact_mark} {ev.get('date', '')[:16]} {ev.get('title', '')}{fcst}"

    # 규칙 기반 연쇄분석 요약
    chain = macro_data.get("chain_analysis", "")
    chain_section = f"\n## 퀀트 엔진 연쇄분석\n{chain[:1500]}" if chain else ""

    # 뉴스
    news_section = ""
    if news.get("macro_news"):
        news_section += f"\n## 최근 24시간 주요 뉴스\n{news['macro_news']}"
    if news.get("portfolio_news"):
        news_section += f"\n\n## 보유종목 뉴스\n{news['portfolio_news']}"

    # 포트폴리오 (보유 / 관심 분리)
    portfolio_section = ""
    if portfolio_symbols:
        holdings = [s for s in portfolio_symbols if s.get("type") == "holding"]
        watchlist = [s for s in portfolio_symbols if s.get("type") == "watchlist"]
        # type 미지정 시 전부 보유로 취급
        if not holdings and not watchlist:
            holdings = portfolio_symbols

        if holdings:
            h_names = [f"{s.get('name', s.get('symbol'))}({s.get('symbol')})" for s in holdings[:5]]
            portfolio_section += f"\n## 보유종목\n{', '.join(h_names)}"
        if watchlist:
            w_names = [f"{s.get('name', s.get('symbol'))}({s.get('symbol')})" for s in watchlist[:5]]
            portfolio_section += f"\n## 관심종목\n{', '.join(w_names)}"

    prompt = f"""{data_section}
{calendar_section}
{chain_section}
{news_section}
{portfolio_section}

## 보고서 작성 지침

### 1. [수석 전략가] 오늘의 핵심 한줄 + 자금흐름 큰 그림
오늘 시장을 관통하는 하나의 테마를 뉴스에서 뽑고, 글로벌 자금이 어디서 어디로 이동하고 있는지 큰 그림을 그려주세요.

### 2. [FX 전문가] 글로벌 이벤트 → 지표 → 자금 이동 해설
오늘 뉴스 중 환율·금리를 움직인 이벤트를 찾아서, "이 뉴스 때문에 → 이 지표가 이렇게 변했고 → 돈이 이쪽으로 흘렀다"는 인과 체인을 설명하세요.
알고리즘 스코어와 뉴스가 같은 방향인지 확인하고, 다르면 왜 다른지 해석하세요.
초보자가 이해할 수 있도록 비유를 하나 넣어주세요.

### 3. [퀀트] 알고리즘 vs 뉴스 교차검증
알고리즘 연쇄분석이 잡은 신호와 오늘 뉴스가 일치하는지 확인하세요.
모순이 있으면 어느 쪽을 더 신뢰할지 근거와 함께 판단하세요.
알고리즘이 놓쳤을 수 있는 뉴스 이벤트가 있으면 지적하세요.

### 4. [업종 전략] 한국 섹터 자금흐름 + 포트폴리오 점검
위 분석을 바탕으로 오늘 한국에서 자금 유입이 예상되는 섹터와 이탈 예상 섹터를 뉴스 근거와 함께 제시하세요.

**[보유종목 점검]** 각 보유종목이 오늘 자금흐름에서 어떤 위치인지, 오늘의 전략(홀드/비중조절/주의)을 제시하세요.
**[관심종목 점검]** 현재 매크로 상황에서 진입 타이밍이 적절한지 평가하세요.

### 5. [리스크 & 팀 합의]
오늘 가장 주의할 변수 1~2개.
공격적/보수적 투자자별 오늘의 행동 가이드.
팀 신뢰도 (1~5).

답변은 한국어로, 이모지 최소한만 사용하세요.
단순 데이터 나열이 아닌, "왜 그런지"와 "그래서 어떻게 되는지"에 집중하세요."""

    return prompt


def generate_team_briefing(
    macro_data: Dict,
    news: Dict,
    portfolio_symbols: Optional[List[dict]] = None,
    model: str = DEFAULT_MODEL,
) -> Optional[str]:
    """팀 브리핑 생성"""
    if not OPENROUTER_API_KEY:
        logger.warning("[LLMAnalyzer] OPENROUTER_API_KEY not set")
        return None

    user_prompt = _build_user_prompt(macro_data, news, portfolio_symbols)

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": TEAM_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 5000,
    }

    try:
        resp = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=120)
        resp.raise_for_status()
        data = resp.json()

        if "choices" in data:
            text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            cost = usage.get("cost", 0)
            logger.info(f"[LLMAnalyzer] Generated briefing. Tokens: {usage.get('total_tokens', '?')}, Cost: ${cost}")
            return text
        else:
            logger.error(f"[LLMAnalyzer] Unexpected response: {data}")
            return None
    except Exception as e:
        logger.error(f"[LLMAnalyzer] Error: {e}")
        return None
