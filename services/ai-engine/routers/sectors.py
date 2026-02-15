"""
섹터 로테이션 추적 API
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import sys
from pathlib import Path
import asyncpg
import os
from datetime import datetime

# collectors 경로 추가
sys.path.append(str(Path(__file__).parent.parent))
from collectors.naver_sector_scraper import get_sector_extremes

router = APIRouter(prefix="/api/sectors", tags=["sectors"])


async def get_db_connection():
    """DB 연결"""
    return await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'stockiq')
    )


async def save_extremes_to_db(data: Dict[str, Any]):
    """섹터 극값 데이터 DB 저장"""
    conn = await get_db_connection()

    try:
        market_date = data['market_date']
        fetched_at = datetime.now()

        # 업종 저장
        for idx, sector in enumerate(data['industries']['top_up'], 1):
            await conn.execute('''
                INSERT INTO sector_daily_extremes
                (market_date, fetched_at, sector_type, sector_name, rank, direction, change_pct, volume)
                VALUES ($1, $2, 'industry', $3, $4, 'up', $5, $6)
                ON CONFLICT (market_date, sector_type, sector_name, direction)
                DO UPDATE SET rank = $4, change_pct = $5, volume = $6, fetched_at = $2
            ''', market_date, fetched_at, sector['name'], idx, sector['change_pct'], sector.get('volume', ''))

        for idx, sector in enumerate(data['industries']['top_down'], 1):
            await conn.execute('''
                INSERT INTO sector_daily_extremes
                (market_date, fetched_at, sector_type, sector_name, rank, direction, change_pct, volume)
                VALUES ($1, $2, 'industry', $3, $4, 'down', $5, $6)
                ON CONFLICT (market_date, sector_type, sector_name, direction)
                DO UPDATE SET rank = $4, change_pct = $5, volume = $6, fetched_at = $2
            ''', market_date, fetched_at, sector['name'], idx, sector['change_pct'], sector.get('volume', ''))

        # 테마 저장
        for idx, sector in enumerate(data['themes']['top_up'], 1):
            await conn.execute('''
                INSERT INTO sector_daily_extremes
                (market_date, fetched_at, sector_type, sector_name, rank, direction, change_pct, volume)
                VALUES ($1, $2, 'theme', $3, $4, 'up', $5, $6)
                ON CONFLICT (market_date, sector_type, sector_name, direction)
                DO UPDATE SET rank = $4, change_pct = $5, volume = $6, fetched_at = $2
            ''', market_date, fetched_at, sector['name'], idx, sector['change_pct'], sector.get('volume', ''))

        for idx, sector in enumerate(data['themes']['top_down'], 1):
            await conn.execute('''
                INSERT INTO sector_daily_extremes
                (market_date, fetched_at, sector_type, sector_name, rank, direction, change_pct, volume)
                VALUES ($1, $2, 'theme', $3, $4, 'down', $5, $6)
                ON CONFLICT (market_date, sector_type, sector_name, direction)
                DO UPDATE SET rank = $4, change_pct = $5, volume = $6, fetched_at = $2
            ''', market_date, fetched_at, sector['name'], idx, sector['change_pct'], sector.get('volume', ''))

        print(f"✅ DB 저장 완료: {market_date}")

    finally:
        await conn.close()


@router.post("/fetch")
async def fetch_sector_data() -> Dict[str, Any]:
    """
    네이버 증권에서 업종/테마 데이터 크롤링 + DB 저장
    - 상승 Top 10
    - 하락 Top 10
    """
    try:
        result = get_sector_extremes()

        # DB 저장
        await save_extremes_to_db(result)

        return {
            'success': True,
            'message': f"크롤링 완료: {result['total_sectors']}개 섹터",
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"크롤링 실패: {str(e)}")


@router.get("/history")
async def get_sector_history(
    days: int = 30,
    sector_type: str = None  # 'industry' | 'theme' | None (all)
) -> Dict[str, Any]:
    """
    섹터 동향 히스토리 조회
    - days: 조회 기간 (기본 30일)
    - sector_type: 필터 (industry/theme/null)
    """
    conn = await get_db_connection()

    try:
        query = '''
            SELECT
                market_date,
                sector_type,
                sector_name,
                direction,
                change_pct,
                rank
            FROM sector_daily_extremes
            WHERE market_date >= CURRENT_DATE - $1::integer
        '''

        params = [days]

        if sector_type:
            query += ' AND sector_type = $2'
            params.append(sector_type)

        query += ' ORDER BY market_date DESC, sector_type, direction, rank'

        rows = await conn.fetch(query, *params)

        # 날짜별로 그룹화
        history_by_date = {}
        for row in rows:
            date_str = row['market_date'].strftime('%Y-%m-%d')
            if date_str not in history_by_date:
                history_by_date[date_str] = {
                    'industries': {'up': [], 'down': []},
                    'themes': {'up': [], 'down': []}
                }

            sector_data = {
                'name': row['sector_name'],
                'change_pct': float(row['change_pct']),
                'rank': row['rank']
            }

            if row['sector_type'] == 'industry':
                history_by_date[date_str]['industries'][row['direction']].append(sector_data)
            else:
                history_by_date[date_str]['themes'][row['direction']].append(sector_data)

        return {
            'success': True,
            'days': days,
            'sector_type': sector_type,
            'data': history_by_date
        }

    finally:
        await conn.close()
