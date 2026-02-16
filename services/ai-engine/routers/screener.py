from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import FinanceDataReader as fdr
import pandas as pd
import json
import os
import asyncpg
import asyncio
from datetime import datetime
import uuid

from models.requests import ScreenerRequest
from strategies.screener import run_custom_screen, get_screener, get_screener_profiles
from collectors.kiwoom import KiwoomCollector
from collectors.dart_collector import get_financial_statement
from database import analysis_db

router = APIRouter()

# 종목 분류 데이터 로드
CLASSIFICATIONS_PATH = os.path.join(os.path.dirname(__file__), '../../../data/stock_classifications.json')
with open(CLASSIFICATIONS_PATH, 'r', encoding='utf-8') as f:
    STOCK_CLASSIFICATIONS = json.load(f)

# 배치 작업 상태 저장소 (메모리 기반)
BATCH_JOBS: Dict[str, Dict[str, Any]] = {}


# 새로운 스크리너 요청 모델
class NewScreenerRequest(BaseModel):
    type: str = 'theme'  # 'industry' or 'theme'
    name: str = '반도체 장비'
    filters: Optional[Dict[str, Any]] = None


class RealtimeRequest(BaseModel):
    symbols: List[str]  # 실시간 업데이트할 종목 코드 리스트


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


@router.post("/api/screener/v2/list")
async def list_screener_cache(request: NewScreenerRequest):
    """
    스크리너 캐시 조회 (빠름, 페이지 로드용)
    """
    try:
        await analysis_db.connect()

        # 캐시에서 조회
        rows = await analysis_db.pool.fetch(
            """
            SELECT symbol, name, market, sector, industry, market_cap,
                   per, pbr, roe, eps, bps,
                   revenue, operating_profit, operating_profit_growth,
                   fiscal_period, updated_at
            FROM screener_cache
            WHERE classification_type = $1 AND classification_name = $2
            ORDER BY market_cap DESC NULLS LAST
            """,
            request.type,
            request.name
        )

        results = []
        for row in rows:
            results.append({
                'symbol': row['symbol'],
                'name': row['name'],
                'market': row['market'],
                'sector': row['sector'],
                'industry': row['industry'],
                'market_cap': row['market_cap'],
                'per': row['per'],
                'pbr': row['pbr'],
                'roe': row['roe'],
                'eps': row['eps'],
                'bps': row['bps'],
                'revenue': row['revenue'],
                'operating_profit': row['operating_profit'],
                'operating_profit_growth': float(row['operating_profit_growth']) if row['operating_profit_growth'] else None,
                'fiscal_period': row['fiscal_period'] or '',
            })

        # 마지막 업데이트 시간
        last_updated = rows[0]['updated_at'] if rows else None

        return {
            'total': len(results),
            'results': results,
            'type': request.type,
            'name': request.name,
            'last_updated': last_updated.isoformat() if last_updated else None
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/screener/v2/update")
async def update_screener_cache(request: NewScreenerRequest):
    """
    스크리너 데이터 업데이트 (느림, Kiwoom API 호출)
    """
    try:
        # 분류 타입에 따라 데이터 조회
        if request.type == 'theme':
            classifications = STOCK_CLASSIFICATIONS.get('themes', {})
        elif request.type == 'industry':
            classifications = STOCK_CLASSIFICATIONS.get('industries', {})
        else:
            raise HTTPException(status_code=400, detail=f"Invalid type: {request.type}. Use 'theme' or 'industry'")

        # 해당 분류 이름 찾기
        if request.name not in classifications:
            available = list(classifications.keys())
            raise HTTPException(
                status_code=404,
                detail=f"Classification '{request.name}' not found. Available: {available}"
            )

        classification_data = classifications[request.name]
        stock_codes = classification_data.get('codes', [])

        if not stock_codes:
            raise HTTPException(
                status_code=404,
                detail=f"No stock codes found for {request.type} '{request.name}'"
            )

        print(f"[Screener] Fetching {len(stock_codes)} stocks from {request.type} '{request.name}'...")

        # FDR로 시장 정보 + 시가총액 매핑 테이블 생성 (한번만 호출)
        kospi = fdr.StockListing('KOSPI')
        kosdaq = fdr.StockListing('KOSDAQ')
        all_stocks = pd.concat([kospi, kosdaq])
        market_map = dict(zip(all_stocks['Code'], all_stocks['Market']))
        # 시가총액 매핑 (FDR의 Marcap은 백만원 단위 → 억원으로 변환)
        marcap_map = {}
        for _, row in all_stocks.iterrows():
            code = row['Code']
            marcap = row.get('Marcap', 0)
            if pd.notna(marcap) and marcap > 0:
                marcap_map[code] = int(marcap / 100)  # 백만원 → 억원
            else:
                marcap_map[code] = 0

        # Kiwoom API로 종목 정보 조회
        kiwoom = KiwoomCollector()
        results = []

        for idx, symbol in enumerate(stock_codes):
            # Kiwoom API로 종목명 + 재무 데이터 가져오기
            try:
                info = kiwoom.get_company_info(symbol)
                if not info:
                    print(f"[Screener] No data for {symbol}, skipping")
                    await asyncio.sleep(0.3)  # Rate limit 방지
                    continue
            except Exception as e:
                print(f"[Screener] Failed to fetch {symbol}: {e}")
                await asyncio.sleep(0.3)  # Rate limit 방지
                continue

            # DART API로 재무제표 데이터 가져오기
            financial = get_financial_statement(symbol)
            # DART API는 "원" 단위로 리턴 → "억원"으로 변환
            revenue = (financial.get('revenue', 0) // 100000000) if financial else 0
            operating_profit = (financial.get('operating_profit', 0) // 100000000) if financial else 0
            operating_profit_growth = financial.get('operating_profit_growth', 0) if financial else 0
            fiscal_period = f"{financial.get('year', '')} {financial.get('quarter', '')}".strip() if financial else ''

            result = {
                'symbol': symbol,
                'name': info.get('stk_nm', 'N/A'),
                'market': market_map.get(symbol, 'KOSPI'),
                'sector': classification_data.get('description', request.name),
                'industry': request.name,
                'market_cap': marcap_map.get(symbol, 0),  # FDR 시가총액 사용
                'per': info.get('per'),
                'pbr': info.get('pbr'),
                'roe': info.get('roe'),
                'eps': info.get('eps'),
                'bps': info.get('bps'),
                # 재무제표 (DART)
                'revenue': revenue,
                'operating_profit': operating_profit,
                'operating_profit_growth': operating_profit_growth,
                'fiscal_period': fiscal_period,
                # 거래 정보
                'cur_price': info.get('cur_price'),
                'volume': info.get('volume'),
                'trade_amount': info.get('trade_amount'),
            }

            results.append(result)

            # Rate limit 방지: 10개마다 1초 대기
            if (idx + 1) % 10 == 0:
                print(f"[Screener] Processed {idx + 1}/{len(stock_codes)}, pausing...")
                await asyncio.sleep(1.0)
            else:
                await asyncio.sleep(0.3)

        print(f"[Screener] Fetched {len(results)} results, saving to cache...")

        # DB에 저장
        await analysis_db.connect()

        # 기존 데이터 삭제
        await analysis_db.pool.execute(
            "DELETE FROM screener_cache WHERE classification_type = $1 AND classification_name = $2",
            request.type,
            request.name
        )

        # 새 데이터 삽입
        for result in results:
            await analysis_db.pool.execute(
                """
                INSERT INTO screener_cache
                (symbol, name, market, classification_type, classification_name,
                 sector, industry, market_cap, per, pbr, roe, eps, bps,
                 revenue, operating_profit, operating_profit_growth, fiscal_period, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
                """,
                result['symbol'],
                result['name'],
                result['market'],
                request.type,
                request.name,
                result['sector'],
                result['industry'],
                result['market_cap'],
                result['per'],
                result['pbr'],
                result['roe'],
                result['eps'],
                result['bps'],
                result['revenue'],
                result['operating_profit'],
                result['operating_profit_growth'],
                result['fiscal_period']
            )

        print(f"[Screener] Cache updated successfully")

        return {
            'total': len(results),
            'results': results,
            'type': request.type,
            'name': request.name,
            'description': classification_data.get('description', ''),
            'source': classification_data.get('source', ''),
            'updated_at': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/screener/v2/realtime")
async def get_realtime_info(request: RealtimeRequest):
    """
    실시간 거래 정보 조회 (현재가, 거래량, 거래대금)
    화면에 보이는 20개 종목만 빠르게 조회
    """
    try:
        if not request.symbols or len(request.symbols) == 0:
            raise HTTPException(status_code=400, detail="No symbols provided")

        if len(request.symbols) > 30:
            raise HTTPException(status_code=400, detail="Maximum 30 symbols allowed")

        print(f"[Screener] Fetching realtime data for {len(request.symbols)} symbols...")

        results = []

        for symbol in request.symbols:
            try:
                # FDR로 최근 2일 데이터 가져오기
                df = fdr.DataReader(symbol, start='2026-02-10')

                if df.empty or len(df) < 2:
                    print(f"[Screener] No data for {symbol}")
                    continue

                # 최근 데이터
                latest = df.iloc[-1]
                prev = df.iloc[-2]

                cur_price = int(latest['Close'])
                prev_close = int(prev['Close'])
                change = cur_price - prev_close
                change_pct = (change / prev_close * 100) if prev_close > 0 else 0

                # 종목명은 캐시에서 가져오기 (빠름)
                await analysis_db.connect()
                row = await analysis_db.pool.fetchrow(
                    "SELECT name FROM screener_cache WHERE symbol = $1 LIMIT 1",
                    symbol
                )
                name = row['name'] if row else symbol

                results.append({
                    'symbol': symbol,
                    'name': name,
                    'cur_price': cur_price,
                    'change': change,
                    'change_pct': round(change_pct, 2),
                    'volume': int(latest['Volume']),
                    'trade_amount': int(cur_price * latest['Volume']),
                })

                await asyncio.sleep(0.1)

            except Exception as e:
                print(f"[Screener] Failed to fetch realtime for {symbol}: {e}")
                continue

        print(f"[Screener] Realtime data fetched for {len(results)} symbols")

        return {
            'total': len(results),
            'results': results
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 전체 섹터 일괄 업데이트 (배치 작업)
# ============================================

async def run_batch_update(batch_id: str):
    """
    백그라운드에서 전체 섹터 업데이트 실행 (최적화 버전: 중복 제거)
    """
    try:
        print(f"[Batch {batch_id}] Starting optimized batch update...")

        # 1단계: 전체 종목 코드 수집 + 섹터 매핑
        industries_data = STOCK_CLASSIFICATIONS.get('industries', {})
        themes_data = STOCK_CLASSIFICATIONS.get('themes', {})

        # 종목 → 섹터 매핑 (한 종목이 여러 섹터에 속할 수 있음)
        symbol_to_sectors = {}  # {symbol: [(type, name), ...]}

        for industry_name, industry_data in industries_data.items():
            if industry_name == '기타':  # ETF/ETN 제외
                continue
            for symbol in industry_data.get('codes', []):
                if symbol not in symbol_to_sectors:
                    symbol_to_sectors[symbol] = []
                symbol_to_sectors[symbol].append(('industry', industry_name))

        for theme_name, theme_data in themes_data.items():
            for symbol in theme_data.get('codes', []):
                if symbol not in symbol_to_sectors:
                    symbol_to_sectors[symbol] = []
                symbol_to_sectors[symbol].append(('theme', theme_name))

        unique_symbols = list(symbol_to_sectors.keys())
        total_symbols = len(unique_symbols)

        print(f"[Batch {batch_id}] Unique symbols: {total_symbols}")

        # 배치 상태 초기화
        BATCH_JOBS[batch_id] = {
            'status': 'running',
            'total': total_symbols,
            'completed': 0,
            'current_sector': '종목 데이터 수집 중',
            'current_type': 'symbol',
            'started_at': datetime.now().isoformat(),
            'completed_at': None,
            'error': None
        }

        # 2단계: FDR로 시장 정보 + 시가총액 매핑 테이블 생성 (한번만)
        kospi = fdr.StockListing('KOSPI')
        kosdaq = fdr.StockListing('KOSDAQ')
        all_stocks = pd.concat([kospi, kosdaq])
        market_map = dict(zip(all_stocks['Code'], all_stocks['Market']))
        marcap_map = {}
        for _, row in all_stocks.iterrows():
            code = row['Code']
            marcap = row.get('Marcap', 0)
            if pd.notna(marcap) and marcap > 0:
                marcap_map[code] = int(marcap / 100)  # 백만원 → 억원
            else:
                marcap_map[code] = 0

        # 3단계: 종목별로 API 호출 (한 번만!)
        kiwoom = KiwoomCollector()
        symbol_data_cache = {}  # {symbol: data}

        for idx, symbol in enumerate(unique_symbols):
            # 취소 체크
            if BATCH_JOBS[batch_id]['status'] == 'cancelled':
                print(f"[Batch {batch_id}] Cancelled by user")
                break

            BATCH_JOBS[batch_id]['current_sector'] = f'{symbol} ({idx + 1}/{total_symbols})'

            try:
                # Kiwoom API로 종목 정보
                info = kiwoom.get_company_info(symbol)
                if not info:
                    await asyncio.sleep(0.3)
                    continue

                # DART API로 재무제표
                financial = get_financial_statement(symbol)
                revenue = (financial.get('revenue', 0) // 100000000) if financial else 0
                operating_profit = (financial.get('operating_profit', 0) // 100000000) if financial else 0
                operating_profit_growth = financial.get('operating_profit_growth', 0) if financial else 0
                fiscal_period = f"{financial.get('year', '')} {financial.get('quarter', '')}".strip() if financial else ''

                # 데이터 캐싱
                symbol_data_cache[symbol] = {
                    'symbol': symbol,
                    'name': info.get('stk_nm', 'N/A'),
                    'market': market_map.get(symbol, 'KOSPI'),
                    'market_cap': marcap_map.get(symbol, 0),
                    'per': info.get('per'),
                    'pbr': info.get('pbr'),
                    'roe': info.get('roe'),
                    'eps': info.get('eps'),
                    'bps': info.get('bps'),
                    'revenue': revenue,
                    'operating_profit': operating_profit,
                    'operating_profit_growth': operating_profit_growth,
                    'fiscal_period': fiscal_period,
                    'cur_price': info.get('cur_price'),
                    'volume': info.get('volume'),
                    'trade_amount': info.get('trade_amount'),
                }

                BATCH_JOBS[batch_id]['completed'] = idx + 1

                # Rate limit: 10개마다 1초, 나머지는 0.3초
                if (idx + 1) % 10 == 0:
                    await asyncio.sleep(1.0)
                else:
                    await asyncio.sleep(0.3)

            except Exception as e:
                print(f"[Batch {batch_id}] Error fetching {symbol}: {e}")
                continue

        # 4단계: 각 섹터별로 DB에 저장
        print(f"[Batch {batch_id}] Saving to database...")
        await analysis_db.connect()

        # 섹터별로 종목 분류
        sector_stocks = {}  # {(type, name): [symbols]}
        for symbol, sectors in symbol_to_sectors.items():
            if symbol not in symbol_data_cache:
                continue
            for sector_type, sector_name in sectors:
                key = (sector_type, sector_name)
                if key not in sector_stocks:
                    sector_stocks[key] = []
                sector_stocks[key].append(symbol)

        # 섹터별로 저장
        for (sector_type, sector_name), symbols in sector_stocks.items():
            # 기존 데이터 삭제
            await analysis_db.pool.execute(
                "DELETE FROM screener_cache WHERE classification_type = $1 AND classification_name = $2",
                sector_type, sector_name
            )

            # 새 데이터 삽입
            for symbol in symbols:
                if symbol not in symbol_data_cache:
                    continue
                data = symbol_data_cache[symbol]
                await analysis_db.pool.execute(
                    """
                    INSERT INTO screener_cache
                    (symbol, name, market, classification_type, classification_name,
                     sector, industry, market_cap, per, pbr, roe, eps, bps,
                     revenue, operating_profit, operating_profit_growth, fiscal_period, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
                    """,
                    data['symbol'], data['name'], data['market'], sector_type, sector_name,
                    sector_name, sector_name, data['market_cap'], data['per'], data['pbr'],
                    data['roe'], data['eps'], data['bps'], data['revenue'], data['operating_profit'],
                    data['operating_profit_growth'], data['fiscal_period']
                )

        # 완료 처리
        BATCH_JOBS[batch_id]['status'] = 'completed' if BATCH_JOBS[batch_id]['status'] != 'cancelled' else 'cancelled'
        BATCH_JOBS[batch_id]['completed_at'] = datetime.now().isoformat()

        print(f"[Batch {batch_id}] Finished: {BATCH_JOBS[batch_id]['status']}")
        print(f"[Batch {batch_id}] Total symbols processed: {len(symbol_data_cache)}")

    except Exception as e:
        import traceback
        traceback.print_exc()

        # 에러 처리
        BATCH_JOBS[batch_id]['status'] = 'failed'
        BATCH_JOBS[batch_id]['error'] = str(e)
        BATCH_JOBS[batch_id]['completed_at'] = datetime.now().isoformat()

        print(f"[Batch {batch_id}] Failed: {e}")


@router.post("/api/screener/v2/update-all-sectors")
async def start_batch_update():
    """
    전체 섹터 일괄 업데이트 시작 (백그라운드 작업)
    """
    try:
        # 중복 실행 방지: 이미 실행 중인 배치가 있는지 확인
        running_batches = [bid for bid, job in BATCH_JOBS.items() if job['status'] == 'running']
        if running_batches:
            raise HTTPException(
                status_code=409,
                detail=f"Another batch is already running (ID: {running_batches[0][:8]}...)"
            )

        # 배치 ID 생성
        batch_id = str(uuid.uuid4())

        # 백그라운드 Task 시작
        asyncio.create_task(run_batch_update(batch_id))

        return {
            'batch_id': batch_id,
            'message': 'Batch update started',
            'status': 'started'
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/screener/v2/batch-status")
async def get_all_batch_status():
    """
    모든 배치 작업 조회
    """
    return {
        'total': len(BATCH_JOBS),
        'jobs': BATCH_JOBS
    }


@router.get("/api/screener/v2/batch-status/{batch_id}")
async def get_batch_status(batch_id: str):
    """
    배치 작업 진행 상황 조회
    """
    if batch_id not in BATCH_JOBS:
        raise HTTPException(status_code=404, detail=f"Batch job '{batch_id}' not found")

    return BATCH_JOBS[batch_id]


@router.post("/api/screener/v2/batch-cancel/{batch_id}")
async def cancel_batch_update(batch_id: str):
    """
    배치 작업 취소
    """
    if batch_id not in BATCH_JOBS:
        raise HTTPException(status_code=404, detail=f"Batch job '{batch_id}' not found")

    if BATCH_JOBS[batch_id]['status'] == 'running':
        BATCH_JOBS[batch_id]['status'] = 'cancelled'
        return {
            'batch_id': batch_id,
            'message': 'Batch update cancelled',
            'status': 'cancelled'
        }
    else:
        return {
            'batch_id': batch_id,
            'message': f"Cannot cancel: status is '{BATCH_JOBS[batch_id]['status']}'",
            'status': BATCH_JOBS[batch_id]['status']
        }
