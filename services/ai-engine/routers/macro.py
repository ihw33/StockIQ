from fastapi import APIRouter, HTTPException
from typing import Optional
import os
import logging
import json
from datetime import date, timedelta, datetime as dt_datetime
import pytz

from models.requests import MacroCollectRequest
from database import analysis_db
from collectors.macro_dashboard import MacroDashboardCollector
from collectors.news_collector import collect_all_news
from collectors.dart_collector import collect_dart_filings, get_company_overview
from collectors.llm_analyzer import generate_team_briefing, generate_pm_briefing
from collectors.economic_calendar_collector import collect_calendar
from collectors.kiwoom import KiwoomCollector

logger = logging.getLogger(__name__)

router = APIRouter()


def _fetch_holdings_from_kiwoom() -> list:
    """키움 API에서 실제 보유종목 자동 조회"""
    account_no = os.getenv("KIWOOM_ACCOUNT")
    if not account_no:
        logger.warning("[Macro] KIWOOM_ACCOUNT not set — 보유종목 자동조회 불가")
        return []
    try:
        kiwoom = KiwoomCollector()
        raw = kiwoom.get_holdings(account_no)
        holdings = []
        for h in raw:
            symbol = h.get("stk_cd", "").replace("A", "")
            name = h.get("stk_nm", symbol)
            if symbol:
                holdings.append({"symbol": symbol, "name": name, "type": "holding"})
        logger.info(f"[Macro] 키움 보유종목 {len(holdings)}개 조회: {[h['name'] for h in holdings]}")
        return holdings
    except Exception as e:
        logger.error(f"[Macro] 키움 보유종목 조회 실패: {e}")
        return []


@router.post("/api/macro/collect")
async def collect_macro_data(request: MacroCollectRequest = MacroCollectRequest()):
    """
    매크로 데이터 수집 → DB 저장.
    전날 데이터의 actual 값도 backfill.
    보유종목: 키움 API 자동 조회 (KIWOOM_ACCOUNT 설정 필요)
    관심종목: request.watchlist로 전달
    """
    try:
        await analysis_db.connect()

        # 1. 조정된 가중치 가져오기 (20일 이상 데이터 있으면)
        collector = MacroDashboardCollector()
        adjusted_weights = None

        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM macro_daily WHERE actual_kospi_change IS NOT NULL ORDER BY date DESC LIMIT 20"
            )
            if len(rows) >= 20:
                history = [dict(r) for r in rows]
                accuracy = collector.calculate_indicator_accuracy(history)
                adjusted_weights = collector.get_adjusted_weights(accuracy)

        # 2. 오늘 데이터 수집
        result = collector.collect_all(adjusted_weights)

        # 3. 전날 actual backfill (오늘의 외국인 순매매 = 전날 예측의 actual)
        async with analysis_db.pool.acquire() as conn:
            yesterday = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date < CURRENT_DATE AND actual_kospi_change IS NULL ORDER BY date DESC LIMIT 1"
            )
            if yesterday:
                # KOSPI 변동은 오늘 외국인 현물 순매매 방향으로 대체 추정
                # (실제 KOSPI 변동은 별도 수집 필요 — 간이 방식)
                today_foreign = result["tier_b"]["foreign_cash"]["net_amount"]
                kospi_proxy = 0.5 if today_foreign > 0 else (-0.5 if today_foreign < 0 else 0)

                await conn.execute(
                    """UPDATE macro_daily
                       SET actual_kospi_change = $1, actual_foreign_net = $2, updated_at = NOW()
                       WHERE date = $3""",
                    kospi_proxy, today_foreign, yesterday["date"]
                )

        # 4. 보유종목 자동 조회 + 관심종목 합치기
        kiwoom_holdings = _fetch_holdings_from_kiwoom()
        manual_holdings = [s for s in (request.portfolio or []) if s.get("type") == "holding"]
        watchlist = [dict(s, type="watchlist") for s in (request.watchlist or [])]

        # 키움 자동조회 우선, 수동 입력은 보충
        all_holdings = kiwoom_holdings if kiwoom_holdings else manual_holdings
        portfolio_symbols = all_holdings + watchlist
        logger.info(f"[Macro] Portfolio: 보유 {len(all_holdings)}개, 관심 {len(watchlist)}개")

        # 5. 경제 캘린더 수집
        calendar_data = {}
        try:
            calendar_data = collect_calendar()
            logger.info(f"[Macro] Calendar: {len(calendar_data.get('economic_events', []))} events")
        except Exception as cal_err:
            logger.warning(f"[Macro] Calendar error (non-fatal): {cal_err}")

        result["economic_calendar"] = calendar_data

        # 6. 뉴스 수집 + LLM 브리핑 (모드별 분기)
        mode = request.mode or "am"
        news_data = {}
        llm_analysis = None
        llm_analysis_pm = None
        collected_at_am = None
        collected_at_pm = None
        try:
            news_data = collect_all_news(portfolio_symbols if portfolio_symbols else None)
            logger.info(f"[Macro] News collected: {len(news_data.get('macro_news', ''))} chars")

            # DART 공시 수집 (보유종목)
            try:
                dart_data = collect_dart_filings(portfolio_symbols if portfolio_symbols else [], days=3)
                if dart_data.get("filings_text"):
                    news_data["dart_filings"] = dart_data["filings_text"]
                    logger.info(f"[Macro] DART filings: {len(dart_data.get('filings', []))}건")
            except Exception as dart_err:
                logger.warning(f"[Macro] DART error (non-fatal): {dart_err}")

            if mode == "am" and news_data.get("macro_news"):
                # AM 예측 브리핑
                llm_analysis = generate_team_briefing(result, news_data, portfolio_symbols if portfolio_symbols else None)
                collected_at_am = dt_datetime.now(pytz.timezone('Asia/Seoul'))
                logger.info(f"[Macro] AM briefing: {len(llm_analysis or '')} chars")
            elif mode == "pm" and news_data.get("macro_news"):
                # PM 결산 브리핑: DB에서 당일 AM 예측 가져오기
                am_prediction = None
                try:
                    async with analysis_db.pool.acquire() as conn:
                        am_row = await conn.fetchrow(
                            "SELECT llm_analysis FROM macro_daily WHERE date = CURRENT_DATE"
                        )
                    if am_row:
                        am_prediction = am_row["llm_analysis"]
                except Exception:
                    pass
                llm_analysis_pm = generate_pm_briefing(result, news_data, am_prediction, portfolio_symbols if portfolio_symbols else None)
                collected_at_pm = dt_datetime.now(pytz.timezone('Asia/Seoul'))
                logger.info(f"[Macro] PM briefing: {len(llm_analysis_pm or '')} chars")
            # manual 모드: LLM 호출 없음 (데이터만 갱신)
        except Exception as news_err:
            logger.warning(f"[Macro] News/LLM error (non-fatal): {news_err}")

        result["llm_analysis"] = llm_analysis or ""
        result["llm_analysis_pm"] = llm_analysis_pm or ""
        result["collected_at_am"] = collected_at_am.isoformat() if collected_at_am else None
        result["news_context"] = news_data.get("macro_news", "")

        # 5. DB upsert
        accuracy_data = None
        if adjusted_weights:
            accuracy_data = collector.calculate_indicator_accuracy([dict(r) for r in rows])

        # global_markets + risk_indicators 추출
        gm = result.get("global_markets", {})
        ri = result.get("risk_indicators", {})

        async with analysis_db.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO macro_daily
                (date, dxy_value, dxy_change_pct, dxy_score,
                 us10y_value, us10y_change_bps, us10y_score,
                 vix_value, vix_change_pct, vix_score,
                 foreign_net_amount, foreign_score,
                 futures_net, futures_score,
                 short_volume, short_change_pct, short_score,
                 overall_score, safety_level, interpretation, prediction_direction,
                 indicator_accuracy, adjusted_weights, raw_data,
                 us_market_date, us_market_day, kr_market_day,
                 nasdaq_value, nasdaq_change_pct,
                 sp500_value, sp500_change_pct,
                 oil_value, oil_change_pct,
                 gold_value, gold_change_pct,
                 bitcoin_value, bitcoin_change_pct,
                 krw_usd_value, krw_usd_change, krw_usd_change_pct, chain_analysis,
                 llm_analysis, news_context, economic_calendar,
                 llm_analysis_pm, collected_at_pm,
                 us2y_value, us2y_change_bps, spread_2s10s,
                 us30y_value, us30y_change_bps,
                 hy_spread_value, hy_spread_change_bps,
                 move_value, move_change_pct,
                 ewy_value, ewy_change_pct, collected_at_am)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17,
                        $18, $19, $20, $21, $22::jsonb, $23::jsonb, $24::jsonb,
                        $25, $26, $27,
                        $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
                        $38, $39, $40, $41, $42, $43, $44::jsonb,
                        $45, $46,
                        $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58)
                ON CONFLICT (date) DO UPDATE SET
                    dxy_value = EXCLUDED.dxy_value, dxy_change_pct = EXCLUDED.dxy_change_pct, dxy_score = EXCLUDED.dxy_score,
                    us10y_value = EXCLUDED.us10y_value, us10y_change_bps = EXCLUDED.us10y_change_bps, us10y_score = EXCLUDED.us10y_score,
                    vix_value = EXCLUDED.vix_value, vix_change_pct = EXCLUDED.vix_change_pct, vix_score = EXCLUDED.vix_score,
                    foreign_net_amount = EXCLUDED.foreign_net_amount, foreign_score = EXCLUDED.foreign_score,
                    futures_net = EXCLUDED.futures_net, futures_score = EXCLUDED.futures_score,
                    short_volume = EXCLUDED.short_volume, short_change_pct = EXCLUDED.short_change_pct, short_score = EXCLUDED.short_score,
                    overall_score = EXCLUDED.overall_score, safety_level = EXCLUDED.safety_level,
                    interpretation = EXCLUDED.interpretation, prediction_direction = EXCLUDED.prediction_direction,
                    indicator_accuracy = EXCLUDED.indicator_accuracy, adjusted_weights = EXCLUDED.adjusted_weights,
                    raw_data = EXCLUDED.raw_data,
                    us_market_date = EXCLUDED.us_market_date, us_market_day = EXCLUDED.us_market_day, kr_market_day = EXCLUDED.kr_market_day,
                    nasdaq_value = EXCLUDED.nasdaq_value, nasdaq_change_pct = EXCLUDED.nasdaq_change_pct,
                    sp500_value = EXCLUDED.sp500_value, sp500_change_pct = EXCLUDED.sp500_change_pct,
                    oil_value = EXCLUDED.oil_value, oil_change_pct = EXCLUDED.oil_change_pct,
                    gold_value = EXCLUDED.gold_value, gold_change_pct = EXCLUDED.gold_change_pct,
                    bitcoin_value = EXCLUDED.bitcoin_value, bitcoin_change_pct = EXCLUDED.bitcoin_change_pct,
                    krw_usd_value = EXCLUDED.krw_usd_value, krw_usd_change = EXCLUDED.krw_usd_change, krw_usd_change_pct = EXCLUDED.krw_usd_change_pct,
                    chain_analysis = EXCLUDED.chain_analysis,
                    llm_analysis = COALESCE(EXCLUDED.llm_analysis, macro_daily.llm_analysis),
                    llm_analysis_pm = COALESCE(EXCLUDED.llm_analysis_pm, macro_daily.llm_analysis_pm),
                    collected_at_pm = COALESCE(EXCLUDED.collected_at_pm, macro_daily.collected_at_pm),
                    news_context = EXCLUDED.news_context,
                    economic_calendar = EXCLUDED.economic_calendar,
                    us2y_value = EXCLUDED.us2y_value, us2y_change_bps = EXCLUDED.us2y_change_bps,
                    spread_2s10s = EXCLUDED.spread_2s10s,
                    us30y_value = EXCLUDED.us30y_value, us30y_change_bps = EXCLUDED.us30y_change_bps,
                    hy_spread_value = EXCLUDED.hy_spread_value, hy_spread_change_bps = EXCLUDED.hy_spread_change_bps,
                    move_value = EXCLUDED.move_value, move_change_pct = EXCLUDED.move_change_pct,
                    ewy_value = EXCLUDED.ewy_value, ewy_change_pct = EXCLUDED.ewy_change_pct,
                    collected_at_am = COALESCE(EXCLUDED.collected_at_am, macro_daily.collected_at_am),
                    updated_at = NOW()
            """,
            date.fromisoformat(result["date"]),
            result["tier_a"]["dxy"]["value"], result["tier_a"]["dxy"]["change_pct"], result["tier_a"]["dxy"]["score"],
            result["tier_a"]["us10y"]["value"], result["tier_a"]["us10y"]["change_bps"], result["tier_a"]["us10y"]["score"],
            result["tier_a"]["vix"]["value"], result["tier_a"]["vix"]["change_pct"], result["tier_a"]["vix"]["score"],
            result["tier_b"]["foreign_cash"]["net_amount"], result["tier_b"]["foreign_cash"]["score"],
            result["tier_b"]["futures"]["net"], result["tier_b"]["futures"]["score"],
            result["tier_b"]["short_selling"]["volume"], result["tier_b"]["short_selling"]["change_pct"], result["tier_b"]["short_selling"]["score"],
            result["overall_score"], result["safety_level"], result["interpretation"], result["prediction_direction"],
            json.dumps(accuracy_data) if accuracy_data else None,
            json.dumps(adjusted_weights) if adjusted_weights else None,
            json.dumps(result["raw_data"]),
            date.fromisoformat(result["us_market_date"]) if result.get("us_market_date") else None,
            result.get("us_market_day"),
            result.get("kr_market_day"),
            gm.get("nasdaq", {}).get("value"), gm.get("nasdaq", {}).get("change_pct"),
            gm.get("sp500", {}).get("value"), gm.get("sp500", {}).get("change_pct"),
            gm.get("oil", {}).get("value"), gm.get("oil", {}).get("change_pct"),
            gm.get("gold", {}).get("value"), gm.get("gold", {}).get("change_pct"),
            gm.get("bitcoin", {}).get("value"), gm.get("bitcoin", {}).get("change_pct"),
            gm.get("krw_usd", {}).get("value"), gm.get("krw_usd", {}).get("change"), gm.get("krw_usd", {}).get("change_pct"),
            result.get("chain_analysis"),
            llm_analysis if llm_analysis else None,
            result.get("news_context"),
            json.dumps(result.get("economic_calendar")) if result.get("economic_calendar") else None,
            llm_analysis_pm if llm_analysis_pm else None,
            collected_at_pm,
            ri.get("us2y", {}).get("value"), ri.get("us2y", {}).get("change_bps"),
            ri.get("spread_2s10s"),
            ri.get("us30y", {}).get("value"), ri.get("us30y", {}).get("change_bps"),
            ri.get("hy_spread", {}).get("value"), ri.get("hy_spread", {}).get("change_bps"),
            ri.get("move", {}).get("value"), ri.get("move", {}).get("change_pct"),
            gm.get("ewy", {}).get("value"), gm.get("ewy", {}).get("change_pct"),
            collected_at_am,
            )

        return {"status": "success", "data": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/macro/today")
async def get_macro_today():
    """오늘 매크로 데이터 + 전일 리뷰 반환"""
    try:
        await analysis_db.connect()

        today_data = None
        yesterday_data = None
        daily_review = None

        async with analysis_db.pool.acquire() as conn:
            today_row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date = CURRENT_DATE"
            )
            yesterday_row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date < CURRENT_DATE ORDER BY date DESC LIMIT 1"
            )

        if today_row:
            today_data = _macro_row_to_dict(today_row)
        else:
            # 데이터 없으면 라이브 수집
            collector = MacroDashboardCollector()
            today_data = collector.collect_all()

        if yesterday_row:
            collector = MacroDashboardCollector()
            daily_review = collector.generate_daily_review(dict(yesterday_row))

        # 전일 Tier B 확정 데이터 (전일 마감 잔고)
        yesterday_tier_b = None
        if yesterday_row:
            yd = dict(yesterday_row)
            yesterday_tier_b = {
                "date": yd["date"].isoformat() if hasattr(yd["date"], "isoformat") else str(yd["date"]),
                "foreign_cash": {"net_amount": yd.get("foreign_net_amount"), "score": yd.get("foreign_score")},
                "futures": {"net": yd.get("futures_net"), "score": yd.get("futures_score")},
                "short_selling": {
                    "volume": yd.get("short_volume"),
                    "change_pct": float(yd["short_change_pct"]) if yd.get("short_change_pct") is not None else 0,
                    "score": yd.get("short_score"),
                },
            }

        # 적중률 + 가중치
        accuracy = None
        weights = None
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM macro_daily WHERE actual_kospi_change IS NOT NULL ORDER BY date DESC LIMIT 20"
            )
            if rows:
                collector = MacroDashboardCollector()
                history = [dict(r) for r in rows]
                accuracy = collector.calculate_indicator_accuracy(history)
                if len(rows) >= 20:
                    weights = collector.get_adjusted_weights(accuracy)

        response = {
            "status": "success",
            "data": today_data,
            "daily_review": daily_review,
            "yesterday_tier_b": yesterday_tier_b,
            "accuracy": accuracy,
            "adjusted_weights": weights
        }
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/macro/history")
async def get_macro_history(period: str = "weekly"):
    """기간별 히스토리"""
    try:
        days_map = {"weekly": 7, "monthly": 30, "yearly": 365}
        days = days_map.get(period, 7)

        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM macro_daily
                   WHERE date >= CURRENT_DATE - $1::integer
                   ORDER BY date DESC""",
                days
            )

        return {
            "status": "success",
            "period": period,
            "count": len(rows),
            "data": [_macro_row_to_dict(r) for r in rows]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/macro/date/{target_date}")
async def get_macro_by_date(target_date: str):
    """특정 날짜의 매크로 데이터 조회"""
    try:
        from datetime import date as date_cls
        d = date_cls.fromisoformat(target_date)

        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date = $1", d
            )

        if not row:
            return {"status": "not_found", "date": target_date, "data": None}

        data = _macro_row_to_dict(row)

        # daily review (전날 데이터로)
        daily_review = None
        async with analysis_db.pool.acquire() as conn:
            prev_row = await conn.fetchrow(
                "SELECT * FROM macro_daily WHERE date < $1 ORDER BY date DESC LIMIT 1", d
            )
        if prev_row:
            collector = MacroDashboardCollector()
            daily_review = collector.generate_daily_review(dict(prev_row))

        return {
            "status": "success",
            "date": target_date,
            "data": data,
            "daily_review": daily_review,
        }
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {target_date}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/macro/dates")
async def get_macro_available_dates():
    """데이터가 있는 날짜 목록"""
    try:
        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT date, overall_score, safety_level,
                          CASE WHEN llm_analysis IS NOT NULL AND llm_analysis != '' THEN true ELSE false END as has_llm
                   FROM macro_daily ORDER BY date DESC LIMIT 90"""
            )
        return {
            "status": "success",
            "dates": [
                {
                    "date": r["date"].isoformat(),
                    "score": float(r["overall_score"]) if r["overall_score"] else 0,
                    "safety_level": r["safety_level"] or 2,
                    "has_llm": r["has_llm"],
                }
                for r in rows
            ]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/macro/accuracy")
async def get_macro_accuracy():
    """지표별 적중률 + 조정 가중치"""
    try:
        await analysis_db.connect()
        async with analysis_db.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM macro_daily WHERE actual_kospi_change IS NOT NULL ORDER BY date DESC LIMIT 20"
            )

        if not rows:
            return {"status": "success", "accuracy": {}, "adjusted_weights": None, "data_days": 0}

        collector = MacroDashboardCollector()
        history = [dict(r) for r in rows]
        accuracy = collector.calculate_indicator_accuracy(history)
        weights = collector.get_adjusted_weights(accuracy) if len(rows) >= 20 else None

        return {
            "status": "success",
            "data_days": len(rows),
            "accuracy": accuracy,
            "adjusted_weights": weights
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _macro_row_to_dict(row) -> dict:
    """asyncpg Record → dict 변환"""
    d = dict(row)

    def _safe_float(key):
        v = d.get(key)
        return float(v) if v is not None else None

    def _safe_float_or_zero(key):
        v = d.get(key)
        return float(v) if v is not None else 0

    return {
        "date": d["date"].isoformat() if hasattr(d["date"], "isoformat") else str(d["date"]),
        "kr_market_day": d.get("kr_market_day", ""),
        "us_market_date": d["us_market_date"].isoformat() if d.get("us_market_date") and hasattr(d["us_market_date"], "isoformat") else str(d.get("us_market_date", "")),
        "us_market_day": d.get("us_market_day", ""),
        "tier_a": {
            "dxy": {
                "value": _safe_float("dxy_value"),
                "change_pct": _safe_float_or_zero("dxy_change_pct"),
                "score": d.get("dxy_score")
            },
            "us10y": {
                "value": _safe_float("us10y_value"),
                "change_bps": _safe_float_or_zero("us10y_change_bps"),
                "score": d.get("us10y_score")
            },
            "vix": {
                "value": _safe_float("vix_value"),
                "change_pct": _safe_float_or_zero("vix_change_pct"),
                "score": d.get("vix_score")
            }
        },
        "tier_b": {
            "foreign_cash": {"net_amount": d.get("foreign_net_amount"), "score": d.get("foreign_score")},
            "futures": {"net": d.get("futures_net"), "score": d.get("futures_score")},
            "short_selling": {
                "volume": d.get("short_volume"),
                "change_pct": _safe_float_or_zero("short_change_pct"),
                "score": d.get("short_score")
            }
        },
        "global_markets": {
            "nasdaq": {"value": _safe_float("nasdaq_value"), "change_pct": _safe_float_or_zero("nasdaq_change_pct")},
            "sp500": {"value": _safe_float("sp500_value"), "change_pct": _safe_float_or_zero("sp500_change_pct")},
            "oil": {"value": _safe_float("oil_value"), "change_pct": _safe_float_or_zero("oil_change_pct")},
            "gold": {"value": _safe_float("gold_value"), "change_pct": _safe_float_or_zero("gold_change_pct")},
            "bitcoin": {"value": _safe_float("bitcoin_value"), "change_pct": _safe_float_or_zero("bitcoin_change_pct")},
            "krw_usd": {"value": _safe_float("krw_usd_value"), "change": _safe_float_or_zero("krw_usd_change"), "change_pct": _safe_float_or_zero("krw_usd_change_pct")},
            "ewy": {"value": _safe_float("ewy_value"), "change_pct": _safe_float_or_zero("ewy_change_pct")},
        },
        "risk_indicators": {
            "us2y": {"value": _safe_float("us2y_value"), "change_bps": _safe_float_or_zero("us2y_change_bps")},
            "spread_2s10s": _safe_float("spread_2s10s"),
            "hy_spread": {"value": _safe_float("hy_spread_value"), "change_bps": _safe_float_or_zero("hy_spread_change_bps")},
            "move": {"value": _safe_float("move_value"), "change_pct": _safe_float_or_zero("move_change_pct")},
            "us30y": {"value": _safe_float("us30y_value"), "change_bps": _safe_float_or_zero("us30y_change_bps")},
        },
        "overall_score": _safe_float_or_zero("overall_score"),
        "safety_level": d.get("safety_level"),
        "prediction_direction": d.get("prediction_direction"),
        "interpretation": d.get("interpretation"),
        "chain_analysis": d.get("chain_analysis", ""),
        "llm_analysis": d.get("llm_analysis", ""),
        "llm_analysis_pm": d.get("llm_analysis_pm", ""),
        "collected_at_am": d["collected_at_am"].isoformat() if d.get("collected_at_am") else None,
        "collected_at_pm": d["collected_at_pm"].isoformat() if d.get("collected_at_pm") else None,
        "news_context": d.get("news_context", ""),
        "economic_calendar": d.get("economic_calendar"),
    }
