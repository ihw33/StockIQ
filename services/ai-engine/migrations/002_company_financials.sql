-- Add company financials table

CREATE TABLE IF NOT EXISTS company_financials (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Valuation metrics
    per DECIMAL(10,2),
    pbr DECIMAL(10,2),
    roe DECIMAL(10,2),
    eps DECIMAL(10,2),
    bps DECIMAL(10,2),
    
    -- Size
    market_cap BIGINT,
    
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_financials_symbol ON company_financials(symbol);
CREATE INDEX IF NOT EXISTS idx_financials_date ON company_financials(date DESC);
