from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional
from models.requests import ChartAnalysisRequest, DeepAnalysisRequest, AlgoAnalysisRequest, CompanyAnalysisStartRequest, CompanyAnalysisRequest
from strategies.morning import MorningIntelligence
from strategies.chart_analyst import ChartAnalyst
from llm_client import LLMClient

router = APIRouter()

@router.post("/api/strategy/morning-briefing")
async def run_morning_briefing():
    """
    Triggers the Morning Intelligence workflow.
    """
    try:
        strategy = MorningIntelligence()
        result = await strategy.generate_briefing()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/strategy/chart-analysis")
async def run_chart_analysis(request: ChartAnalysisRequest):
    """
    Analyzes chart data for the given symbol using ChartAnalyst strategy.
    LLM 모드 완료 시 DB에 자동 저장 (페이지 이탈 시에도 결과 보존).
    """
    try:
        if not request.symbol:
            raise HTTPException(status_code=400, detail="Symbol is required")

        strategy = ChartAnalyst()
        result = await strategy.analyze(request.symbol, request.mode or "llm", request.query, request.position_info)

        # LLM 종합분석 성공 시 DB에 자동 저장 (개별 호출 시)
        if (request.mode or "llm") == "llm" and result.get("status") == "success":
            try:
                from database import analysis_db
                from collectors.kiwoom import KiwoomCollector
                kiwoom = KiwoomCollector()
                ci = kiwoom.get_company_info(request.symbol)
                sname = ci.get('stk_nm', request.symbol) if ci else request.symbol
                await analysis_db.connect()
                await analysis_db.save_analysis(
                    symbol=request.symbol,
                    timeframe="deep_analysis",
                    analysis_type="deep_llm",
                    content={"analysis": result.get("analysis", ""), "stock_name": sname, "source": result.get("source", "")},
                )
                print(f"[ChartAnalysis] Deep analysis saved to DB for {sname}")
            except Exception as save_err:
                print(f"[ChartAnalysis] DB save error (non-fatal): {save_err}")

        return result
    except Exception as e:
        print(f"Analysis Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/strategy/deep-analysis-start")
async def start_deep_analysis(request: DeepAnalysisRequest, background_tasks: BackgroundTasks):
    """
    종합분석을 백그라운드로 시작. 즉시 응답 후 서버에서 algo+LLM 실행 → DB 저장.
    프론트엔드는 /api/reports/pending 폴링으로 완료 감지.
    """
    if not request.symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    background_tasks.add_task(_run_deep_analysis_bg, request.symbol, request.position_info)
    return {"status": "started", "symbol": request.symbol}

async def _run_deep_analysis_bg(symbol: str, position_info: Optional[dict] = None):
    """백그라운드에서 algo + LLM 종합분석 실행. Algo 요약을 포함한 LLM 보고서만 저장."""
    try:
        from database import analysis_db
        from collectors.kiwoom import KiwoomCollector

        strategy = ChartAnalyst()

        # 종목명 조회
        kiwoom = KiwoomCollector()
        company_info = kiwoom.get_company_info(symbol)
        stock_name = company_info.get('stk_nm', symbol) if company_info else symbol

        # 1) Algo 분석 실행 (DB 저장 안 함 - 요약만 추출)
        print(f"[종합분석 BG] Starting algo for {stock_name}({symbol})")
        algo_result = await strategy.analyze(symbol, "algo", None, position_info)

        # Algo 분석 요약 추출
        algo_summary = ""
        if algo_result.get("status") == "success":
            algo_analysis = algo_result.get("analysis", "")
            # 첫 500자 또는 첫 섹션만 추출 (요약)
            lines = algo_analysis.split('\n')
            summary_lines = []
            char_count = 0
            for line in lines:
                if char_count > 800:  # 약 800자 제한
                    break
                summary_lines.append(line)
                char_count += len(line)
                # "---" 구분선이 나오면 첫 섹션 완료
                if line.strip() == '---' and char_count > 200:
                    break

            algo_summary = '\n'.join(summary_lines[:20])  # 최대 20줄
            print(f"[종합분석 BG] Algo completed for {stock_name}")
        else:
            algo_summary = f"⚠️ 알고리즘 분석 실패: {algo_result.get('error', '알 수 없는 오류')}"
            print(f"[종합분석 BG] Algo failed for {symbol}")

        # 2) LLM 종합분석 실행
        print(f"[종합분석 BG] Starting LLM for {stock_name}({symbol})")
        llm_result = await strategy.analyze(symbol, "llm", None, position_info)

        if llm_result.get("status") == "success":
            llm_analysis = llm_result.get("analysis", "")

            # Algo 요약 + LLM 분석 결합
            combined_analysis = f"""# 📊 종합 분석 보고서

## 📈 알고리즘 분석 요약

{algo_summary}

---

## 🤖 AI 종합 분석

{llm_analysis}

---

_※ 알고리즘 분석은 멀티타임프레임 기술적 지표 기반, AI 분석은 LLM 기반 종합 해석입니다._
"""

            # LLM 보고서만 DB 저장 (알고 요약 포함)
            await analysis_db.connect()
            await analysis_db.save_analysis(
                symbol=symbol,
                timeframe="deep_analysis",
                analysis_type="deep_llm",
                content={
                    "analysis": combined_analysis,
                    "stock_name": stock_name,
                    "source": llm_result.get("source", ""),
                    "includes_algo_summary": True,
                },
            )
            print(f"[종합분석 BG] Combined report saved for {stock_name}")
        else:
            print(f"[종합분석 BG] LLM failed for {symbol}: {llm_result.get('error')}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[종합분석 BG] Error for {symbol}: {e}")


@router.post("/api/strategy/algo-analysis-start")
async def start_algo_analysis(request: AlgoAnalysisRequest, background_tasks: BackgroundTasks):
    """알고리즘 분석만 백그라운드로 시작 → DB 저장."""
    if not request.symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    background_tasks.add_task(_run_algo_analysis_bg, request.symbol)
    return {"status": "started", "symbol": request.symbol}

async def _run_algo_analysis_bg(symbol: str):
    """백그라운드 알고리즘 분석 → DB 저장"""
    try:
        from database import analysis_db
        from collectors.kiwoom import KiwoomCollector

        strategy = ChartAnalyst()
        kiwoom = KiwoomCollector()
        company_info = kiwoom.get_company_info(symbol)
        stock_name = company_info.get('stk_nm', symbol) if company_info else symbol

        print(f"[AlgoAnalysis BG] Starting for {stock_name}({symbol})")
        algo_result = await strategy.analyze(symbol, "algo", None, None)
        if algo_result.get("status") == "success":
            await analysis_db.connect()
            await analysis_db.save_analysis(
                symbol=symbol,
                timeframe="algo",
                analysis_type="algo",
                content={
                    "analysis": algo_result.get("analysis", ""),
                    "stock_name": stock_name,
                },
            )
            print(f"[AlgoAnalysis BG] Saved for {stock_name}")
        else:
            print(f"[AlgoAnalysis BG] Failed for {symbol}: {algo_result.get('error')}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[AlgoAnalysis BG] Error for {symbol}: {e}")

@router.post("/api/strategy/company-analysis-start")
async def start_company_analysis(request: CompanyAnalysisStartRequest, background_tasks: BackgroundTasks):
    """기업 펀더멘탈 분석을 백그라운드로 시작 → DB 저장."""
    if not request.symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    background_tasks.add_task(_run_company_analysis_bg, request.symbol)
    return {"status": "started", "symbol": request.symbol}

async def _run_company_analysis_bg(symbol: str):
    """백그라운드 기업분석: 기업 데이터 수집 → LLM 분석 → DB 저장"""
    try:
        from database import analysis_db
        from collectors.kiwoom import KiwoomCollector

        kiwoom = KiwoomCollector()
        company_info = kiwoom.get_company_info(symbol)
        if not company_info:
            print(f"[CompanyAnalysis BG] No company info for {symbol}")
            return

        stock_name = company_info.get('stk_nm', symbol)
        print(f"[CompanyAnalysis BG] Starting for {stock_name}({symbol})")

        # Build data prompt from company info (same format as frontend)
        ci = company_info
        data_prompt = (
            f"[기업분석 요청] {stock_name} ({symbol}) — "
            f"PER:{ci.get('per') or '-'} PBR:{ci.get('pbr') or '-'} "
            f"ROE:{ci.get('roe') or '-'}% 시총:{ci.get('market_cap') or '-'}억 "
            f"외인:{ci.get('foreign_ratio') or '-'}% 매출:{ci.get('sales') or '-'}억 "
            f"영업이익:{ci.get('operating_profit') or '-'}억 순이익:{ci.get('net_income') or '-'}억 "
            f"EPS:{ci.get('eps') or '-'} BPS:{ci.get('bps') or '-'} "
            f"액면배당률:{ci.get('dividend_rate') or '-'}% 신용:{ci.get('credit_ratio') or '-'}% "
            f"연고:{ci.get('year_high') or '-'} 연저:{ci.get('year_low') or '-'}"
        )

        # Reuse existing company analysis logic (macro + investor + LLM)
        llm = LLMClient()
        macro_context = ""
        investor_context = ""

        try:
            await analysis_db.connect()
            async with analysis_db.pool.acquire() as conn:
                macro_row = await conn.fetchrow(
                    "SELECT * FROM macro_daily WHERE date = CURRENT_DATE"
                )
            if macro_row:
                md = _macro_row_to_dict(macro_row)
                macro_context = f"""
## 오늘의 매크로 시장 환경
- 안전등급: Level {md['safety_level']} (종합점수: {md['overall_score']:+.2f})
- 시장방향 예측: {md['prediction_direction']}
- DXY(달러인덱스): {md['tier_a']['dxy']['value']} ({md['tier_a']['dxy']['change_pct']:+.2f}%, 점수:{md['tier_a']['dxy']['score']})
- 미국10년물금리: {md['tier_a']['us10y']['value']} ({md['tier_a']['us10y']['change_bps']:+.1f}bp, 점수:{md['tier_a']['us10y']['score']})
- VIX: {md['tier_a']['vix']['value']} ({md['tier_a']['vix']['change_pct']:+.2f}%, 점수:{md['tier_a']['vix']['score']})"""
        except Exception as macro_err:
            print(f"[CompanyAnalysis BG] Macro fetch error (non-fatal): {macro_err}")

        try:
            stock_trends = kiwoom.get_investor_trends(symbol)
            def _fmt(data, label):
                if not data: return ""
                parts = []
                if data.get('foreign') is not None: parts.append(f"외국인 {data['foreign']:+,}")
                if data.get('institution') is not None: parts.append(f"기관 {data['institution']:+,}")
                if data.get('individual') is not None: parts.append(f"개인 {data['individual']:+,}")
                return f"- {label}: {', '.join(parts)}" if parts else ""
            lines = []
            if stock_trends:
                lines.append("\n## 투자자별 매매동향")
                lines.append(_fmt(stock_trends, f"해당종목({symbol}) 당일"))
            investor_context = "\n".join(lines)
        except Exception as inv_err:
            print(f"[CompanyAnalysis BG] Investor trends error (non-fatal): {inv_err}")

        dart_context = ""
        try:
            from collectors.dart_collector import get_company_overview, collect_dart_filings
            overview = get_company_overview(symbol)
            if overview:
                est = overview['est_dt']
                est_fmt = f"{est[:4]}.{est[4:6]}.{est[6:8]}" if len(est) == 8 else est
                dart_context += f"\n## DART 기업개황\n- 업종: {overview['induty_name']}\n- 대표자: {overview['ceo_nm']}\n- 설립일: {est_fmt}\n"

            filings = collect_dart_filings([{"symbol": symbol, "name": stock_name}], days=3)
            if filings.get("filings_text"):
                dart_context += f"\n## 최근 공시 (3일)\n{filings['filings_text']}\n"
            if dart_context:
                print(f"[CompanyAnalysis BG] DART context added")
        except Exception as dart_err:
            print(f"[CompanyAnalysis BG] DART error (non-fatal): {dart_err}")

        user_prompt = f"""다음 기업의 재무 데이터를 분석해주세요:

{data_prompt}
{macro_context}
{investor_context}
{dart_context}
위 데이터를 기반으로 투자 관점의 종합 분석 보고서를 작성해주세요."""

        analysis = await llm.a_analyze_text(
            system_prompt=COMPANY_ANALYSIS_SYSTEM_PROMPT,
            user_text=user_prompt,
            model="auto"
        )

        await analysis_db.connect()
        await analysis_db.save_analysis(
            symbol=symbol,
            timeframe="fundamental",
            analysis_type="company_fundamental",
            content={
                "analysis": analysis,
                "stock_name": stock_name,
                "data_prompt": data_prompt,
            },
        )
        print(f"[CompanyAnalysis BG] Saved for {stock_name}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[CompanyAnalysis BG] Error for {symbol}: {e}")


COMPANY_ANALYSIS_SYSTEM_PROMPT = """당신은 한국 주식시장 전문 펀더멘탈 애널리스트입니다.
아래 기업의 재무 지표 데이터를 기반으로 투자 관점의 종합 분석 보고서를 작성하세요.

## 분석 구조 (반드시 이 순서로)

### 1. 밸류에이션 평가
- PER, PBR을 업종 평균 대비 평가 (한국 시장 기준: KOSPI 평균 PER ~12, PBR ~1.0)
- **주의**: 제공된 PER은 trailing(과거 실적 기준). 반도체·경기민감주는 업황 사이클에 따라 trailing PER이 왜곡될 수 있으므로, 업황 회복 시 forward PER이 크게 낮아질 수 있음을 반드시 언급
- 현재 주가가 가치 대비 저평가/적정/고평가인지 판단
- EV가 있으면 기업가치 관점도 포함

### 2. 수익성 분석
- ROE 수준 평가: 단순 10%/15% 기준 적용 금지. 시가총액 100조 이상 대형주는 자본규모가 커서 ROE가 구조적으로 낮음(7~10%도 양호). 업종별 평균과 비교할 것
- 영업이익률 = 영업이익/매출 비율 계산 및 평가
- 순이익 규모와 EPS를 통한 주당 수익력 평가

### 3. 투자 매력도
- 외국인 보유비율: 30% 이상이면 글로벌 기관 선호 종목
- 신용비율: 3% 이상이면 개인 과열 주의
- 액면배당률(주당배당금÷액면가×100)이 제공됨. 이는 배당수익률(yield)과 다르므로 혼동하지 말 것. 배당수익률은 별도 계산 필요(주당배당금÷주가)
- 연중 고가/저가 대비 현재 위치 (고가 근처면 차익실현 주의, 저가 근처면 매수 기회 가능)

### 4. 시장 환경 컨텍스트 (매크로/수급 데이터가 제공된 경우)
- 매크로 안전등급(Level 1~5)과 시장 방향성 예측이 이 종목에 미치는 영향
- 투자자별 매매동향: 외국인/기관 순매수 여부가 주가에 미치는 시사점
- 시장 전체 수급 vs 종목 수급의 괴리가 있다면 의미 해석

### 5. 종합 투자의견
- 위 분석을 종합하여 한줄 투자의견 (예: "밸류에이션 매력적이나 수익성 개선 필요")
- 주요 리스크 요인 1~2가지
- 주요 모멘텀 요인 1~2가지

## 응답 규칙
- 한국어로 작성
- 수치는 반드시 포함하여 근거 제시
- 보고서 총 길이: 500~800자
- 마크다운 형식 사용 (**굵게**, 줄바꿈 등)
- 불확실한 추론은 "~로 추정됩니다" 등 표현 사용
- 매크로/수급 데이터가 없으면 해당 섹션 생략
"""

@router.post("/api/strategy/company-analysis")
async def run_company_analysis(request: CompanyAnalysisRequest):
    """
    AI-powered company fundamental analysis using LLM.
    Receives pre-built data string from frontend and generates analysis report.
    Enriched with macro dashboard data + investor trading trends.
    """
    try:
        from database import analysis_db
        llm = LLMClient()

        # Fetch macro + investor context in parallel
        macro_context = ""
        investor_context = ""

        try:
            # 1. Macro data from DB
            await analysis_db.connect()
            async with analysis_db.pool.acquire() as conn:
                macro_row = await conn.fetchrow(
                    "SELECT * FROM macro_daily WHERE date = CURRENT_DATE"
                )
            if macro_row:
                md = _macro_row_to_dict(macro_row)
                macro_context = f"""
## 오늘의 매크로 시장 환경
- 안전등급: Level {md['safety_level']} (종합점수: {md['overall_score']:+.2f})
- 시장방향 예측: {md['prediction_direction']}
- DXY(달러인덱스): {md['tier_a']['dxy']['value']} ({md['tier_a']['dxy']['change_pct']:+.2f}%, 점수:{md['tier_a']['dxy']['score']})
- 미국10년물금리: {md['tier_a']['us10y']['value']} ({md['tier_a']['us10y']['change_bps']:+.1f}bp, 점수:{md['tier_a']['us10y']['score']})
- VIX: {md['tier_a']['vix']['value']} ({md['tier_a']['vix']['change_pct']:+.2f}%, 점수:{md['tier_a']['vix']['score']})
- 외국인현물순매수: {md['tier_b']['foreign_cash']['net_amount']}억 (점수:{md['tier_b']['foreign_cash']['score']})
- 선물순매수: {md['tier_b']['futures']['net']}계약 (점수:{md['tier_b']['futures']['score']})
- 공매도: {md['tier_b']['short_selling']['change_pct']:+.1f}% (점수:{md['tier_b']['short_selling']['score']})
- 해석: {md['interpretation']}"""
        except Exception as macro_err:
            print(f"[CompanyAnalysis] Macro fetch error (non-fatal): {macro_err}")

        try:
            # 2. Investor trends (per-stock + market proxy) — today + 5-day history
            from collectors.kiwoom import KiwoomCollector
            kiwoom = KiwoomCollector()
            stock_trends = kiwoom.get_investor_trends(request.symbol)
            market_trends = kiwoom.get_investor_trends("069500")  # KODEX 200
            stock_history = kiwoom.get_investor_trends_history(request.symbol, 5)

            def _fmt_trends(data, label):
                if not data:
                    return ""
                parts = []
                if data.get('foreign') is not None:
                    parts.append(f"외국인 {data['foreign']:+,}")
                if data.get('institution') is not None:
                    parts.append(f"기관 {data['institution']:+,}")
                if data.get('individual') is not None:
                    parts.append(f"개인 {data['individual']:+,}")
                return f"- {label}: {', '.join(parts)}" if parts else ""

            lines = []
            if market_trends or stock_trends:
                lines.append("\n## 투자자별 매매동향 (순매수, 수량 기준)")
            if market_trends:
                lines.append(_fmt_trends(market_trends, "시장전체(KODEX200) 당일"))
            if stock_trends:
                lines.append(_fmt_trends(stock_trends, f"해당종목({request.symbol}) 당일"))

            # 5-day history for trend analysis
            if stock_history and len(stock_history) > 1:
                lines.append(f"\n### 최근 {len(stock_history)}일 종목 투자자 추세 (최신→과거)")
                for day in stock_history:
                    f = f"외인:{day['foreign']:+,}" if day.get('foreign') is not None else "외인:-"
                    i = f"기관:{day['institution']:+,}" if day.get('institution') is not None else "기관:-"
                    p = f"개인:{day['individual']:+,}" if day.get('individual') is not None else "개인:-"
                    lines.append(f"- {day.get('date', '?')}: {f}, {i}, {p}")

            investor_context = "\n".join(lines)
        except Exception as inv_err:
            print(f"[CompanyAnalysis] Investor trends fetch error (non-fatal): {inv_err}")

        user_prompt = f"""다음 기업의 재무 데이터를 분석해주세요:

{request.data_prompt}
{macro_context}
{investor_context}

위 데이터를 기반으로 투자 관점의 종합 분석 보고서를 작성해주세요."""

        analysis = await llm.a_analyze_text(
            system_prompt=COMPANY_ANALYSIS_SYSTEM_PROMPT,
            user_text=user_prompt,
            model="auto"
        )

        # Save to analysis DB
        try:
            await analysis_db.connect()
            await analysis_db.save_analysis(
                symbol=request.symbol,
                timeframe="fundamental",
                analysis_type="company_fundamental",
                content={"analysis": analysis, "data_prompt": request.data_prompt},
            )
        except Exception as save_err:
            print(f"[CompanyAnalysis] DB save error (non-fatal): {save_err}")

        return {
            "status": "success",
            "symbol": request.symbol,
            "analysis": analysis
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _macro_row_to_dict(row) -> dict:
    """asyncpg Record → dict 변환"""
    d = dict(row)

    def _safe_float(key):
        v = d.get(key)
        return float(v) if v is not None else None

    def _safe_float_or_zero(key):
        v = d.get(key)
        return float(v) if v is not None else 0

    return {
        "date": d["date"].isoformat() if hasattr(d["date"], "isoformat") else str(d["date"]),
        "kr_market_day": d.get("kr_market_day", ""),
        "us_market_date": d["us_market_date"].isoformat() if d.get("us_market_date") and hasattr(d["us_market_date"], "isoformat") else str(d.get("us_market_date", "")),
        "us_market_day": d.get("us_market_day", ""),
        "tier_a": {
            "dxy": {
                "value": _safe_float("dxy_value"),
                "change_pct": _safe_float_or_zero("dxy_change_pct"),
                "score": d.get("dxy_score")
            },
            "us10y": {
                "value": _safe_float("us10y_value"),
                "change_bps": _safe_float_or_zero("us10y_change_bps"),
                "score": d.get("us10y_score")
            },
            "vix": {
                "value": _safe_float("vix_value"),
                "change_pct": _safe_float_or_zero("vix_change_pct"),
                "score": d.get("vix_score")
            }
        },
        "tier_b": {
            "foreign_cash": {"net_amount": d.get("foreign_net_amount"), "score": d.get("foreign_score")},
            "futures": {"net": d.get("futures_net"), "score": d.get("futures_score")},
            "short_selling": {
                "volume": d.get("short_volume"),
                "change_pct": _safe_float_or_zero("short_change_pct"),
                "score": d.get("short_score")
            }
        },
        "global_markets": {
            "nasdaq": {"value": _safe_float("nasdaq_value"), "change_pct": _safe_float_or_zero("nasdaq_change_pct")},
            "sp500": {"value": _safe_float("sp500_value"), "change_pct": _safe_float_or_zero("sp500_change_pct")},
            "oil": {"value": _safe_float("oil_value"), "change_pct": _safe_float_or_zero("oil_change_pct")},
            "gold": {"value": _safe_float("gold_value"), "change_pct": _safe_float_or_zero("gold_change_pct")},
            "bitcoin": {"value": _safe_float("bitcoin_value"), "change_pct": _safe_float_or_zero("bitcoin_change_pct")},
            "krw_usd": {"value": _safe_float("krw_usd_value"), "change": _safe_float_or_zero("krw_usd_change"), "change_pct": _safe_float_or_zero("krw_usd_change_pct")},
            "ewy": {"value": _safe_float("ewy_value"), "change_pct": _safe_float_or_zero("ewy_change_pct")},
        },
        "risk_indicators": {
            "us2y": {"value": _safe_float("us2y_value"), "change_bps": _safe_float_or_zero("us2y_change_bps")},
            "spread_2s10s": _safe_float("spread_2s10s"),
            "hy_spread": {"value": _safe_float("hy_spread_value"), "change_bps": _safe_float_or_zero("hy_spread_change_bps")},
            "move": {"value": _safe_float("move_value"), "change_pct": _safe_float_or_zero("move_change_pct")},
            "us30y": {"value": _safe_float("us30y_value"), "change_bps": _safe_float_or_zero("us30y_change_bps")},
        },
        "overall_score": _safe_float_or_zero("overall_score"),
        "safety_level": d.get("safety_level"),
        "prediction_direction": d.get("prediction_direction"),
        "interpretation": d.get("interpretation"),
        "chain_analysis": d.get("chain_analysis", ""),
        "llm_analysis": d.get("llm_analysis", ""),
        "llm_analysis_pm": d.get("llm_analysis_pm", ""),
        "collected_at_am": d["collected_at_am"].isoformat() if d.get("collected_at_am") else None,
        "collected_at_pm": d["collected_at_pm"].isoformat() if d.get("collected_at_pm") else None,
        "news_context": d.get("news_context", ""),
        "economic_calendar": d.get("economic_calendar"),
    }
