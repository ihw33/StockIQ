"""
Run database migrations
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv
from pathlib import Path

# Load from project root .env.local
env_path = Path(__file__).parent.parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)
print(f"Loading env from: {env_path}")
print(f"DATABASE_URL: {os.getenv('DATABASE_URL')}")

async def run_migration():
    db_url = os.getenv("DATABASE_URL")
    
    migration_sql = """
    -- Analysis History Table
    CREATE TABLE IF NOT EXISTS analysis_history (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        analyzed_at TIMESTAMP NOT NULL,
        timeframe VARCHAR(10),
        analysis_type VARCHAR(10),
        content JSONB NOT NULL,
        current_price DECIMAL(12,2),
        target_price DECIMAL(12,2),
        stop_loss DECIMAL(12,2),
        created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_symbol ON analysis_history(symbol);
    CREATE INDEX IF NOT EXISTS idx_analysis_date ON analysis_history(analyzed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analysis_symbol_date ON analysis_history(symbol, analyzed_at DESC);

    CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL UNIQUE,
        name VARCHAR(50),
        is_holding BOOLEAN DEFAULT FALSE,
        added_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        trade_type VARCHAR(10),
        action VARCHAR(10),
        quantity INTEGER,
        price DECIMAL(12,2),
        executed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(executed_at DESC);
    """
    
    conn = await asyncpg.connect(db_url)
    try:
        await conn.execute(migration_sql)
        print("✅ Migration completed successfully!")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
