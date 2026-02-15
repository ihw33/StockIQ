-- 섹터 일일 동향 추적 테이블

CREATE TABLE IF NOT EXISTS sector_daily_extremes (
    id SERIAL PRIMARY KEY,
    market_date DATE NOT NULL,
    fetched_at TIMESTAMP DEFAULT NOW(),
    sector_type VARCHAR(20) NOT NULL, -- 'industry' | 'theme'
    sector_name VARCHAR(100) NOT NULL,
    rank INT NOT NULL, -- 1-10
    direction VARCHAR(10) NOT NULL, -- 'up' | 'down'
    change_pct DECIMAL(10, 2) NOT NULL,
    volume TEXT,
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_daily_sector UNIQUE (market_date, sector_type, sector_name, direction)
);

CREATE INDEX idx_sector_date ON sector_daily_extremes(market_date DESC);
CREATE INDEX idx_sector_type ON sector_daily_extremes(sector_type);
CREATE INDEX idx_sector_name ON sector_daily_extremes(sector_name);

COMMENT ON TABLE sector_daily_extremes IS '섹터 로테이션 추적 - 매일 상승/하락 Top 10';
COMMENT ON COLUMN sector_daily_extremes.market_date IS '시장 데이터 기준일';
COMMENT ON COLUMN sector_daily_extremes.fetched_at IS '실제 크롤링 시간';
COMMENT ON COLUMN sector_daily_extremes.rank IS '해당 방향에서의 순위 (1-10)';
