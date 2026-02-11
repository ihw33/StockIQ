from fastapi import APIRouter, HTTPException
from models.requests import AlphaHRRequest
from alpha_hr.collector import AlphaHRCollector
from alpha_hr.etl import AlphaHRETL
from alpha_hr.diff_engine import AlphaHRDiffEngine
from alpha_hr.analyzer import AlphaHRAnalyzer

router = APIRouter()

@router.post("/api/alpha-hr/analyze")
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
