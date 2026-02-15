"""
섹터 로테이션 추적 API
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import sys
from pathlib import Path

# collectors 경로 추가
sys.path.append(str(Path(__file__).parent.parent))
from collectors.naver_sector_scraper import get_sector_extremes

router = APIRouter(prefix="/api/sectors", tags=["sectors"])


@router.post("/fetch")
async def fetch_sector_data() -> Dict[str, Any]:
    """
    네이버 증권에서 업종/테마 데이터 크롤링
    - 상승 Top 10
    - 하락 Top 10
    """
    try:
        result = get_sector_extremes()
        return {
            'success': True,
            'message': f"크롤링 완료: {result['total_sectors']}개 섹터",
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"크롤링 실패: {str(e)}")


@router.get("/latest")
async def get_latest_extremes() -> Dict[str, Any]:
    """
    최신 상승/하락 Top 10 조회
    (DB에서 가져오기 - 추후 구현)
    """
    # TODO: DB에서 최신 데이터 조회
    return {
        'message': 'DB 구현 예정',
        'data': None
    }
