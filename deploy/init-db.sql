-- StockIQ Database Schema
-- Auto-generated from local dev DB

CREATE TABLE IF NOT EXISTS analysis_history (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    analyzed_at TIMESTAMP NOT NULL,
    timeframe VARCHAR(30),
    analysis_type VARCHAR(30),
    content JSONB NOT NULL,
    current_price NUMERIC(12,2),
    target_price NUMERIC(12,2),
    stop_loss NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_financials (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    per NUMERIC(10,2),
    pbr NUMERIC(10,2),
    roe NUMERIC(10,2),
    eps NUMERIC(10,2),
    bps NUMERIC(10,2),
    market_cap BIGINT,
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(symbol, date)
);

CREATE TABLE IF NOT EXISTS macro_daily (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    dxy_value NUMERIC(8,3),
    dxy_change_pct NUMERIC(6,3),
    dxy_score INTEGER CHECK (dxy_score >= -2 AND dxy_score <= 2),
    us10y_value NUMERIC(6,3),
    us10y_change_bps NUMERIC(8,3),
    us10y_score INTEGER CHECK (us10y_score >= -2 AND us10y_score <= 2),
    vix_value NUMERIC(6,2),
    vix_change_pct NUMERIC(6,3),
    vix_score INTEGER CHECK (vix_score >= -2 AND vix_score <= 2),
    foreign_net_amount BIGINT,
    foreign_score INTEGER CHECK (foreign_score >= -2 AND foreign_score <= 2),
    futures_net BIGINT,
    futures_score INTEGER CHECK (futures_score >= -2 AND futures_score <= 2),
    short_volume BIGINT,
    short_change_pct NUMERIC(6,3),
    short_score INTEGER CHECK (short_score >= -2 AND short_score <= 2),
    overall_score NUMERIC(4,2),
    safety_level INTEGER CHECK (safety_level >= 1 AND safety_level <= 3),
    interpretation TEXT,
    prediction_direction VARCHAR(10),
    actual_kospi_change NUMERIC(6,3),
    actual_foreign_net BIGINT,
    indicator_accuracy JSONB,
    adjusted_weights JSONB,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    us_market_date DATE,
    us_market_day VARCHAR(4),
    kr_market_day VARCHAR(4),
    nasdaq_value NUMERIC(12,2),
    nasdaq_change_pct NUMERIC(8,3),
    sp500_value NUMERIC(10,2),
    sp500_change_pct NUMERIC(8,3),
    oil_value NUMERIC(8,2),
    oil_change_pct NUMERIC(8,3),
    gold_value NUMERIC(10,2),
    gold_change_pct NUMERIC(8,3),
    bitcoin_value NUMERIC(14,2),
    bitcoin_change_pct NUMERIC(8,3),
    krw_usd_value NUMERIC(10,2),
    krw_usd_change NUMERIC(8,2),
    krw_usd_change_pct NUMERIC(8,3),
    chain_analysis TEXT,
    llm_analysis TEXT,
    news_context TEXT,
    economic_calendar JSONB,
    llm_analysis_pm TEXT,
    collected_at_pm TIMESTAMPTZ,
    us2y_value NUMERIC(6,3),
    us2y_change_bps NUMERIC(8,3),
    spread_2s10s NUMERIC(8,3),
    us30y_value NUMERIC(6,3),
    us30y_change_bps NUMERIC(8,3),
    hy_spread_value NUMERIC(8,3),
    hy_spread_change_bps NUMERIC(8,3),
    move_value NUMERIC(8,2),
    move_change_pct NUMERIC(8,3),
    ewy_value NUMERIC(10,2),
    ewy_change_pct NUMERIC(8,3),
    collected_at_am TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS screener_cache (
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    market VARCHAR(50),
    classification_type VARCHAR(20) NOT NULL,
    classification_name VARCHAR(100) NOT NULL,
    sector VARCHAR(200),
    industry VARCHAR(200),
    market_cap BIGINT,
    per REAL,
    pbr REAL,
    roe REAL,
    eps REAL,
    bps REAL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revenue BIGINT DEFAULT 0,
    operating_profit BIGINT DEFAULT 0,
    operating_profit_growth NUMERIC(10,2) DEFAULT 0,
    fiscal_period VARCHAR(20) DEFAULT '',
    PRIMARY KEY (symbol, classification_type, classification_name)
);

CREATE TABLE IF NOT EXISTS sector_daily_extremes (
    id SERIAL PRIMARY KEY,
    market_date DATE NOT NULL,
    fetched_at TIMESTAMP DEFAULT now(),
    sector_type VARCHAR(20) NOT NULL,
    sector_name VARCHAR(100) NOT NULL,
    rank INTEGER NOT NULL,
    direction VARCHAR(10) NOT NULL,
    change_pct NUMERIC(10,2) NOT NULL,
    volume TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(market_date, sector_type, sector_name, direction)
);

CREATE TABLE IF NOT EXISTS stocks_daily_extremes (
    id SERIAL PRIMARY KEY,
    market_date DATE NOT NULL,
    fetched_at TIMESTAMP DEFAULT now(),
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    rank INTEGER NOT NULL,
    direction VARCHAR(10) NOT NULL,
    current_price INTEGER,
    change_amount INTEGER,
    change_pct NUMERIC(10,2) NOT NULL,
    volume BIGINT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(market_date, stock_code, direction)
);

CREATE TABLE IF NOT EXISTS trade_notes (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10),
    stock_name VARCHAR(50),
    trade_date DATE,
    trade_type VARCHAR(10),
    price NUMERIC(12,2),
    quantity INTEGER,
    portfolio_pct NUMERIC(5,2),
    buy_reason TEXT,
    target_price NUMERIC(12,2),
    stop_loss NUMERIC(12,2),
    add_buy_plan TEXT,
    market_context TEXT,
    review TEXT,
    psychology TEXT,
    result_summary VARCHAR(200),
    status VARCHAR(10) DEFAULT 'hold',
    profit_pct NUMERIC(8,4),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    watch_data JSONB
);

CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    trade_type VARCHAR(10),
    action VARCHAR(10),
    quantity INTEGER,
    price NUMERIC(12,2),
    executed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50),
    is_holding BOOLEAN DEFAULT false,
    added_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_symbol ON analysis_history(symbol);
CREATE INDEX IF NOT EXISTS idx_analysis_date ON analysis_history(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_symbol_date ON analysis_history(symbol, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_financials_symbol ON company_financials(symbol);
CREATE INDEX IF NOT EXISTS idx_financials_date ON company_financials(date DESC);
CREATE INDEX IF NOT EXISTS idx_macro_date ON macro_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_screener_classification ON screener_cache(classification_type, classification_name);
CREATE INDEX IF NOT EXISTS idx_screener_updated ON screener_cache(updated_at);
CREATE INDEX IF NOT EXISTS idx_sector_date ON sector_daily_extremes(market_date DESC);
CREATE INDEX IF NOT EXISTS idx_sector_name ON sector_daily_extremes(sector_name);
CREATE INDEX IF NOT EXISTS idx_sector_type ON sector_daily_extremes(sector_type);
CREATE INDEX IF NOT EXISTS idx_stocks_date ON stocks_daily_extremes(market_date DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_code ON stocks_daily_extremes(stock_code);
CREATE INDEX IF NOT EXISTS idx_stocks_direction ON stocks_daily_extremes(direction);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(executed_at DESC);
