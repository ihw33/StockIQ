"""
종목 동향 추적 API
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
from collectors.naver_stocks_scraper import get_stocks_extremes

router = APIRouter(prefix="/api/stocks/movers", tags=["stocks-movers"])


async def get_db_connection():
    """DB 연결"""
    return await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER', 'm4_macbook'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'stockiq')
    )


async def save_extremes_to_db(data: Dict[str, Any]):
    """종목 극값 데이터 DB 저장"""
    conn = await get_db_connection()

    try:
        # 문자열 날짜를 date 객체로 변환
        market_date_str = data['market_date']
        market_date = datetime.strptime(market_date_str, '%Y-%m-%d').date()
        fetched_at = datetime.now()

        # 상승 종목 저장
        for stock in data['rising']['stocks']:
            await conn.execute('''
                INSERT INTO stocks_daily_extremes
                (market_date, fetched_at, stock_code, stock_name, rank, direction,
                 current_price, change_amount, change_pct, volume)
                VALUES ($1, $2, $3, $4, $5, 'up', $6, $7, $8, $9)
                ON CONFLICT (market_date, stock_code, direction)
                DO UPDATE SET rank = $5, current_price = $6, change_amount = $7,
                             change_pct = $8, volume = $9, fetched_at = $2
            ''', market_date, fetched_at, stock['stock_code'], stock['stock_name'],
                stock['rank'], stock['current_price'], stock['change_amount'],
                stock['change_pct'], stock['volume'])

        # 하락 종목 저장
        for stock in data['falling']['stocks']:
            await conn.execute('''
                INSERT INTO stocks_daily_extremes
                (market_date, fetched_at, stock_code, stock_name, rank, direction,
                 current_price, change_amount, change_pct, volume)
                VALUES ($1, $2, $3, $4, $5, 'down', $6, $7, $8, $9)
                ON CONFLICT (market_date, stock_code, direction)
                DO UPDATE SET rank = $5, current_price = $6, change_amount = $7,
                             change_pct = $8, volume = $9, fetched_at = $2
            ''', market_date, fetched_at, stock['stock_code'], stock['stock_name'],
                stock['rank'], stock['current_price'], stock['change_amount'],
                stock['change_pct'], stock['volume'])

        print(f"✅ DB 저장 완료: {market_date}")

    finally:
        await conn.close()


@router.post("/fetch")
async def fetch_stocks_data(limit: int = 50) -> Dict[str, Any]:
    """
    네이버 증권에서 상승/하락 종목 크롤링 + DB 저장
    - 상승 Top N
    - 하락 Top N
    """
    try:
        result = get_stocks_extremes(limit=limit)

        # DB 저장
        await save_extremes_to_db(result)

        return {
            'success': True,
            'message': f"크롤링 완료: {result['total_stocks']}개 종목",
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"크롤링 실패: {str(e)}")


@router.get("/history")
async def get_stocks_history(
    days: int = 30,
    direction: str = None  # 'up' | 'down' | None (all)
) -> Dict[str, Any]:
    """
    종목 동향 히스토리 조회
    - days: 조회 기간 (기본 30일)
    - direction: 필터 (up/down/null)
    """
    conn = await get_db_connection()

    try:
        query = '''
            SELECT
                market_date,
                stock_code,
                stock_name,
                direction,
                current_price,
                change_amount,
                change_pct,
                volume,
                rank
            FROM stocks_daily_extremes
            WHERE market_date >= CURRENT_DATE - $1::integer
        '''

        params = [days]

        if direction:
            query += ' AND direction = $2'
            params.append(direction)

        query += ' ORDER BY market_date DESC, direction, rank'

        rows = await conn.fetch(query, *params)

        # 날짜별로 그룹화
        history_by_date = {}
        for row in rows:
            date_str = row['market_date'].strftime('%Y-%m-%d')
            if date_str not in history_by_date:
                history_by_date[date_str] = {
                    'rising': [],
                    'falling': []
                }

            stock_data = {
                'code': row['stock_code'],
                'name': row['stock_name'],
                'current_price': row['current_price'],
                'change_amount': row['change_amount'],
                'change_pct': float(row['change_pct']),
                'volume': row['volume'],
                'rank': row['rank']
            }

            if row['direction'] == 'up':
                history_by_date[date_str]['rising'].append(stock_data)
            else:
                history_by_date[date_str]['falling'].append(stock_data)

        return {
            'success': True,
            'days': days,
            'direction': direction,
            'data': history_by_date
        }

    finally:
        await conn.close()
