from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
import json

from models.requests import SaveAnalysisRequest
from database import analysis_db

router = APIRouter()


@router.post("/api/analysis/save")
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


@router.get("/api/reports/pending")
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


@router.get("/api/analysis/history")
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
