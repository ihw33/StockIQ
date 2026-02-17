from fastapi import APIRouter, HTTPException
from collectors.us_market import USMarketCollector
from collectors.kiwoom import KiwoomCollector
from collectors.macro_dashboard import MacroDashboardCollector
from datetime import datetime as dt
import requests as req

router = APIRouter()


@router.get("/api/market/map")
def get_market_map():
    """
    Returns hierarchical data for the Market Treemap.
    """
    collector = USMarketCollector()
    return collector.get_market_map_data()


@router.get("/api/market/investor-trends")
async def get_market_investor_trends():
    """KOSPI 전체 시장 투자자별 매매동향 (ka10066 via MacroDashboardCollector)"""
    try:
        collector = MacroDashboardCollector()
        token = collector._get_token()
        if not token:
            return {"status": "no_data", "data": None}

        today = dt.now().strftime("%Y%m%d")
        url = f"{collector.base_url}/api/dostk/mrkcond"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": "ka10066",
            "Authorization": f"Bearer {token}"
        }
        body = {
            "stk_cd": "001",
            "mrkt_tp": "001",
            "strtt_dt": today,
            "end_dt": today,
            "amt_qty_tp": "2",  # 금액(백만원)
            "trde_tp": "0",
            "stex_tp": "1"
        }
        res = req.post(url, headers=headers, json=body, timeout=10)
        res.raise_for_status()
        data = res.json()

        items = data.get("opaf_invsr_trde", [])
        if not items:
            for k, v in data.items():
                if isinstance(v, list) and len(v) > 0:
                    items = v
                    break

        if not items:
            return {"status": "no_data", "data": None}

        # Debug: check structure
        print(f"[MarketTrends] items count: {len(items)}")
        if items:
            print(f"[MarketTrends] first keys: {list(items[0].keys())[:10]}")
            # Check if there's a total/합계 row
            for i, item in enumerate(items[:5]):
                stk_cd = item.get('stk_cd', '')
                stk_nm = item.get('stk_nm', '')
                frgnr = item.get('frgnr_invsr', '0')
                print(f"[MarketTrends] [{i}] stk_cd={stk_cd} stk_nm={stk_nm} frgnr={frgnr}")

        # Sum all rows for market total
        def safe_int(v):
            try:
                s = str(v).replace(',', '').replace('+', '').strip()
                return int(s) if s else 0
            except:
                return 0

        total_foreign = 0
        total_finance = 0
        total_insurance = 0
        total_invest_trust = 0
        total_etc_finance = 0
        total_bank = 0
        total_pension = 0
        total_private_fund = 0
        total_etc_corp = 0
        total_individual = 0

        for row in items:
            total_foreign += safe_int(row.get('frgnr_invsr'))
            total_finance += safe_int(row.get('fnnc_invt'))
            total_insurance += safe_int(row.get('insrnc'))
            total_invest_trust += safe_int(row.get('invtrt'))
            total_etc_finance += safe_int(row.get('etc_fnnc'))
            total_bank += safe_int(row.get('bank'))
            total_pension += safe_int(row.get('penfnd_etc'))
            total_private_fund += safe_int(row.get('samo_fund'))
            total_etc_corp += safe_int(row.get('etc_corp'))
            total_individual += safe_int(row.get('ind_invsr'))

        institution = total_finance + total_insurance + total_invest_trust + total_etc_finance + total_bank + total_pension + total_private_fund
        individual = total_individual if total_individual != 0 else -(total_foreign + institution + total_etc_corp)

        print(f"[MarketTrends] TOTAL foreign={total_foreign} institution={institution} individual={individual}")

        # 백만원 → 억원 변환 (100백만 = 1억)
        return {
            "status": "success",
            "data": {
                "date": today,
                "foreign": round(total_foreign / 100),
                "institution": round(institution / 100),
                "individual": round(individual / 100),
                "unit": "억원",
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/company/{symbol}/fundamentals")
async def get_company_fundamentals(symbol: str):
    """
    Get company fundamental data (PER, PBR, ROE, EPS)
    Caches data in DB for 1 day
    """
    try:
        from database import analysis_db
        from collectors.dart_collector import get_company_overview, get_financial_statement

        # Ensure DB is connected
        await analysis_db.connect()

        # Check if we have recent data in DB (within 24 hours)
        async with analysis_db.pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT * FROM company_financials WHERE symbol = $1 AND date = CURRENT_DATE",
                symbol
            )

            # Always fetch extended data from Kiwoom for full info
            kiwoom = KiwoomCollector()
            ext_data = kiwoom.get_company_info(symbol)

            # Fetch DART financial statement (quarterly)
            dart_financials = get_financial_statement(symbol)

            if existing:
                base = {
                    "symbol": symbol,
                    "per": float(existing['per']) if existing['per'] else None,
                    "pbr": float(existing['pbr']) if existing['pbr'] else None,
                    "roe": float(existing['roe']) if existing['roe'] else None,
                    "eps": float(existing['eps']) if existing['eps'] else None,
                    "bps": float(existing['bps']) if existing['bps'] else None,
                    "market_cap": existing['market_cap'],
                    "updated_at": existing['updated_at'].isoformat()
                }
                # Merge extended data
                if ext_data:
                    for k in ['ev', 'stk_nm', 'settle_month', 'listed_shares', 'credit_ratio',
                              'year_high', 'year_low', 'high_250', 'low_250', 'foreign_ratio',
                              'net_income', 'dividend_rate', 'market_cap']:
                        if ext_data.get(k) is not None:
                            base[k] = ext_data[k]

                # Merge DART financial data (quarterly, more recent)
                if dart_financials:
                    base["sales"] = dart_financials.get('revenue', 0) // 100000000  # 원 → 억원
                    base["operating_profit"] = dart_financials.get('operating_profit', 0) // 100000000  # 원 → 억원
                    base["operating_profit_growth"] = dart_financials.get('operating_profit_growth')
                    base["fiscal_period"] = f"{dart_financials.get('year', '')} {dart_financials.get('quarter', '')}".strip()

                # Merge DART company overview
                dart_info = get_company_overview(symbol)
                if dart_info:
                    base["dart_overview"] = dart_info
                return {
                    "status": "success",
                    "source": "cache",
                    "data": base
                }

        # No cache — use the data already fetched above
        data = ext_data

        if not data:
            raise HTTPException(status_code=404, detail="Company data not found")

        # Save to DB
        async with analysis_db.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO company_financials
                (symbol, per, pbr, roe, eps, bps, market_cap, date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
                ON CONFLICT (symbol, date) DO UPDATE
                SET per = $2, pbr = $3, roe = $4, eps = $5, bps = $6, market_cap = $7, updated_at = NOW()
                """,
                symbol,
                data.get('per'),
                data.get('pbr'),
                data.get('roe'),
                data.get('eps'),
                data.get('bps'),
                data.get('market_cap')
            )

        # Build result with DART financial data
        result_data = {
            "symbol": symbol,
            "per": data.get('per'),
            "pbr": data.get('pbr'),
            "roe": data.get('roe'),
            "eps": data.get('eps'),
            "bps": data.get('bps'),
            "ev": data.get('ev'),
            "market_cap": data.get('market_cap'),
            "stk_nm": data.get('stk_nm', ''),
            "settle_month": data.get('settle_month', ''),
            "listed_shares": data.get('listed_shares'),
            "credit_ratio": data.get('credit_ratio'),
            "year_high": data.get('year_high'),
            "year_low": data.get('year_low'),
            "high_250": data.get('high_250'),
            "low_250": data.get('low_250'),
            "foreign_ratio": data.get('foreign_ratio'),
            "net_income": data.get('net_income'),
            "dividend_rate": data.get('dividend_rate'),
        }

        # Add DART financial data (quarterly, more recent)
        if dart_financials:
            result_data["sales"] = dart_financials.get('revenue', 0) // 100000000  # 원 → 억원
            result_data["operating_profit"] = dart_financials.get('operating_profit', 0) // 100000000  # 원 → 억원
            result_data["operating_profit_growth"] = dart_financials.get('operating_profit_growth')
            result_data["fiscal_period"] = f"{dart_financials.get('year', '')} {dart_financials.get('quarter', '')}".strip()
        else:
            # Fallback to Kiwoom data if DART not available
            result_data["sales"] = data.get('sales')
            result_data["operating_profit"] = data.get('operating_profit')

        # Add DART company overview
        dart_info = get_company_overview(symbol)
        if dart_info:
            result_data["dart_overview"] = dart_info

        result = {
            "status": "success",
            "source": "api",
            "data": result_data
        }
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/company/{symbol}/investor-trends")
async def get_investor_trends(symbol: str):
    """종목별 투자자 매매동향 (당일 누적 순매수)"""
    try:
        kiwoom = KiwoomCollector()
        stock_data = kiwoom.get_investor_trends(symbol)
        if not stock_data:
            return {"status": "no_data", "data": None}
        return {"status": "success", "data": stock_data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/company/{symbol}/investor-history")
async def get_investor_history(symbol: str, days: int = 60):
    """종목별 투자자 순매수 히스토리 + 주가 (최근 N일)"""
    try:
        kiwoom = KiwoomCollector()
        d = min(days, 90)
        history = kiwoom.get_investor_trends_history(symbol, days=d)
        if not history:
            return {"status": "no_data", "data": [], "cumulative": None}

        # ka10059 응답에서 가격+투자자 데이터 모두 포함 (ka10081 별도 호출 불필요)
        # 거래량/대비 0인 첫 행(미래날짜) 제거
        data = [h for h in history if h.get('volume', 0) > 0 or h.get('close', 0) == 0]
        if data and data[0].get('volume', 0) == 0 and data[0].get('individual', 0) == 0:
            data = data[1:]

        # 누적 합산
        cum = {'foreign': 0, 'institution': 0, 'individual': 0}
        for h in data:
            cum['foreign'] += h['foreign']
            cum['institution'] += h['institution']
            cum['individual'] += h['individual']

        return {"status": "success", "data": data, "cumulative": cum}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/company/{symbol}/after-hours")
async def get_after_hours(symbol: str):
    """시간외/넥스트 시장 가격 조회. NEXT → ka10087 순으로 시도."""
    try:
        kiwoom = KiwoomCollector()

        # 1) NEXT 시장 시도 (_AL, _NX 접미사)
        next_data = kiwoom.get_next_market_price(symbol)
        if next_data and next_data.get('cur_price'):
            print(f"[AfterHours] {symbol} NEXT: price={next_data['cur_price']}, source={next_data.get('source')}")
            return {"status": "success", "data": next_data}

        # 2) 기존 ka10087 시간외 단일가 시도
        data = kiwoom.get_after_hours(symbol)
        if not data or not data.get('cur_price'):
            print(f"[AfterHours] No data returned for {symbol}")
            return {"status": "no_data", "data": None}
        data['source'] = 'ka10087'
        print(f"[AfterHours] {symbol}: price={data.get('cur_price')}, change={data.get('change')}")
        return {"status": "success", "data": data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/market/calendar")
def get_market_calendar(days: int = 60):
    """
    최근 N일의 거래일/휴장일 정보 반환
    - is_trading_day: bool
    - reason: 휴장 이유 (토요일/일요일/공휴일명)
    - day_of_week: 요일 (월~일)
    """
    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).parent.parent))
    from utils.market_calendar import get_market_status
    from datetime import date, timedelta

    DAYS_KR = ['월', '화', '수', '목', '금', '토', '일']
    today = date.today()
    result = []

    for i in range(days):
        d = today - timedelta(days=i)
        status = get_market_status(d)
        result.append({
            'date': d.isoformat(),
            'day_of_week': DAYS_KR[d.weekday()] + '요일',
            'is_trading_day': status['is_trading_day'],
            'reason': status['reason'],
        })

    return {'success': True, 'calendar': result}
