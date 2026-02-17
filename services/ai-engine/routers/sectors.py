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
from utils.market_calendar import is_market_open, get_market_status

router = APIRouter(prefix="/api/sectors", tags=["sectors"])


async def get_db_connection():
    """DB 연결"""
    return await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER', 'm4_macbook'),  # 현재 시스템 유저
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'stockiq')
    )



async def save_extremes_to_db(data: Dict[str, Any]):
    """섹터 극값 데이터 DB 저장"""
    conn = await get_db_connection()

    try:
        # 문자열 날짜를 date 객체로 변환
        market_date_str = data['market_date']
        market_date = datetime.strptime(market_date_str, '%Y-%m-%d').date()
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
    # 장 개장 여부 체크
    if not is_market_open():
        from datetime import datetime
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo('Asia/Seoul'))
        return {
            'success': False,
            'message': f"장이 열리지 않는 시간입니다 (현재: {now.strftime('%Y-%m-%d %H:%M KST')})",
            'data': None
        }

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


@router.get("/weekly-summary")
async def get_weekly_summary(sector_type: str = None) -> Dict[str, Any]:
    """
    주간 요약 (최근 5거래일)
    - 5일 누적 수익률 Top 10
    - 강세/약세 지속 섹터
    - 추세 반전 섹터
    """
    conn = await get_db_connection()

    try:
        # 최근 5거래일 데이터 조회
        query = '''
            SELECT DISTINCT market_date
            FROM sector_daily_extremes
            ORDER BY market_date DESC
            LIMIT 5
        '''
        date_rows = await conn.fetch(query)

        if not date_rows:
            return {'success': False, 'message': '데이터 없음', 'data': None}

        recent_dates = [row['market_date'] for row in date_rows]
        oldest_date = recent_dates[-1]
        newest_date = recent_dates[0]

        # 전체 데이터 조회
        query = '''
            SELECT
                market_date,
                sector_type,
                sector_name,
                direction,
                change_pct,
                rank
            FROM sector_daily_extremes
            WHERE market_date >= $1
        '''
        params = [oldest_date]

        if sector_type:
            query += ' AND sector_type = $2'
            params.append(sector_type)

        query += ' ORDER BY market_date, sector_type, sector_name, direction'

        rows = await conn.fetch(query, *params)

        # 섹터별 일별 데이터 정리
        sector_daily_data = {}  # {sector_name: {date: change_pct}}
        sector_types = {}  # {sector_name: sector_type}

        for row in rows:
            name = row['sector_name']
            date = row['market_date']
            pct = float(row['change_pct']) if row['change_pct'] is not None else 0  # Decimal → float

            if name not in sector_daily_data:
                sector_daily_data[name] = {}
                sector_types[name] = row['sector_type']

            # 상승/하락 모두 저장 (나중에 평균 계산)
            if date not in sector_daily_data[name]:
                sector_daily_data[name][date] = []
            sector_daily_data[name][date].append(pct)

        # 1. 5일 누적 수익률 계산
        cumulative = []
        for sector_name, daily_data in sector_daily_data.items():
            total = 0
            daily_changes = []

            for date in recent_dates:
                if date in daily_data:
                    avg_pct = sum(daily_data[date]) / len(daily_data[date])
                    total += avg_pct
                    daily_changes.append(avg_pct)
                else:
                    daily_changes.append(0)

            cumulative.append({
                'name': sector_name,
                'type': sector_types[sector_name],
                'cumulative': round(total, 2),
                'daily': [round(d, 2) for d in daily_changes]
            })

        # 상승/하락 Top 10
        top_up = sorted(cumulative, key=lambda x: x['cumulative'], reverse=True)[:10]
        top_down = sorted(cumulative, key=lambda x: x['cumulative'])[:10]

        # 2. 강세/약세 지속 섹터 (3일 이상 같은 방향)
        sustained_up = []
        sustained_down = []

        for sector in cumulative:
            daily = sector['daily'][-3:]  # 최근 3일
            if len(daily) >= 3:
                if all(d > 0 for d in daily):
                    sustained_up.append({
                        'name': sector['name'],
                        'type': sector['type'],
                        'daily': sector['daily'],
                        'cumulative': sector['cumulative']
                    })
                elif all(d < 0 for d in daily):
                    sustained_down.append({
                        'name': sector['name'],
                        'type': sector['type'],
                        'daily': sector['daily'],
                        'cumulative': sector['cumulative']
                    })

        # 3. 추세 반전 섹터
        trend_reversal = []

        for sector in cumulative:
            daily = sector['daily']
            if len(daily) >= 3:
                prev_avg = sum(daily[:2]) / 2  # 이전 2일 평균
                recent = daily[-1]  # 최근 1일

                # 하락 → 상승 전환
                if prev_avg < 0 and recent > 1.0:
                    trend_reversal.append({
                        'name': sector['name'],
                        'type': sector['type'],
                        'direction': 'up',
                        'prev': round(prev_avg, 2),
                        'recent': round(recent, 2),
                        'cumulative': sector['cumulative']
                    })
                # 상승 → 하락 전환
                elif prev_avg > 0 and recent < -1.0:
                    trend_reversal.append({
                        'name': sector['name'],
                        'type': sector['type'],
                        'direction': 'down',
                        'prev': round(prev_avg, 2),
                        'recent': round(recent, 2),
                        'cumulative': sector['cumulative']
                    })

        return {
            'success': True,
            'period': f'{oldest_date} ~ {newest_date}',
            'data': {
                'cumulative': {
                    'top_up': top_up,
                    'top_down': top_down
                },
                'sustained': {
                    'up': sorted(sustained_up, key=lambda x: x['cumulative'], reverse=True)[:10],
                    'down': sorted(sustained_down, key=lambda x: x['cumulative'])[:10]
                },
                'reversal': sorted(trend_reversal, key=lambda x: abs(x['cumulative']), reverse=True)[:10]
            }
        }

    finally:
        await conn.close()


@router.get("/monthly-analysis")
async def get_monthly_analysis(sector_type: str = None) -> Dict[str, Any]:
    """
    월간 섹터 패턴 분석 (30일)
    - 실제 DB 데이터 사용
    - 최소 10거래일 이상 필요
    """
    conn = await get_db_connection()
    try:
        query = '''
            SELECT market_date, sector_type, sector_name, direction, change_pct
            FROM sector_daily_extremes
            WHERE market_date >= CURRENT_DATE - 30
            ORDER BY market_date, sector_type, sector_name
        '''
        params = []
        if sector_type:
            query = '''
                SELECT market_date, sector_type, sector_name, direction, change_pct
                FROM sector_daily_extremes
                WHERE market_date >= CURRENT_DATE - 30
                  AND sector_type = $1
                ORDER BY market_date, sector_type, sector_name
            '''
            params = [sector_type]

        rows = await conn.fetch(query, *params)

        # 거래일 수 확인
        trading_dates = sorted(set(row['market_date'] for row in rows))
        if len(trading_dates) < 10:
            return {
                'success': False,
                'message': f'데이터가 부족합니다. 현재 {len(trading_dates)}거래일 데이터가 있습니다. 최소 10거래일이 필요합니다.',
                'data': None,
                'trading_days': len(trading_dates)
            }

        # 섹터별 일별 수익률 수집
        sector_daily: dict = {}  # {sector_name: {date: avg_pct}}
        sector_types: dict = {}

        for row in rows:
            name = row['sector_name']
            date = row['market_date']
            pct = float(row['change_pct']) if row['change_pct'] is not None else 0.0

            if name not in sector_daily:
                sector_daily[name] = {}
                sector_types[name] = row['sector_type']

            if date not in sector_daily[name]:
                sector_daily[name][date] = []
            sector_daily[name][date].append(pct)

        # 평균 (상승/하락이 중복 저장된 경우 평균)
        sectors = sorted(sector_daily.keys())
        daily_returns: dict = {}
        for s in sectors:
            daily_returns[s] = []
            for d in trading_dates:
                vals = sector_daily[s].get(d, [0.0])
                daily_returns[s].append(sum(vals) / len(vals))

        # 상관계수 계산
        import numpy as np
        data_matrix = np.array([daily_returns[s] for s in sectors])
        corr_matrix = np.corrcoef(data_matrix)

        correlation_dict = {}
        for i, s1 in enumerate(sectors):
            correlation_dict[s1] = {}
            for j, s2 in enumerate(sectors):
                correlation_dict[s1][s2] = round(float(corr_matrix[i][j]), 2)

        # 패턴 추출
        patterns = []
        for i, s1 in enumerate(sectors):
            for j, s2 in enumerate(sectors):
                if i < j and corr_matrix[i][j] > 0.7:
                    patterns.append({'type': 'positive', 'sector1': s1, 'sector2': s2,
                                      'correlation': round(float(corr_matrix[i][j]), 2),
                                      'description': f'{s1} ↔ {s2} 강한 동조화'})
                elif i < j and corr_matrix[i][j] < -0.4:
                    patterns.append({'type': 'negative', 'sector1': s1, 'sector2': s2,
                                      'correlation': round(float(corr_matrix[i][j]), 2),
                                      'description': f'{s1} ↔ {s2} 뚜렷한 역상관'})
        patterns.sort(key=lambda x: abs(x['correlation']), reverse=True)

        # 누적 수익률
        cumulative_returns = {s: round(sum(daily_returns[s]), 2) for s in sectors}
        sorted_sectors = sorted(cumulative_returns.items(), key=lambda x: x[1], reverse=True)

        n = len(sectors)
        top_n = max(1, n * 3 // 10)
        bottom_n = max(1, n * 3 // 10)
        clusters = {
            'aggressive': {'label': '상승 강세', 'sectors': [{'name': s[0], 'return': s[1]} for s in sorted_sectors[:top_n]]},
            'neutral':    {'label': '중립 섹터', 'sectors': [{'name': s[0], 'return': s[1]} for s in sorted_sectors[top_n:-bottom_n or None]]},
            'defensive':  {'label': '상대적 약세', 'sectors': [{'name': s[0], 'return': s[1]} for s in sorted_sectors[-bottom_n:]]}
        }

        oldest = str(trading_dates[0])
        newest = str(trading_dates[-1])

        return {
            'success': True,
            'period': f'{oldest} ~ {newest} ({len(trading_dates)}거래일)',
            'data': {
                'correlation_matrix': correlation_dict,
                'patterns': patterns[:5],
                'clusters': clusters,
                'cumulative_returns': cumulative_returns,
                'sectors': sectors
            }
        }
    finally:
        await conn.close()

