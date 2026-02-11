from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional

from models.requests import ScreenerRequest
from strategies.screener import run_custom_screen, get_screener, get_screener_profiles

router = APIRouter()


@router.post("/api/screener/run")
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


@router.get("/api/screener/profiles")
async def get_profiles():
    """
    Returns the list of available screener profiles.
    """
    profiles = await get_screener_profiles()
    return {"profiles": profiles}


@router.get("/api/screener/conditions")
def get_screener_conditions(profile_id: str = "momentum_surge"):
    """
    Returns the list of screener conditions for a specific profile.
    """
    screener = get_screener()
    return {"conditions": screener.get_conditions_info(profile_id)}
