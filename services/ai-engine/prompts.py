"""
Enhanced LLM Prompt System for Market Analysis Feedback
LLM provides feedback on algo analysis results with news and market context.
"""

def build_enhanced_system_prompt() -> str:
    """
    System prompt for analysis feedback mode.
    """
    return """당신은 한국 주식 시장 전문 트레이더입니다.

**핵심 임무:**
사용자의 **현재 보유 여부**에 따라 완전히 다른 전략을 제시하세요.

---

## 🧠 심층분석 방법론

**단계별로 깊이 생각하며 분석하세요:**

1. **먼저** 매크로 환경 → 시장 수급 → 알고리즘 분석 순으로 큰 그림 파악
2. **그 다음** 종목의 기술적 상태를 멀티 타임프레임으로 종합
3. **이후** 포지션 정보(있다면)를 고려하여 리스크/보상 비율 계산
4. **마지막으로** 구체적 가격대와 시나리오를 도출

**각 판단의 근거를 명확히 제시하고, 불확실한 부분은 솔직히 인정하세요.**
"~일 가능성이 있습니다", "~를 확인 후 판단하세요" 같은 표현을 적극 사용하세요.

---

## 📋 분석 원칙

### 1️⃣ 보유자 (Position Holder) 전략
**사용자가 이미 보유 중인 경우:**
- ✅ **평균단가 대비 현재가** 분석 최우선
- ✅ **추매 vs 관망 vs 일부 익절** 판단
- ✅ **손절가/익절가를 평단 기준**으로 제시
- ✅ 예시:
  - "평단 160,000원 대비 현재 +5% 수익 구간"
  - "평단 대비 -3% 이탈 시 손절 권장 (155,200원)"
  - "평단 +10% 도달 시 50% 익절 후 재진입 대기"

### 2️⃣ 관망자 (Observer) 전략
**사용자가 미보유인 경우:**
- ✅ **진입 타이밍** 분석 최우선
- ✅ **진입가/손절가/목표가를 절대가격**으로 제시
- ✅ **분할 매수 전략** 제시
- ✅ 예시:
  - "820,000원 지지 확인 시 1차 진입 (30%)"
  - "800,000원 추가 하락 시 2차 진입 (40%)"
  - "손절: 780,000원 이탈 시 (-5%)"

---

## 📊 답변 구조

### 보유자용 답변:
```
## 🌍 매크로 환경
[종목과의 관련성에 따라 분량 조절. 수급 데이터는 항상 포함]

## 💼 포지션 현황
[평단가 대비 손익률, 현재 구간 평가]

## 📊 분석 평가
[기술적 분석 + 평단가 기준 리스크 평가]

## ⚠️ 주의사항
[평단가 기준 손절/익절 시나리오]

## 💡 실전 전략
- 🟢 추매: [평단가 개선 조건]
- 🟡 관망: [대기 조건]
- 🔴 청산: [손절/익절 조건]
```

### 관망자용 답변:
```
## 🌍 매크로 환경
[종목과의 관련성에 따라 분량 조절. 수급 데이터는 항상 포함]

## 📊 분석 평가
[기술적 분석 + 진입 타이밍 평가]

## ⚠️ 주의사항
[진입 전 리스크 요소]

## 💡 실전 전략
- 🟢 진입: [구체적 가격대 + 분할 매수 비율]
- 🔴 손절: [절대 가격 기준]
- 🎯 목표: [익절 가격대]
```

---

**중요 규칙:**
1. 포지션 정보가 제공되면 **반드시 평단가 기준** 분석
2. 미보유 시 **절대 "평단가" 언급 금지**
3. 모든 가격은 **구체적 숫자**로 제시 (예: "820,000원")
4. 변동성 높을 때는 **분할 전략** 필수 제시
5. **매크로/수급/미국 시황 → 종목과의 관련성에 따라 비중 조절**:
   - **시간 순서**: 미국 시장 데이터는 한국 장 마감 후 결과. 다음 한국 개장일에 영향
   - **미국 시황 비중은 종목명·외국인비율·업종을 보고 스스로 판단**. 관련 낮으면 2~3줄 참고 수준으로 줄이고 차트/수급 분석에 집중할 것
   - 외국인/기관 순매수/매도 추세가 주가 방향성의 핵심 선행 지표
   - 시장 전체 vs 해당 종목의 수급 괴리가 있으면 언급
"""


def build_llm_context(symbol: str, algo_result: dict, position_info: dict = None) -> str:
    """
    Build context for LLM analysis feedback.
    
    Args:
        symbol: Stock symbol
        algo_result: Algo analysis result with market stress/volatility
        position_info: Optional position info (avgPrice, quantity, profitRate)
        
    Returns:
        Formatted context string
    """
    from datetime import datetime
    
    market_stress = algo_result.get('market_stress', {})
    recent_volatility = algo_result.get('recent_volatility', {})
    strategy_status = algo_result.get('strategy_status', {})
    analysis_text = algo_result.get('analysis', '')
    current_price = algo_result.get('current_price', 0)
    
    # Real-time market status
    now = datetime.now()
    hour = now.hour
    
    if 9 <= hour < 11:
        time_context = "오전장"
    elif 11 <= hour < 13:
        time_context = "점심 시간대"
    elif 13 <= hour < 15:
        time_context = "오후장"
    elif 15 <= hour <= 16:
        time_context = "장 마감 직후"
    else:
        time_context = "장 마감"
    
    # Get intraday price action from recent volatility history
    intraday_info = ""
    if recent_volatility and 'history' in recent_volatility:
        history = recent_volatility['history']
        if len(history) >= 2:
            today = history[-1]
            yesterday = history[-2]
            
            today_change = today.get('change_pct', 0)
            volume_ratio = today.get('volume_ratio', 0)
            
            if today_change > 2:
                price_status = "급등"
            elif today_change > 0.5:
                price_status = "상승"
            elif today_change > -0.5:
                price_status = "보합"
            elif today_change > -2:
                price_status = "하락"
            else:
                price_status = "급락"
            
            if volume_ratio > 1.5:
                vol_status = "거래 폭발"
            elif volume_ratio > 0.8:
                vol_status = "정상 거래"
            else:
                vol_status = "거래 부진"
            
            intraday_info = f"**실시간 시황 ({time_context}):** {price_status} {today_change:+.1f}% / {vol_status} (거래량 {volume_ratio:.1f}배)\n"

    # Macro Dashboard Context (pre-fetched from chart_analyst, or fallback to collect_all)
    macro_context = ""
    try:
        macro_row = algo_result.get('macro_db')
        if macro_row:
            level_label = {1: "🟢 외국인 우호적", 2: "🟡 중립/관망", 3: "🔴 외국인 이탈 경고"}
            sl = macro_row["safety_level"]
            macro_context = f"""**{level_label.get(sl, f'Level {sl}')}** (종합: {float(macro_row['overall_score']):+.2f})
DXY({macro_row['dxy_score']:+d}) | US10Y({macro_row['us10y_score']:+d}) | VIX({macro_row['vix_score']:+d}) | 현물({macro_row['foreign_score']:+d}) | 선물({macro_row['futures_score']:+d}) | 공매도({macro_row['short_score']:+d})
"""
            print(f"[Prompts] Macro context added from DB (Level {sl})")
        else:
            # Fallback: live collect
            from collectors.macro_dashboard import MacroDashboardCollector
            macro = MacroDashboardCollector().collect_all()
            level_label = {1: "🟢 외국인 우호적", 2: "🟡 중립/관망", 3: "🔴 외국인 이탈 경고"}
            macro_context = f"""**{level_label[macro['safety_level']]}** (종합: {macro['overall_score']:+.2f})
DXY({macro['scores']['dxy']:+d}) | US10Y({macro['scores']['us10y']:+d}) | VIX({macro['scores']['vix']:+d}) | 현물({macro['scores']['foreign']:+d}) | 선물({macro['scores']['futures']:+d}) | 공매도({macro['scores']['short']:+d})
"""
            print("[Prompts] Macro context added from live collect")
    except Exception as e:
        print(f"[Prompts] Macro context unavailable: {e}")

    # US Overnight Market (S&P500, NASDAQ, DOW)
    us_context = ""
    try:
        us = algo_result.get('us_overnight')
        if us:
            parts = []
            if us.get('sp500'):
                parts.append(f"S&P500 {us['sp500']['value']:,.0f} ({us['sp500']['change_pct']:+.2f}%)")
            if us.get('nasdaq'):
                parts.append(f"NASDAQ {us['nasdaq']['value']:,.0f} ({us['nasdaq']['change_pct']:+.2f}%)")
            if us.get('dow'):
                parts.append(f"DOW {us['dow']['value']:,.0f} ({us['dow']['change_pct']:+.2f}%)")
            if parts:
                us_context = f"**미국 시장 (한국 장 마감 후 결과 → 다음 한국 개장일에 영향):** {' | '.join(parts)}\n"
                print(f"[Prompts] US overnight context added")
    except Exception as e:
        print(f"[Prompts] US overnight unavailable: {e}")

    # Investor Trends Context + Foreign Ratio for sector sensitivity
    investor_context = ""
    try:
        from collectors.kiwoom import KiwoomCollector
        kiwoom = KiwoomCollector()

        # 외국인 비율 조회 → LLM이 미국 시황 민감도 판단에 사용
        company_info = kiwoom.get_company_info(symbol)
        foreign_ratio = company_info.get('foreign_ratio') if company_info else None
        stock_name = company_info.get('stk_nm', symbol) if company_info else symbol

        stock_trends = kiwoom.get_investor_trends(symbol)
        market_trends = kiwoom.get_investor_trends("069500")  # KODEX 200
        stock_history = kiwoom.get_investor_trends_history(symbol, 5)

        def _fmt(val):
            return f"{val:+,}" if val is not None else "-"

        lines = []
        if foreign_ratio is not None:
            lines.append(f"**종목 프로필:** {stock_name}({symbol}) / 외국인 보유비율 {foreign_ratio}%")
        if market_trends:
            lines.append(f"**시장수급(KODEX200):** 외인{_fmt(market_trends.get('foreign'))} 기관{_fmt(market_trends.get('institution'))} 개인{_fmt(market_trends.get('individual'))}")
        if stock_trends:
            lines.append(f"**종목수급({symbol}):** 외인{_fmt(stock_trends.get('foreign'))} 기관{_fmt(stock_trends.get('institution'))} 개인{_fmt(stock_trends.get('individual'))}")

        if stock_history and len(stock_history) > 1:
            # 5일 연속 매수/매도 추세 요약
            foreign_days = [d.get('foreign', 0) or 0 for d in stock_history]
            consec_buy = all(v > 0 for v in foreign_days)
            consec_sell = all(v < 0 for v in foreign_days)
            if consec_buy:
                lines.append(f"⚡ 외국인 {len(foreign_days)}일 연속 순매수")
            elif consec_sell:
                lines.append(f"⚡ 외국인 {len(foreign_days)}일 연속 순매도")

        if lines:
            investor_context = "\n".join(lines) + "\n"
            print(f"[Prompts] Investor context added: {len(lines)} lines")
        else:
            print(f"[Prompts] Investor trends: no data (stock={stock_trends is not None}, market={market_trends is not None})")
    except Exception as e:
        print(f"[Prompts] Investor trends unavailable: {e}")
        import traceback
        traceback.print_exc()

    # DART 기업개황 + 최근 공시
    dart_context = ""
    try:
        from collectors.dart_collector import get_company_overview, collect_dart_filings
        overview = get_company_overview(symbol)
        if overview:
            est = overview['est_dt']
            est_fmt = f"{est[:4]}.{est[4:6]}.{est[6:8]}" if len(est) == 8 else est
            dart_context += f"**DART 기업개황:** 업종: {overview['induty_name']} | 대표자: {overview['ceo_nm']} | 설립: {est_fmt}\n"

        filings = collect_dart_filings([{"symbol": symbol, "name": stock_name}], days=3)
        if filings.get("filings_text"):
            dart_context += f"**최근 공시 (3일):**\n{filings['filings_text']}\n"
        if dart_context:
            print(f"[Prompts] DART context added")
    except Exception as e:
        print(f"[Prompts] DART context unavailable (non-fatal): {e}")

    # Position info (if available)
    position_context = ""
    if position_info:
        avg_price = position_info.get('avgPrice', 0)
        quantity = position_info.get('quantity', 0)
        profit_rate = position_info.get('profitRate', 0)
        profit_amount = position_info.get('profitAmount', 0)
        
        position_status = "수익" if profit_rate >= 0 else "손실"
        position_context = f"""
**💼 현재 보유 포지션:**
- 평균단가: {avg_price:,}원
- 보유수량: {quantity}주
- 수익률: {profit_rate:+.2f}% ({profit_amount:+,}원) - {position_status} 구간
"""

    # Stress info - concise
    stress_level = market_stress.get('stress_level', 'LOW')
    stress_score = market_stress.get('stress_score', 0)
    stress_reasons = market_stress.get('reasons', [])
    
    stress_summary = f"**시장 스트레스:** {stress_level} ({stress_score}/100)"
    if stress_reasons:
        stress_summary += f"\n- {', '.join(stress_reasons)}"
    
    # Volatility info - concise
    volatility_level = recent_volatility.get('volatility_level', 'NORMAL')
    avg_volatility = recent_volatility.get('avg_daily_volatility', 0)
    cumulative = recent_volatility.get('cumulative_change_pct', 0)
    
    vol_summary = f"**최근 변동성:** {volatility_level} (평균 {avg_volatility:.1f}%/일, 5일 누적 {cumulative:+.1f}%)"
    
    # Strategy status - only disabled ones
    disabled = []
    for tf, status in strategy_status.items():
        if not status.get('enabled', True):
            tf_name = {'15m': '15분봉', '5m': '5분봉'}.get(tf, tf)
            disabled.append(f"{tf_name}: {status['reason']}")
    
    strategy_warning = ""
    if disabled:
        strategy_warning = f"\n**전략 제한:**\n" + "\n".join(f"- {d}" for d in disabled)
    
    # --- [분기점] 보유자 vs 비보유자 ---
    
    if position_info:
        # ==========================================
        # 🟢 CASE 1: 보유자 전용 리포트 (강력한 대응 중심)
        # ==========================================
        context = f"""
# 🚨 [보유자 긴급 진단] {symbol}

## 💼 내 포지션 현황
{position_context}

## 📊 시장 상황 요약
{intraday_info}{us_context}{macro_context}{investor_context}{dart_context}{stress_summary}
{vol_summary}

---

## 🔬 기술적 분석 데이터
{analysis_text}

---

## 👑 AI 조언 요청 (보유자 맞춤)
**당신은 지금 이 종목을 보유한 트레이더의 '전담 리스크 매니저'입니다.**
평범한 시황 분석은 필요 없습니다. 오직 **내 돈을 지키거나 불리기 위한 행동**만 지시하세요.

다음 형식으로 답변하세요:

## 💼 포지션 정밀 진단
평단가: {avg_price:,.0f}원 vs 현재가: {current_price:,.0f}원
→ [현재 사용자의 평단가와 현재가를 기준으로, 지금이 '버텨야 할 때'인지 '도망쳐야 할 때'인지 냉정하게 판단]

## 🔥 3대 대응 시나리오
1. **🚀 반등 시 (Best)**: 평단 +X% (구체적 가격) 도달 시 익절/본절 탈출
2. **🛡️ 횡보 시 (Hold)**: 평단 -X% (구체적 가격) 지지 유지 시 홀딩
3. **🩸 하락 시 (Worst)**: 평단 -X% (구체적 가격) 이탈 시 즉시 손절

## 💡 최종 결론
**한 줄 요약**: [예: "평단 대비 -3% 손절라인(152,400원) 사수하며 +5% 익절(165,200원) 노리세요"]

**⚠️ 경고: 반드시 "평단가" 또는 "평균단가"라는 단어를 사용하세요. 절대가격만 제시하면 안 됩니다!**
"""

    else:
        # ==========================================
        # ⚪ CASE 2: 신규 진입/관망 리포트 (기존 유지)
        # ==========================================
        context = f"""
# {symbol} 기술적 분석 결과

{intraday_info}{us_context}{macro_context}{investor_context}{dart_context}{stress_summary}
{vol_summary}{strategy_warning}

---

## 멀티 타임프레임 분석

{analysis_text}

---

**피드백 요청:**
위 분석과 실시간 시황을 고려하여, 신규 진입을 노리는 투자자에게 **객관적인 진입/관망 전략**을 조언해주세요.
다음 형식으로 답변하세요:

# 📊 분석 평가
[기술적 타당성 및 시황 평가]

# ⚠️ 주의사항
[리스크 요인]

# 💡 실전 전략
[구체적인 진입가/목표가/손절가]
"""

    return context


def build_user_query(symbol: str, user_question: str = None) -> str:
    """
    Build user query for LLM.
    """
    if user_question:
        return f"""사용자 질문: {user_question}

위 분석과 질문을 바탕으로 간결하고 실용적인 피드백을 제공하세요."""
    else:
        return """이 분석 결과를 검토하고 다음을 피드백해주세요:

1. 이 분석이 현재 시황에 적합한가?
2. 주의해야 할 리스크는?
3. 지금 투자자가 취해야 할 구체적 행동은?

**간결하게 3-5문단으로 작성하세요.**"""
