from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import FinanceDataReader as fdr
import pandas as pd

from models.requests import ScreenerRequest
from strategies.screener import run_custom_screen, get_screener, get_screener_profiles
from collectors.kiwoom import KiwoomCollector

router = APIRouter()


# 새로운 스크리너 요청 모델
class NewScreenerRequest(BaseModel):
    profile: str = 'semiconductor_equipment'
    filters: Optional[Dict[str, Any]] = None


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


@router.post("/api/screener/v2/run")
async def run_screener_v2(request: NewScreenerRequest):
    """
    새로운 스크리너 V2 - FinanceDataReader 기반
    프로토타입: 반도체 장비 분야만 지원
    """
    try:
        if request.profile == 'semiconductor_equipment':
            # 반도체 장비 종목 리스트 (수동 지정)
            SEMICONDUCTOR_EQUIPMENT_SYMBOLS = [
                '240810',  # 원익IPS
                '036930',  # 주성엔지니어링
                '084370',  # 유진테크
                '095610',  # 테스
                '265520',  # AP시스템
                '074600',  # 원익QnC
                '319660',  # PSK
                '171090',  # 선익시스템
                '039030',  # 이오테크닉스
                '131970',  # 티에스이
                '101490',  # 에스에프에이
                '089970',  # 에이피티씨
                '213420',  # 덕산네오룩스
                '195870',  # 해성디에스
                '067310',  # 하나마이크론
                '036540',  # SFA반도체
                '101160',  # 월덱스
                '222810',  # 일진파워
                '218410',  # RFHIC
                '950140',  # 잉글우드랩
            ]

            print(f"[Screener] Fetching {len(SEMICONDUCTOR_EQUIPMENT_SYMBOLS)} semiconductor equipment stocks...")

            # FDR로 전체 종목 가져오기
            kospi = fdr.StockListing('KOSPI')
            kosdaq = fdr.StockListing('KOSDAQ')
            all_stocks = pd.concat([kospi, kosdaq])

            # 반도체 장비 종목만 필터링
            semiconductor = all_stocks[all_stocks['Code'].isin(SEMICONDUCTOR_EQUIPMENT_SYMBOLS)]

            print(f"[Screener] Found {len(semiconductor)} stocks")

            # Kiwoom API로 재무 데이터 조회
            kiwoom = KiwoomCollector()
            results = []

            for _, row in semiconductor.iterrows():
                symbol = row['Code']

                # Kiwoom API로 재무 데이터 가져오기
                try:
                    financials = kiwoom.get_fundamental_info(symbol)
                except Exception as e:
                    print(f"[Screener] Failed to fetch {symbol}: {e}")
                    financials = {}

                result = {
                    'symbol': symbol,
                    'name': row['Name'],
                    'sector': 'Semiconductor Equipment',
                    'industry': 'Semiconductor Equipment',
                    'market_cap': int(row.get('Marcap', 0)) if pd.notna(row.get('Marcap')) else 0,
                    'per': float(financials.get('per', 0)) if financials.get('per') else None,
                    'pbr': float(financials.get('pbr', 0)) if financials.get('pbr') else None,
                    'roe': float(financials.get('roe', 0)) if financials.get('roe') else None,
                    'eps': float(financials.get('eps', 0)) if financials.get('eps') else None,
                    'bps': float(financials.get('bps', 0)) if financials.get('bps') else None,
                }

                results.append(result)

            print(f"[Screener] Returning {len(results)} results")

            return {
                'total': len(results),
                'results': results,
                'profile': request.profile
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported profile: {request.profile}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
