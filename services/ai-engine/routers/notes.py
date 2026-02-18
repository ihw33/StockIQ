from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
import asyncpg
import os

router = APIRouter()

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://localhost/stockiq"
)


async def get_conn():
    return await asyncpg.connect(DB_URL)


class TradeNoteCreate(BaseModel):
    symbol: Optional[str] = None
    stock_name: Optional[str] = None
    trade_date: Optional[date] = None
    trade_type: Optional[str] = "buy"       # buy | sell | watch
    price: Optional[float] = None
    quantity: Optional[int] = None
    portfolio_pct: Optional[float] = None
    buy_reason: Optional[str] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    add_buy_plan: Optional[str] = None
    market_context: Optional[str] = None
    review: Optional[str] = None
    psychology: Optional[str] = None
    result_summary: Optional[str] = None
    status: Optional[str] = "hold"          # hold | closed | watch
    profit_pct: Optional[float] = None
    watch_data: Optional[Dict[str, Any]] = None   # 관심 종목 구조화 데이터 (JSON)


class TradeNoteUpdate(BaseModel):
    symbol: Optional[str] = None
    stock_name: Optional[str] = None
    trade_date: Optional[date] = None
    trade_type: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    portfolio_pct: Optional[float] = None
    buy_reason: Optional[str] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    add_buy_plan: Optional[str] = None
    market_context: Optional[str] = None
    review: Optional[str] = None
    psychology: Optional[str] = None
    result_summary: Optional[str] = None
    status: Optional[str] = None
    profit_pct: Optional[float] = None
    watch_data: Optional[Dict[str, Any]] = None


def row_to_dict(row):
    """asyncpg Record → dict 변환"""
    if row is None:
        return None
    import json as _json
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, (date, datetime)):
            d[k] = v.isoformat()
        elif k == 'watch_data' and isinstance(v, str):
            try:
                d[k] = _json.loads(v)
            except Exception:
                pass
    return d


@router.get("/api/notes")
async def list_notes(symbol: Optional[str] = None, status: Optional[str] = None, limit: int = 50, offset: int = 0):
    """매매 노트 목록 조회"""
    conn = await get_conn()
    try:
        conditions = []
        params: list = []
        if symbol:
            params.append(symbol)
            conditions.append(f"symbol = ${len(params)}")
        if status:
            params.append(status)
            conditions.append(f"status = ${len(params)}")
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.extend([limit, offset])
        rows = await conn.fetch(
            f"SELECT * FROM trade_notes {where} ORDER BY created_at DESC LIMIT ${len(params)-1} OFFSET ${len(params)}",
            *params
        )
        return [row_to_dict(r) for r in rows]
    finally:
        await conn.close()


@router.get("/api/notes/{note_id}")
async def get_note(note_id: int):
    """매매 노트 상세 조회"""
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM trade_notes WHERE id = $1", note_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        return row_to_dict(row)
    finally:
        await conn.close()


@router.post("/api/notes", status_code=201)
async def create_note(note: TradeNoteCreate):
    """매매 노트 생성"""
    conn = await get_conn()
    try:
        import json as _json
        watch_data_str = _json.dumps(note.watch_data) if note.watch_data else None
        row = await conn.fetchrow("""
            INSERT INTO trade_notes (
                symbol, stock_name, trade_date, trade_type, price, quantity, portfolio_pct,
                buy_reason, target_price, stop_loss, add_buy_plan, market_context,
                review, psychology, result_summary, status, profit_pct, watch_data
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12,
                $13, $14, $15, $16, $17, $18::jsonb
            ) RETURNING *
        """,
            note.symbol, note.stock_name, note.trade_date, note.trade_type,
            note.price, note.quantity, note.portfolio_pct,
            note.buy_reason, note.target_price, note.stop_loss, note.add_buy_plan, note.market_context,
            note.review, note.psychology, note.result_summary, note.status, note.profit_pct, watch_data_str
        )
        return row_to_dict(row)
    finally:
        await conn.close()


@router.put("/api/notes/{note_id}")
async def update_note(note_id: int, note: TradeNoteUpdate):
    """매매 노트 수정"""
    conn = await get_conn()
    try:
        # 기존 row 확인
        existing = await conn.fetchrow("SELECT * FROM trade_notes WHERE id = $1", note_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Note not found")

        # 변경된 필드만 업데이트
        import json as _json
        data = note.model_dump(exclude_none=True)
        if not data:
            return row_to_dict(existing)

        set_clauses = []
        values = []
        for i, (k, v) in enumerate(data.items(), start=1):
            if k == 'watch_data' and isinstance(v, dict):
                set_clauses.append(f"{k} = ${i}::jsonb")
                values.append(_json.dumps(v))
            else:
                set_clauses.append(f"{k} = ${i}")
                values.append(v)

        set_clauses.append(f"updated_at = ${len(values)+1}")
        values.append(datetime.now())
        values.append(note_id)

        query = f"UPDATE trade_notes SET {', '.join(set_clauses)} WHERE id = ${len(values)} RETURNING *"
        row = await conn.fetchrow(query, *values)
        return row_to_dict(row)
    finally:
        await conn.close()


@router.delete("/api/notes/{note_id}")
async def delete_note(note_id: int):
    """매매 노트 삭제"""
    conn = await get_conn()
    try:
        result = await conn.execute("DELETE FROM trade_notes WHERE id = $1", note_id)
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Note not found")
        return {"success": True}
    finally:
        await conn.close()
