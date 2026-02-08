"""
Database connection and models for analysis storage
"""
import os
import asyncpg
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

class AnalysisDB:
    def __init__(self):
        self.pool = None
        self.db_url = os.getenv("DATABASE_URL")
        
    async def connect(self):
        """Create connection pool"""
        if not self.pool:
            self.pool = await asyncpg.create_pool(self.db_url)
            print("[AnalysisDB] Connected to PostgreSQL")
    
    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            print("[AnalysisDB] Closed PostgreSQL connection")
    
    async def save_analysis(
        self,
        symbol: str,
        timeframe: str,
        analysis_type: str,
        content: Dict[Any, Any],
        current_price: Optional[float] = None,
        target_price: Optional[float] = None,
        stop_loss: Optional[float] = None
    ) -> int:
        """Save analysis result to database.
        같은 종목 + 같은 타입 + 같은 날짜 → 덮어쓰기 (하루 1건만 유지)
        """
        await self.connect()

        now = datetime.now()
        content_json = json.dumps(content, ensure_ascii=False)

        async with self.pool.acquire() as conn:
            # 같은 날 같은 종목+타입 기존 레코드 삭제
            await conn.execute(
                """DELETE FROM analysis_history
                   WHERE symbol = $1
                     AND analysis_type = $2
                     AND analyzed_at::date = $3::date""",
                symbol, analysis_type, now,
            )

            row = await conn.fetchrow(
                """INSERT INTO analysis_history
                   (symbol, analyzed_at, timeframe, analysis_type, content,
                    current_price, target_price, stop_loss)
                   VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
                   RETURNING id""",
                symbol, now, timeframe, analysis_type, content_json,
                current_price, target_price, stop_loss,
            )
            return row['id']
    
    async def get_history(
        self,
        symbol: Optional[str] = None,
        days: int = 7,
        limit: int = 50
    ) -> List[Dict]:
        """Get analysis history"""
        await self.connect()
        
        if symbol:
            query = """
            SELECT id, symbol, analyzed_at, timeframe, analysis_type,
                   content, current_price, target_price, stop_loss
            FROM analysis_history
            WHERE symbol = $1
            AND analyzed_at >= NOW() - INTERVAL '{} days'
            ORDER BY analyzed_at DESC
            LIMIT $2
            """.format(days)
            
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, symbol, limit)
        else:
            query = """
            SELECT id, symbol, analyzed_at, timeframe, analysis_type,
                   content, current_price, target_price, stop_loss
            FROM analysis_history
            WHERE analyzed_at >= NOW() - INTERVAL '{} days'
            ORDER BY analyzed_at DESC
            LIMIT $1
            """.format(days)
            
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, limit)
        
        # Convert to dict list
        result = []
        for row in rows:
            result.append({
                'id': row['id'],
                'symbol': row['symbol'],
                'analyzed_at': row['analyzed_at'].isoformat(),
                'timeframe': row['timeframe'],
                'analysis_type': row['analysis_type'],
                'content': row['content'],
                'current_price': float(row['current_price']) if row['current_price'] else None,
                'target_price': float(row['target_price']) if row['target_price'] else None,
                'stop_loss': float(row['stop_loss']) if row['stop_loss'] else None
            })
        
        return result

# Global instance
analysis_db = AnalysisDB()
