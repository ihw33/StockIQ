from fastapi import APIRouter, HTTPException
import os
import logging

from collectors.kiwoom import KiwoomCollector

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/portfolio/holdings")
async def get_portfolio_holdings():
    """키움 API에서 실제 보유종목 조회"""
    account_no = os.getenv("KIWOOM_ACCOUNT")
    if not account_no:
        raise HTTPException(status_code=400, detail="KIWOOM_ACCOUNT not configured")
    try:
        kiwoom = KiwoomCollector()
        raw = kiwoom.get_holdings(account_no)
        holdings = []
        for h in raw:
            symbol = h.get("stk_cd", "").replace("A", "")
            if not symbol:
                continue
            avg_price = abs(float(h.get("avg_prc", 0)))
            quantity = abs(int(h.get("rmnd_qty", 0)))
            current_price = abs(float(h.get("cur_prc", 0)))

            # NEXT(시간외) 가격 반영
            try:
                nxt = kiwoom.get_next_market_price(symbol)
                if nxt and nxt.get("cur_price") and nxt["cur_price"] > 0:
                    current_price = float(nxt["cur_price"])
            except Exception:
                pass

            eval_amount = current_price * quantity
            profit_amount = (current_price - avg_price) * quantity
            profit_rate = ((current_price - avg_price) / avg_price * 100) if avg_price > 0 else 0.0
            holdings.append({
                "symbol": symbol,
                "symbolName": h.get("stk_nm", symbol).strip(),
                "avgPrice": avg_price,
                "quantity": quantity,
                "currentPrice": current_price,
                "totalValue": eval_amount,
                "profitAmount": profit_amount,
                "profitRate": round(profit_rate, 2),
            })
        logger.info(f"[Portfolio] 키움 보유종목 {len(holdings)}개: {[h['symbolName'] for h in holdings]}")
        return {"status": "success", "holdings": holdings}
    except Exception as e:
        logger.error(f"[Portfolio] 키움 보유종목 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))
