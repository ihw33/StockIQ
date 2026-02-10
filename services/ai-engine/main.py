from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn
import os
import asyncio
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from project root .env.local
# services/ai-engine/main.py -> ../../.env.local
env_path = os.path.join(os.path.dirname(__file__), '../../.env.local')
load_dotenv(env_path)

from strategies.morning import MorningIntelligence
from strategies.chart_analyst import ChartAnalyst
from alpha_hr.collector import AlphaHRCollector
from alpha_hr.etl import AlphaHRETL
from alpha_hr.diff_engine import AlphaHRDiffEngine
from alpha_hr.analyzer import AlphaHRAnalyzer

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="StockIQ AI Engine", description="Python-based AI Trading Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev convenience, or specify ["http://localhost:3002"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "active", "service": "StockIQ AI Engine"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/strategy/morning-briefing")
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

from typing import Optional

class ChartAnalysisRequest(BaseModel):
    symbol: str
    mode: Optional[str] = "llm" 
    query: Optional[str] = None
    position_info: Optional[dict] = None

@app.post("/api/strategy/chart-analysis")
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

        # LLM 심층분석 성공 시 DB에 자동 저장 (개별 호출 시)
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

class DeepAnalysisRequest(BaseModel):
    symbol: str
    position_info: Optional[dict] = None

@app.post("/api/strategy/deep-analysis-start")
async def start_deep_analysis(request: DeepAnalysisRequest, background_tasks: BackgroundTasks):
    """
    심층분석을 백그라운드로 시작. 즉시 응답 후 서버에서 algo+LLM 실행 → DB 저장.
    프론트엔드는 /api/reports/pending 폴링으로 완료 감지.
    """
    if not request.symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    background_tasks.add_task(_run_deep_analysis_bg, request.symbol, request.position_info)
    return {"status": "started", "symbol": request.symbol}

async def _run_deep_analysis_bg(symbol: str, position_info: Optional[dict] = None):
    """백그라운드에서 algo + LLM 심층분석 실행 후 DB 저장 (각각 별도 저장, 같은 날 덮어쓰기)"""
    try:
        from database import analysis_db
        from collectors.kiwoom import KiwoomCollector

        strategy = ChartAnalyst()

        # 종목명 조회
        kiwoom = KiwoomCollector()
        company_info = kiwoom.get_company_info(symbol)
        stock_name = company_info.get('stk_nm', symbol) if company_info else symbol

        # 1) Algo 분석 → 별도 저장
        print(f"[DeepAnalysis BG] Starting algo for {stock_name}({symbol})")
        algo_result = await strategy.analyze(symbol, "algo", None, position_info)
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
            print(f"[DeepAnalysis BG] Algo saved for {stock_name}")

        # 2) LLM 심층분석 → 별도 저장
        print(f"[DeepAnalysis BG] Starting LLM for {stock_name}({symbol})")
        llm_result = await strategy.analyze(symbol, "llm", None, position_info)
        if llm_result.get("status") == "success":
            await analysis_db.connect()
            await analysis_db.save_analysis(
                symbol=symbol,
                timeframe="deep_analysis",
                analysis_type="deep_llm",
                content={
                    "analysis": llm_result.get("analysis", ""),
                    "stock_name": stock_name,
                    "source": llm_result.get("source", ""),
                },
            )
            print(f"[DeepAnalysis BG] LLM saved for {stock_name}")
        else:
            print(f"[DeepAnalysis BG] LLM failed for {symbol}: {llm_result.get('error')}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[DeepAnalysis BG] Error for {symbol}: {e}")


class AlgoAnalysisRequest(BaseModel):
    symbol: str

@app.post("/api/strategy/algo-analysis-start")
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

class CompanyAnalysisStartRequest(BaseModel):
    symbol: str

@app.post("/api/strategy/company-analysis-start")
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

        user_prompt = f"""다음 기업의 재무 데이터를 분석해주세요:

{data_prompt}
{macro_context}
{investor_context}

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


class AlphaHRRequest(BaseModel):
    company_name: str

@app.post("/api/alpha-hr/analyze")
async def analyze_alpha_hr(request: AlphaHRRequest):
    """
    Executes the full Alpha-HR Pipeline:
    1. Collect (Perplexity)
    2. ETL (Gemini Flash)
    3. Diff (vs Mock History for MVP)
    4. Analyze (Gemini Pro)
    """
    try:
        print(f"[Alpha-HR] Starting analysis for {request.company_name}...")
        
        # 1. Collect
        collector = AlphaHRCollector()
        raw_data = collector.search_hr_data(request.company_name)
        
        # 2. ETL
        etl = AlphaHRETL()
        current_snapshots = etl.extract_job_snapshots(raw_data['raw_content'], request.company_name)
        
        # 3. Diff (Mocking t-1 as empty or static for demo)
        # For a better demo, let's mock t-1 as having "some" of these jobs but fewer
        mock_t1 = [] 
        if len(current_snapshots) > 2:
            mock_t1 = current_snapshots[:-2] # Pretend the last 2 are new
        
        diff_engine = AlphaHRDiffEngine()
        diff_report = diff_engine.compute_diff(mock_t1, current_snapshots)
        
        # 4. Analyze
        analyzer = AlphaHRAnalyzer()
        signal = analyzer.analyze_signals(request.company_name, diff_report)
        
        return {
            "status": "success",
            "company": request.company_name,
            "signal": signal,
            "diff_summary": diff_report,
            "raw_sources": raw_data['citations']
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from collectors.us_market import USMarketCollector

@app.get("/api/market/map")
def get_market_map():
    """
    Returns hierarchical data for the Market Treemap.
    """
    collector = USMarketCollector()
    return collector.get_market_map_data()


# ============ Custom Stock Screener ============
from strategies.screener import run_custom_screen, get_screener, get_screener_profiles
from typing import Dict, Any

class ScreenerRequest(BaseModel):
    profile_id: Optional[str] = "momentum_surge"
    params: Optional[Dict[str, Any]] = None
    min_score: Optional[int] = 10
    max_stocks: Optional[int] = 500

@app.post("/api/screener/run")
async def run_screener(request: ScreenerRequest = ScreenerRequest()):
    """
    Runs the custom stock screener with user-defined conditions.
    profile_id: Screener profile ID (default: momentum_surge)
    params: Custom parameter overrides
    min_score: Minimum number of conditions to match (default: 10 = all)
    max_stocks: Maximum number of stocks to check (default: 500)
    """
    try:
        result = await run_custom_screen(
            profile_id=request.profile_id,
            params=request.params,
            min_score=request.min_score,
            max_stocks=request.max_stocks
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/screener/profiles")
async def get_profiles():
    """
    Returns the list of available screener profiles.
    """
    profiles = await get_screener_profiles()
    return {"profiles": profiles}

@app.get("/api/screener/conditions")
def get_screener_conditions(profile_id: str = "momentum_surge"):
    """
    Returns the list of screener conditions for a specific profile.
    """
    screener = get_screener()
    return {"conditions": screener.get_conditions_info(profile_id)}


# ============ Analysis Storage ============
from database import analysis_db

class SaveAnalysisRequest(BaseModel):
    symbol: str
    timeframe: str
    analysis_type: str
    content: Dict[str, Any]
    current_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None

@app.post("/api/analysis/save")
async def save_analysis(request: SaveAnalysisRequest):
    """
    Save analysis result to database
    """
    try:
        analysis_id = await analysis_db.save_analysis(
            symbol=request.symbol,
            timeframe=request.timeframe,
            analysis_type=request.analysis_type,
            content=request.content,
            current_price=request.current_price,
            target_price=request.target_price,
            stop_loss=request.stop_loss
        )
        return {
            "status": "success",
            "id": analysis_id,
            "message": f"분석 결과가 저장되었습니다 (ID: {analysis_id})"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/pending")
async def get_pending_reports(minutes: int = 30):
    """
    최근 N분 이내 저장된 보고서 목록 반환 (algo + deep_llm + company_fundamental).
    프론트엔드에서 폴링하여 백그라운드 분석 완료를 감지.
    """
    try:
        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, symbol, analyzed_at, analysis_type, content
                   FROM analysis_history
                   WHERE analysis_type IN ('algo', 'deep_llm', 'company_fundamental')
                     AND analyzed_at >= NOW() - ($1 || ' minutes')::interval
                   ORDER BY analyzed_at DESC
                   LIMIT 20""",
                str(minutes)
            )
        reports = []
        for r in rows:
            content = r['content'] if isinstance(r['content'], dict) else json.loads(r['content']) if r['content'] else {}
            reports.append({
                "id": r['id'],
                "symbol": r['symbol'],
                "stock_name": content.get('stock_name', r['symbol']),
                "analysis_type": r['analysis_type'],
                "analyzed_at": r['analyzed_at'].isoformat(),
                "analysis": content.get('analysis', ''),
            })
        return {"status": "success", "count": len(reports), "reports": reports}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/history")
async def get_analysis_history(
    symbol: Optional[str] = None,
    days: int = 7,
    limit: int = 50
):
    """
    Get analysis history
    """
    try:
        history = await analysis_db.get_history(
            symbol=symbol,
            days=days,
            limit=limit
        )
        return {
            "status": "success",
            "count": len(history),
            "history": history
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============ Company Fundamentals ============
from collectors.kiwoom import KiwoomCollector

@app.get("/api/company/{symbol}/fundamentals")
async def get_company_fundamentals(symbol: str):
    """
    Get company fundamental data (PER, PBR, ROE, EPS)
    Caches data in DB for 1 day
    """
    try:
        # Ensure DB is connected
        await analysis_db.connect()
        
        # Check if we have recent data in DB (within 24 hours)
        async with analysis_db.pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT * FROM company_financials WHERE symbol = $1 AND date = CURRENT_DATE",
                symbol
            )
            
            # Always fetch extended data from Kiwoom for full info
            kiwoom = KiwoomCollector()
            ext_data = kiwoom.get_company_info(symbol)

            if existing:
                base = {
                    "symbol": symbol,
                    "per": float(existing['per']) if existing['per'] else None,
                    "pbr": float(existing['pbr']) if existing['pbr'] else None,
                    "roe": float(existing['roe']) if existing['roe'] else None,
                    "eps": float(existing['eps']) if existing['eps'] else None,
                    "bps": float(existing['bps']) if existing['bps'] else None,
                    "market_cap": existing['market_cap'],
                    "updated_at": existing['updated_at'].isoformat()
                }
                # Merge extended data
                if ext_data:
                    for k in ['ev', 'stk_nm', 'settle_month', 'listed_shares', 'credit_ratio',
                              'year_high', 'year_low', 'high_250', 'low_250', 'foreign_ratio',
                              'sales', 'operating_profit', 'net_income', 'dividend_rate', 'market_cap']:
                        if ext_data.get(k) is not None:
                            base[k] = ext_data[k]
                return {
                    "status": "success",
                    "source": "cache",
                    "data": base
                }
        
        # No cache — use the data already fetched above
        data = ext_data

        if not data:
            raise HTTPException(status_code=404, detail="Company data not found")
        
        # Save to DB
        async with analysis_db.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO company_financials 
                (symbol, per, pbr, roe, eps, bps, market_cap, date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
                ON CONFLICT (symbol, date) DO UPDATE
                SET per = $2, pbr = $3, roe = $4, eps = $5, bps = $6, market_cap = $7, updated_at = NOW()
                """,
                symbol,
                data.get('per'),
                data.get('pbr'),
                data.get('roe'),
                data.get('eps'),
                data.get('bps'),
                data.get('market_cap')
            )
        
        return {
            "status": "success",
            "source": "api",
            "data": {
                "symbol": symbol,
                "per": data.get('per'),
                "pbr": data.get('pbr'),
                "roe": data.get('roe'),
                "eps": data.get('eps'),
                "bps": data.get('bps'),
                "ev": data.get('ev'),
                "market_cap": data.get('market_cap'),
                "stk_nm": data.get('stk_nm', ''),
                "settle_month": data.get('settle_month', ''),
                "listed_shares": data.get('listed_shares'),
                "credit_ratio": data.get('credit_ratio'),
                "year_high": data.get('year_high'),
                "year_low": data.get('year_low'),
                "high_250": data.get('high_250'),
                "low_250": data.get('low_250'),
                "foreign_ratio": data.get('foreign_ratio'),
                "sales": data.get('sales'),
                "operating_profit": data.get('operating_profit'),
                "net_income": data.get('net_income'),
                "dividend_rate": data.get('dividend_rate'),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============ Investor Trading Trends ============

@app.get("/api/company/{symbol}/investor-trends")
async def get_investor_trends(symbol: str):
    """종목별 투자자 매매동향 (당일 누적 순매수)"""
    try:
        kiwoom = KiwoomCollector()
        stock_data = kiwoom.get_investor_trends(symbol)
        if not stock_data:
            return {"status": "no_data", "data": None}
        return {"status": "success", "data": stock_data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/company/{symbol}/investor-history")
async def get_investor_history(symbol: str, days: int = 60):
    """종목별 투자자 순매수 히스토리 + 주가 (최근 N일)"""
    try:
        kiwoom = KiwoomCollector()
        d = min(days, 90)
        history = kiwoom.get_investor_trends_history(symbol, days=d)
        if not history:
            return {"status": "no_data", "data": [], "cumulative": None}

        # ka10059 응답에서 가격+투자자 데이터 모두 포함 (ka10081 별도 호출 불필요)
        # 거래량/대비 0인 첫 행(미래날짜) 제거
        data = [h for h in history if h.get('volume', 0) > 0 or h.get('close', 0) == 0]
        if data and data[0].get('volume', 0) == 0 and data[0].get('individual', 0) == 0:
            data = data[1:]

        # 누적 합산
        cum = {'foreign': 0, 'institution': 0, 'individual': 0}
        for h in data:
            cum['foreign'] += h['foreign']
            cum['institution'] += h['institution']
            cum['individual'] += h['individual']

        return {"status": "success", "data": data, "cumulative": cum}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============ Market Investor Trends ============

@app.get("/api/market/investor-trends")
async def get_market_investor_trends():
    """KOSPI 전체 시장 투자자별 매매동향 (ka10066 via MacroDashboardCollector)"""
    try:
        from collectors.macro_dashboard import MacroDashboardCollector
        collector = MacroDashboardCollector()
        token = collector._get_token()
        if not token:
            return {"status": "no_data", "data": None}

        from datetime import datetime as dt
        import requests as req
        today = dt.now().strftime("%Y%m%d")
        url = f"{collector.base_url}/api/dostk/mrkcond"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10066",
            "Authorization": f"Bearer {token}"
        }
        body = {
            "stk_cd": "001",
            "mrkt_tp": "001",
            "strtt_dt": today,
            "end_dt": today,
            "amt_qty_tp": "2",  # 금액(백만원)
            "trde_tp": "0",
            "stex_tp": "1"
        }
        res = req.post(url, headers=headers, json=body, timeout=10)
        res.raise_for_status()
        data = res.json()

        items = data.get("opaf_invsr_trde", [])
        if not items:
            for k, v in data.items():
                if isinstance(v, list) and len(v) > 0:
                    items = v
                    break

        if not items:
            return {"status": "no_data", "data": None}

        # Debug: check structure
        print(f"[MarketTrends] items count: {len(items)}")
        if items:
            print(f"[MarketTrends] first keys: {list(items[0].keys())[:10]}")
            # Check if there's a total/합계 row
            for i, item in enumerate(items[:5]):
                stk_cd = item.get('stk_cd', '')
                stk_nm = item.get('stk_nm', '')
                frgnr = item.get('frgnr_invsr', '0')
                print(f"[MarketTrends] [{i}] stk_cd={stk_cd} stk_nm={stk_nm} frgnr={frgnr}")

        # Sum all rows for market total
        def safe_int(v):
            try:
                s = str(v).replace(',', '').replace('+', '').strip()
                return int(s) if s else 0
            except:
                return 0

        total_foreign = 0
        total_finance = 0
        total_insurance = 0
        total_invest_trust = 0
        total_etc_finance = 0
        total_bank = 0
        total_pension = 0
        total_private_fund = 0
        total_etc_corp = 0
        total_individual = 0

        for row in items:
            total_foreign += safe_int(row.get('frgnr_invsr'))
            total_finance += safe_int(row.get('fnnc_invt'))
            total_insurance += safe_int(row.get('insrnc'))
            total_invest_trust += safe_int(row.get('invtrt'))
            total_etc_finance += safe_int(row.get('etc_fnnc'))
            total_bank += safe_int(row.get('bank'))
            total_pension += safe_int(row.get('penfnd_etc'))
            total_private_fund += safe_int(row.get('samo_fund'))
            total_etc_corp += safe_int(row.get('etc_corp'))
            total_individual += safe_int(row.get('ind_invsr'))

        institution = total_finance + total_insurance + total_invest_trust + total_etc_finance + total_bank + total_pension + total_private_fund
        individual = total_individual if total_individual != 0 else -(total_foreign + institution + total_etc_corp)

        print(f"[MarketTrends] TOTAL foreign={total_foreign} institution={institution} individual={individual}")

        # 백만원 → 억원 변환 (100백만 = 1억)
        return {
            "status": "success",
            "data": {
                "date": today,
                "foreign": round(total_foreign / 100),
                "institution": round(institution / 100),
                "individual": round(individual / 100),
                "unit": "억원",
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============ After-Hours Trading Data ============

@app.get("/api/company/{symbol}/after-hours")
async def get_after_hours(symbol: str):
    """시간외/넥스트 시장 가격 조회. NEXT → ka10087 순으로 시도."""
    try:
        kiwoom = KiwoomCollector()

        # 1) NEXT 시장 시도 (_AL, _NX 접미사)
        next_data = kiwoom.get_next_market_price(symbol)
        if next_data and next_data.get('cur_price'):
            print(f"[AfterHours] {symbol} NEXT: price={next_data['cur_price']}, source={next_data.get('source')}")
            return {"status": "success", "data": next_data}

        # 2) 기존 ka10087 시간외 단일가 시도
        data = kiwoom.get_after_hours(symbol)
        if not data or not data.get('cur_price'):
            print(f"[AfterHours] No data returned for {symbol}")
            return {"status": "no_data", "data": None}
        data['source'] = 'ka10087'
        print(f"[AfterHours] {symbol}: price={data.get('cur_price')}, change={data.get('change')}")
        return {"status": "success", "data": data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============ Company AI Analysis ============
from llm_client import LLMClient

class CompanyAnalysisRequest(BaseModel):
    symbol: str
    data_prompt: str  # Pre-built data string from frontend

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

@app.post("/api/strategy/company-analysis")
async def run_company_analysis(request: CompanyAnalysisRequest):
    """
    AI-powered company fundamental analysis using LLM.
    Receives pre-built data string from frontend and generates analysis report.
    Enriched with macro dashboard data + investor trading trends.
    """
    try:
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


# ============ Macro Dashboard ============
from collectors.macro_dashboard import MacroDashboardCollector
from collectors.news_collector import collect_all_news
from collectors.dart_collector import collect_dart_filings
from collectors.llm_analyzer import generate_team_briefing, generate_pm_briefing
from collectors.economic_calendar_collector import collect_calendar
from datetime import date, timedelta
import json

class MacroCollectRequest(BaseModel):
    portfolio: Optional[list] = None  # [{"symbol":"005930","name":"삼성전자","type":"holding"}, ...]
    watchlist: Optional[list] = None  # [{"symbol":"000660","name":"SK하이닉스","type":"watchlist"}, ...]
    mode: Optional[str] = "am"  # "am" | "manual" | "pm"

def _fetch_holdings_from_kiwoom() -> list:
    """키움 API에서 실제 보유종목 자동 조회"""
    account_no = os.getenv("KIWOOM_ACCOUNT")
    if not account_no:
        logger.warning("[Macro] KIWOOM_ACCOUNT not set — 보유종목 자동조회 불가")
        return []
    try:
        kiwoom = KiwoomCollector()
        raw = kiwoom.get_holdings(account_no)
        holdings = []
        for h in raw:
            symbol = h.get("stk_cd", "").replace("A", "")
            name = h.get("stk_nm", symbol)
            if symbol:
                holdings.append({"symbol": symbol, "name": name, "type": "holding"})
        logger.info(f"[Macro] 키움 보유종목 {len(holdings)}개 조회: {[h['name'] for h in holdings]}")
        return holdings
    except Exception as e:
        logger.error(f"[Macro] 키움 보유종목 조회 실패: {e}")
        return []

@app.post("/api/macro/collect")
async def collect_macro_data(request: MacroCollectRequest = MacroCollectRequest()):
    """
    매크로 데이터 수집 → DB 저장.
    전날 데이터의 actual 값도 backfill.
    보유종목: 키움 API 자동 조회 (KIWOOM_ACCOUNT 설정 필요)
    관심종목: request.watchlist로 전달
    """
    try:
        await analysis_db.connect()

        # 1. 조정된 가중치 가져오기 (20일 이상 데이터 있으면)
        collector = MacroDashboardCollector()
        adjusted_weights = None

        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM macro_daily WHERE actual_kospi_change IS NOT NULL ORDER BY date DESC LIMIT 20"
            )
            if len(rows) >= 20:
                history = [dict(r) for r in rows]
                accuracy = collector.calculate_indicator_accuracy(history)
                adjusted_weights = collector.get_adjusted_weights(accuracy)

        # 2. 오늘 데이터 수집
        result = collector.collect_all(adjusted_weights)

        # 3. 전날 actual backfill (오늘의 외국인 순매매 = 전날 예측의 actual)
        async with analysis_db.pool.acquire() as conn:
            yesterday = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date < CURRENT_DATE AND actual_kospi_change IS NULL ORDER BY date DESC LIMIT 1"
            )
            if yesterday:
                # KOSPI 변동은 오늘 외국인 현물 순매매 방향으로 대체 추정
                # (실제 KOSPI 변동은 별도 수집 필요 — 간이 방식)
                today_foreign = result["tier_b"]["foreign_cash"]["net_amount"]
                kospi_proxy = 0.5 if today_foreign > 0 else (-0.5 if today_foreign < 0 else 0)

                await conn.execute(
                    """UPDATE macro_daily
                       SET actual_kospi_change = $1, actual_foreign_net = $2, updated_at = NOW()
                       WHERE date = $3""",
                    kospi_proxy, today_foreign, yesterday["date"]
                )

        # 4. 보유종목 자동 조회 + 관심종목 합치기
        kiwoom_holdings = _fetch_holdings_from_kiwoom()
        manual_holdings = [s for s in (request.portfolio or []) if s.get("type") == "holding"]
        watchlist = [dict(s, type="watchlist") for s in (request.watchlist or [])]

        # 키움 자동조회 우선, 수동 입력은 보충
        all_holdings = kiwoom_holdings if kiwoom_holdings else manual_holdings
        portfolio_symbols = all_holdings + watchlist
        logger.info(f"[Macro] Portfolio: 보유 {len(all_holdings)}개, 관심 {len(watchlist)}개")

        # 5. 경제 캘린더 수집
        calendar_data = {}
        try:
            calendar_data = collect_calendar()
            logger.info(f"[Macro] Calendar: {len(calendar_data.get('economic_events', []))} events")
        except Exception as cal_err:
            logger.warning(f"[Macro] Calendar error (non-fatal): {cal_err}")

        result["economic_calendar"] = calendar_data

        # 6. 뉴스 수집 + LLM 브리핑 (모드별 분기)
        mode = request.mode or "am"
        news_data = {}
        llm_analysis = None
        llm_analysis_pm = None
        collected_at_pm = None
        try:
            news_data = collect_all_news(portfolio_symbols if portfolio_symbols else None)
            logger.info(f"[Macro] News collected: {len(news_data.get('macro_news', ''))} chars")

            # DART 공시 수집 (보유종목)
            try:
                dart_data = collect_dart_filings(portfolio_symbols if portfolio_symbols else [], days=3)
                if dart_data.get("filings_text"):
                    news_data["dart_filings"] = dart_data["filings_text"]
                    logger.info(f"[Macro] DART filings: {len(dart_data.get('filings', []))}건")
            except Exception as dart_err:
                logger.warning(f"[Macro] DART error (non-fatal): {dart_err}")

            if mode == "am" and news_data.get("macro_news"):
                # AM 예측 브리핑
                llm_analysis = generate_team_briefing(result, news_data, portfolio_symbols if portfolio_symbols else None)
                logger.info(f"[Macro] AM briefing: {len(llm_analysis or '')} chars")
            elif mode == "pm" and news_data.get("macro_news"):
                # PM 결산 브리핑: DB에서 당일 AM 예측 가져오기
                am_prediction = None
                try:
                    async with analysis_db.pool.acquire() as conn:
                        am_row = await conn.fetchrow(
                            "SELECT llm_analysis FROM macro_daily WHERE date = CURRENT_DATE"
                        )
                    if am_row:
                        am_prediction = am_row["llm_analysis"]
                except Exception:
                    pass
                llm_analysis_pm = generate_pm_briefing(result, news_data, am_prediction, portfolio_symbols if portfolio_symbols else None)
                collected_at_pm = dt_datetime.now(pytz.timezone('Asia/Seoul'))
                logger.info(f"[Macro] PM briefing: {len(llm_analysis_pm or '')} chars")
            # manual 모드: LLM 호출 없음 (데이터만 갱신)
        except Exception as news_err:
            logger.warning(f"[Macro] News/LLM error (non-fatal): {news_err}")

        result["llm_analysis"] = llm_analysis or ""
        result["llm_analysis_pm"] = llm_analysis_pm or ""
        result["news_context"] = news_data.get("macro_news", "")

        # 5. DB upsert
        accuracy_data = None
        if adjusted_weights:
            accuracy_data = collector.calculate_indicator_accuracy([dict(r) for r in rows])

        # global_markets + risk_indicators 추출
        gm = result.get("global_markets", {})
        ri = result.get("risk_indicators", {})

        async with analysis_db.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO macro_daily
                (date, dxy_value, dxy_change_pct, dxy_score,
                 us10y_value, us10y_change_bps, us10y_score,
                 vix_value, vix_change_pct, vix_score,
                 foreign_net_amount, foreign_score,
                 futures_net, futures_score,
                 short_volume, short_change_pct, short_score,
                 overall_score, safety_level, interpretation, prediction_direction,
                 indicator_accuracy, adjusted_weights, raw_data,
                 us_market_date, us_market_day, kr_market_day,
                 nasdaq_value, nasdaq_change_pct,
                 sp500_value, sp500_change_pct,
                 oil_value, oil_change_pct,
                 gold_value, gold_change_pct,
                 bitcoin_value, bitcoin_change_pct,
                 krw_usd_value, krw_usd_change, krw_usd_change_pct, chain_analysis,
                 llm_analysis, news_context, economic_calendar,
                 llm_analysis_pm, collected_at_pm,
                 us2y_value, us2y_change_bps, spread_2s10s,
                 us30y_value, us30y_change_bps,
                 hy_spread_value, hy_spread_change_bps,
                 move_value, move_change_pct,
                 ewy_value, ewy_change_pct)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17,
                        $18, $19, $20, $21, $22::jsonb, $23::jsonb, $24::jsonb,
                        $25, $26, $27,
                        $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
                        $38, $39, $40, $41, $42, $43, $44::jsonb,
                        $45, $46,
                        $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57)
                ON CONFLICT (date) DO UPDATE SET
                    dxy_value = EXCLUDED.dxy_value, dxy_change_pct = EXCLUDED.dxy_change_pct, dxy_score = EXCLUDED.dxy_score,
                    us10y_value = EXCLUDED.us10y_value, us10y_change_bps = EXCLUDED.us10y_change_bps, us10y_score = EXCLUDED.us10y_score,
                    vix_value = EXCLUDED.vix_value, vix_change_pct = EXCLUDED.vix_change_pct, vix_score = EXCLUDED.vix_score,
                    foreign_net_amount = EXCLUDED.foreign_net_amount, foreign_score = EXCLUDED.foreign_score,
                    futures_net = EXCLUDED.futures_net, futures_score = EXCLUDED.futures_score,
                    short_volume = EXCLUDED.short_volume, short_change_pct = EXCLUDED.short_change_pct, short_score = EXCLUDED.short_score,
                    overall_score = EXCLUDED.overall_score, safety_level = EXCLUDED.safety_level,
                    interpretation = EXCLUDED.interpretation, prediction_direction = EXCLUDED.prediction_direction,
                    indicator_accuracy = EXCLUDED.indicator_accuracy, adjusted_weights = EXCLUDED.adjusted_weights,
                    raw_data = EXCLUDED.raw_data,
                    us_market_date = EXCLUDED.us_market_date, us_market_day = EXCLUDED.us_market_day, kr_market_day = EXCLUDED.kr_market_day,
                    nasdaq_value = EXCLUDED.nasdaq_value, nasdaq_change_pct = EXCLUDED.nasdaq_change_pct,
                    sp500_value = EXCLUDED.sp500_value, sp500_change_pct = EXCLUDED.sp500_change_pct,
                    oil_value = EXCLUDED.oil_value, oil_change_pct = EXCLUDED.oil_change_pct,
                    gold_value = EXCLUDED.gold_value, gold_change_pct = EXCLUDED.gold_change_pct,
                    bitcoin_value = EXCLUDED.bitcoin_value, bitcoin_change_pct = EXCLUDED.bitcoin_change_pct,
                    krw_usd_value = EXCLUDED.krw_usd_value, krw_usd_change = EXCLUDED.krw_usd_change, krw_usd_change_pct = EXCLUDED.krw_usd_change_pct,
                    chain_analysis = EXCLUDED.chain_analysis,
                    llm_analysis = COALESCE(EXCLUDED.llm_analysis, macro_daily.llm_analysis),
                    llm_analysis_pm = COALESCE(EXCLUDED.llm_analysis_pm, macro_daily.llm_analysis_pm),
                    collected_at_pm = COALESCE(EXCLUDED.collected_at_pm, macro_daily.collected_at_pm),
                    news_context = EXCLUDED.news_context,
                    economic_calendar = EXCLUDED.economic_calendar,
                    us2y_value = EXCLUDED.us2y_value, us2y_change_bps = EXCLUDED.us2y_change_bps,
                    spread_2s10s = EXCLUDED.spread_2s10s,
                    us30y_value = EXCLUDED.us30y_value, us30y_change_bps = EXCLUDED.us30y_change_bps,
                    hy_spread_value = EXCLUDED.hy_spread_value, hy_spread_change_bps = EXCLUDED.hy_spread_change_bps,
                    move_value = EXCLUDED.move_value, move_change_pct = EXCLUDED.move_change_pct,
                    ewy_value = EXCLUDED.ewy_value, ewy_change_pct = EXCLUDED.ewy_change_pct,
                    updated_at = NOW()
            """,
            date.fromisoformat(result["date"]),
            result["tier_a"]["dxy"]["value"], result["tier_a"]["dxy"]["change_pct"], result["tier_a"]["dxy"]["score"],
            result["tier_a"]["us10y"]["value"], result["tier_a"]["us10y"]["change_bps"], result["tier_a"]["us10y"]["score"],
            result["tier_a"]["vix"]["value"], result["tier_a"]["vix"]["change_pct"], result["tier_a"]["vix"]["score"],
            result["tier_b"]["foreign_cash"]["net_amount"], result["tier_b"]["foreign_cash"]["score"],
            result["tier_b"]["futures"]["net"], result["tier_b"]["futures"]["score"],
            result["tier_b"]["short_selling"]["volume"], result["tier_b"]["short_selling"]["change_pct"], result["tier_b"]["short_selling"]["score"],
            result["overall_score"], result["safety_level"], result["interpretation"], result["prediction_direction"],
            json.dumps(accuracy_data) if accuracy_data else None,
            json.dumps(adjusted_weights) if adjusted_weights else None,
            json.dumps(result["raw_data"]),
            date.fromisoformat(result["us_market_date"]) if result.get("us_market_date") else None,
            result.get("us_market_day"),
            result.get("kr_market_day"),
            gm.get("nasdaq", {}).get("value"), gm.get("nasdaq", {}).get("change_pct"),
            gm.get("sp500", {}).get("value"), gm.get("sp500", {}).get("change_pct"),
            gm.get("oil", {}).get("value"), gm.get("oil", {}).get("change_pct"),
            gm.get("gold", {}).get("value"), gm.get("gold", {}).get("change_pct"),
            gm.get("bitcoin", {}).get("value"), gm.get("bitcoin", {}).get("change_pct"),
            gm.get("krw_usd", {}).get("value"), gm.get("krw_usd", {}).get("change"), gm.get("krw_usd", {}).get("change_pct"),
            result.get("chain_analysis"),
            llm_analysis if llm_analysis else None,
            result.get("news_context"),
            json.dumps(result.get("economic_calendar")) if result.get("economic_calendar") else None,
            llm_analysis_pm if llm_analysis_pm else None,
            collected_at_pm,
            ri.get("us2y", {}).get("value"), ri.get("us2y", {}).get("change_bps"),
            ri.get("spread_2s10s"),
            ri.get("us30y", {}).get("value"), ri.get("us30y", {}).get("change_bps"),
            ri.get("hy_spread", {}).get("value"), ri.get("hy_spread", {}).get("change_bps"),
            ri.get("move", {}).get("value"), ri.get("move", {}).get("change_pct"),
            gm.get("ewy", {}).get("value"), gm.get("ewy", {}).get("change_pct"),
            )

        return {"status": "success", "data": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/macro/today")
async def get_macro_today():
    """오늘 매크로 데이터 + 전일 리뷰 반환"""
    try:
        await analysis_db.connect()

        today_data = None
        yesterday_data = None
        daily_review = None

        async with analysis_db.pool.acquire() as conn:
            today_row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date = CURRENT_DATE"
            )
            yesterday_row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date < CURRENT_DATE ORDER BY date DESC LIMIT 1"
            )

        if today_row:
            today_data = _macro_row_to_dict(today_row)
        else:
            # 데이터 없으면 라이브 수집
            collector = MacroDashboardCollector()
            today_data = collector.collect_all()

        if yesterday_row:
            collector = MacroDashboardCollector()
            daily_review = collector.generate_daily_review(dict(yesterday_row))

        # 전일 Tier B 확정 데이터 (전일 마감 잔고)
        yesterday_tier_b = None
        if yesterday_row:
            yd = dict(yesterday_row)
            yesterday_tier_b = {
                "date": yd["date"].isoformat() if hasattr(yd["date"], "isoformat") else str(yd["date"]),
                "foreign_cash": {"net_amount": yd.get("foreign_net_amount"), "score": yd.get("foreign_score")},
                "futures": {"net": yd.get("futures_net"), "score": yd.get("futures_score")},
                "short_selling": {
                    "volume": yd.get("short_volume"),
                    "change_pct": float(yd["short_change_pct"]) if yd.get("short_change_pct") is not None else 0,
                    "score": yd.get("short_score"),
                },
            }

        # 적중률 + 가중치
        accuracy = None
        weights = None
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM macro_daily WHERE actual_kospi_change IS NOT NULL ORDER BY date DESC LIMIT 20"
            )
            if rows:
                collector = MacroDashboardCollector()
                history = [dict(r) for r in rows]
                accuracy = collector.calculate_indicator_accuracy(history)
                if len(rows) >= 20:
                    weights = collector.get_adjusted_weights(accuracy)

        response = {
            "status": "success",
            "data": today_data,
            "daily_review": daily_review,
            "yesterday_tier_b": yesterday_tier_b,
            "accuracy": accuracy,
            "adjusted_weights": weights
        }
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/macro/history")
async def get_macro_history(period: str = "weekly"):
    """기간별 히스토리"""
    try:
        days_map = {"weekly": 7, "monthly": 30, "yearly": 365}
        days = days_map.get(period, 7)

        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM macro_daily
                   WHERE date >= CURRENT_DATE - $1::integer
                   ORDER BY date DESC""",
                days
            )

        return {
            "status": "success",
            "period": period,
            "count": len(rows),
            "data": [_macro_row_to_dict(r) for r in rows]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/macro/date/{target_date}")
async def get_macro_by_date(target_date: str):
    """특정 날짜의 매크로 데이터 조회"""
    try:
        from datetime import date as date_cls
        d = date_cls.fromisoformat(target_date)

        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date = $1", d
            )

        if not row:
            return {"status": "not_found", "date": target_date, "data": None}

        data = _macro_row_to_dict(row)

        # daily review (전날 데이터로)
        daily_review = None
        async with analysis_db.pool.acquire() as conn:
            prev_row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date < $1 ORDER BY date DESC LIMIT 1", d
            )
        if prev_row:
            collector = MacroDashboardCollector()
            daily_review = collector.generate_daily_review(dict(prev_row))

        return {
            "status": "success",
            "date": target_date,
            "data": data,
            "daily_review": daily_review,
        }
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {target_date}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio/holdings")
async def get_portfolio_holdings():
    """키움 API에서 실제 보유종목 조회"""
    account_no = os.getenv("KIWOOM_ACCOUNT")
    if not account_no:
        raise HTTPException(status_code=400, detail="KIWOOM_ACCOUNT not configured")
    try:
        kiwoom = KiwoomCollector()
        raw = kiwoom.get_holdings(account_no)
        holdings = []
        for h in raw:
            symbol = h.get("stk_cd", "").replace("A", "")
            if not symbol:
                continue
            avg_price = abs(float(h.get("avg_prc", 0)))
            quantity = abs(int(h.get("rmnd_qty", 0)))
            current_price = abs(float(h.get("cur_prc", 0)))

            # NEXT(시간외) 가격 반영
            try:
                nxt = kiwoom.get_next_market_price(symbol)
                if nxt and nxt.get("cur_price") and nxt["cur_price"] > 0:
                    current_price = float(nxt["cur_price"])
            except Exception:
                pass

            eval_amount = current_price * quantity
            profit_amount = (current_price - avg_price) * quantity
            profit_rate = ((current_price - avg_price) / avg_price * 100) if avg_price > 0 else 0.0
            holdings.append({
                "symbol": symbol,
                "symbolName": h.get("stk_nm", symbol).strip(),
                "avgPrice": avg_price,
                "quantity": quantity,
                "currentPrice": current_price,
                "totalValue": eval_amount,
                "profitAmount": profit_amount,
                "profitRate": round(profit_rate, 2),
            })
        logger.info(f"[Portfolio] 키움 보유종목 {len(holdings)}개: {[h['symbolName'] for h in holdings]}")
        return {"status": "success", "holdings": holdings}
    except Exception as e:
        logger.error(f"[Portfolio] 키움 보유종목 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/macro/dates")
async def get_macro_available_dates():
    """데이터가 있는 날짜 목록"""
    try:
        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT date, overall_score, safety_level,
                          CASE WHEN llm_analysis IS NOT NULL AND llm_analysis != '' THEN true ELSE false END as has_llm
                   FROM macro_daily ORDER BY date DESC LIMIT 90"""
            )
        return {
            "status": "success",
            "dates": [
                {
                    "date": r["date"].isoformat(),
                    "score": float(r["overall_score"]) if r["overall_score"] else 0,
                    "safety_level": r["safety_level"] or 2,
                    "has_llm": r["has_llm"],
                }
                for r in rows
            ]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/macro/accuracy")
async def get_macro_accuracy():
    """지표별 적중률 + 조정 가중치"""
    try:
        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM macro_daily WHERE actual_kospi_change IS NOT NULL ORDER BY date DESC LIMIT 20"
            )

        if not rows:
            return {"status": "success", "accuracy": {}, "adjusted_weights": None, "data_days": 0}

        collector = MacroDashboardCollector()
        history = [dict(r) for r in rows]
        accuracy = collector.calculate_indicator_accuracy(history)
        weights = collector.get_adjusted_weights(accuracy) if len(rows) >= 20 else None

        return {
            "status": "success",
            "data_days": len(rows),
            "accuracy": accuracy,
            "adjusted_weights": weights
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
        "collected_at_pm": d["collected_at_pm"].isoformat() if d.get("collected_at_pm") else None,
        "news_context": d.get("news_context", ""),
        "economic_calendar": d.get("economic_calendar"),
    }


# ============ Macro Background Scheduler ============
from datetime import datetime as dt_datetime
import pytz

_macro_scheduler_running = False

async def _run_macro_collection(mode: str = "am"):
    """매크로 데이터 수집 (collect_macro_data 로직 재사용)"""
    try:
        print(f"[Macro Scheduler] {mode.upper()} 수집 시작: {dt_datetime.now(pytz.timezone('Asia/Seoul')).strftime('%H:%M:%S')}")
        await collect_macro_data(MacroCollectRequest(mode=mode))
        print(f"[Macro Scheduler] {mode.upper()} 수집 완료")
    except Exception as e:
        print(f"[Macro Scheduler] {mode.upper()} 수집 실패: {e}")

SCHEDULE = [
    {"hour": 7, "minute": 0, "mode": "am"},
    {"hour": 18, "minute": 0, "mode": "pm"},
]

async def _macro_scheduler():
    """
    매크로 자동 스케줄러: 평일(월~금) 07:00 AM + 18:00 PM KST 수집
    AM: 글로벌 지표 + 뉴스 + 예측 브리핑
    PM: 확정 수급 + 뉴스 + 결산 브리핑
    주말 건너뜀
    """
    global _macro_scheduler_running
    _macro_scheduler_running = True
    kst = pytz.timezone('Asia/Seoul')
    from datetime import timedelta
    print(f"[Macro Scheduler] 시작 — 평일 07:00(AM) + 18:00(PM) KST 자동 수집 (주말 제외)")

    while _macro_scheduler_running:
        try:
            now = dt_datetime.now(kst)

            # 다음 스케줄 슬롯 계산
            next_run = None
            next_mode = "am"
            for slot in SCHEDULE:
                target = now.replace(hour=slot["hour"], minute=slot["minute"], second=0, microsecond=0)
                if now < target:
                    # 아직 안 지남 → 오늘 이 슬롯
                    candidate = target
                else:
                    continue
                if next_run is None or candidate < next_run:
                    next_run = candidate
                    next_mode = slot["mode"]

            # 오늘 남은 슬롯이 없으면 내일 첫 슬롯
            if next_run is None:
                tomorrow = (now + timedelta(days=1)).replace(
                    hour=SCHEDULE[0]["hour"], minute=SCHEDULE[0]["minute"], second=0, microsecond=0
                )
                next_run = tomorrow
                next_mode = SCHEDULE[0]["mode"]

            # 주말이면 월요일로 이동 (토=5, 일=6)
            while next_run.weekday() >= 5:
                next_run += timedelta(days=1)

            wait_seconds = (next_run - now).total_seconds()
            next_day_name = ['월','화','수','목','금','토','일'][next_run.weekday()]
            print(f"[Macro Scheduler] 다음 수집: {next_run.strftime('%Y-%m-%d')}({next_day_name}) {next_run.strftime('%H:%M')} KST [{next_mode.upper()}] ({wait_seconds/3600:.1f}시간 후)")

            # 대기 (30초 간격으로 체크하며 대기 — 종료 신호 감지용)
            while wait_seconds > 0 and _macro_scheduler_running:
                sleep_chunk = min(wait_seconds, 30)
                await asyncio.sleep(sleep_chunk)
                wait_seconds -= sleep_chunk

            if not _macro_scheduler_running:
                break

            # 수집 실행
            print(f"[Macro Scheduler] === {dt_datetime.now(kst).strftime('%Y-%m-%d %H:%M')} {next_mode.upper()} 수집 시작 ===")
            await _run_macro_collection(next_mode)
            print(f"[Macro Scheduler] === {next_mode.upper()} 수집 완료 ===")

            # 수집 후 1분 대기 (중복 실행 방지)
            await asyncio.sleep(60)

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Macro Scheduler] 에러: {e}")
            await asyncio.sleep(60)

    print("[Macro Scheduler] 스케줄러 종료")

@app.on_event("startup")
async def start_macro_scheduler():
    asyncio.create_task(_macro_scheduler())

@app.on_event("shutdown")
async def stop_macro_scheduler():
    global _macro_scheduler_running
    _macro_scheduler_running = False


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
