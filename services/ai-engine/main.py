from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

@app.post("/api/strategy/chart-analysis")
async def run_chart_analysis(request: ChartAnalysisRequest):
    """
    Analyzes chart data for the given symbol using ChartAnalyst strategy.
    """
    try:
        # Check if symbol is valid (simple check)
        if not request.symbol:
            raise HTTPException(status_code=400, detail="Symbol is required")

        strategy = ChartAnalyst()
        result = await strategy.analyze_strategy(request.symbol, request.mode or "llm", request.query)
        return result
    except Exception as e:
        print(f"Analysis Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
