-- 종목 일일 동향 추적 테이블

CREATE TABLE IF NOT EXISTS stocks_daily_extremes (
    id SERIAL PRIMARY KEY,
    market_date DATE NOT NULL,
    fetched_at TIMESTAMP DEFAULT NOW(),
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    rank INT NOT NULL, -- 1-50
    direction VARCHAR(10) NOT NULL, -- 'up' | 'down'
    current_price INT,
    change_amount INT,
    change_pct DECIMAL(10, 2) NOT NULL,
    volume BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_daily_stock UNIQUE (market_date, stock_code, direction)
);

CREATE INDEX idx_stocks_date ON stocks_daily_extremes(market_date DESC);
CREATE INDEX idx_stocks_code ON stocks_daily_extremes(stock_code);
CREATE INDEX idx_stocks_direction ON stocks_daily_extremes(direction);

COMMENT ON TABLE stocks_daily_extremes IS '종목 동향 추적 - 매일 상승/하락 Top 50';
COMMENT ON COLUMN stocks_daily_extremes.market_date IS '시장 데이터 기준일';
COMMENT ON COLUMN stocks_daily_extremes.fetched_at IS '실제 크롤링 시간';
COMMENT ON COLUMN stocks_daily_extremes.rank IS '해당 방향에서의 순위 (1-50)';
