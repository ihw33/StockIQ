-- Analysis History Table
CREATE TABLE IF NOT EXISTS analysis_history (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    analyzed_at TIMESTAMP NOT NULL,
    timeframe VARCHAR(10),  -- 'W', 'D', '15m', '5m'
    analysis_type VARCHAR(10), -- 'algo', 'llm', 'hybrid'
    
    -- Analysis results (full JSON)
    content JSONB NOT NULL,
    
    -- Quick access fields
    current_price DECIMAL(12,2),
    target_price DECIMAL(12,2),
    stop_loss DECIMAL(12,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_symbol ON analysis_history(symbol);
CREATE INDEX IF NOT EXISTS idx_analysis_date ON analysis_history(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_symbol_date ON analysis_history(symbol, analyzed_at DESC);

-- Watchlist table (for later phases)
CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50),
    is_holding BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT NOW()
);

-- Trades table (for later phases)
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    trade_type VARCHAR(10), -- 'REAL', 'PAPER'
    action VARCHAR(10), -- 'BUY', 'SELL'
    quantity INTEGER,
    price DECIMAL(12,2),
    executed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(executed_at DESC);
