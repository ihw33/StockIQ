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

from models.requests import ScreenerRequest
from strategies.screener import run_custom_screen, get_screener, get_screener_profiles
from collectors.kiwoom import KiwoomCollector
from database import analysis_db

router = APIRouter()

# 종목 분류 데이터 로드
CLASSIFICATIONS_PATH = os.path.join(os.path.dirname(__file__), '../../../data/stock_classifications.json')
with open(CLASSIFICATIONS_PATH, 'r', encoding='utf-8') as f:
    STOCK_CLASSIFICATIONS = json.load(f)


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
                   per, pbr, roe, eps, bps, updated_at
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
                 sector, industry, market_cap, per, pbr, roe, eps, bps, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
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
                result['bps']
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
