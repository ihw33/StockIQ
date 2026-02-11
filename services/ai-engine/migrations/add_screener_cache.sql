-- 스크리너 캐시 테이블
CREATE TABLE IF NOT EXISTS screener_cache (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100),
    market VARCHAR(50),
    classification_type VARCHAR(20),  -- 'theme' or 'industry'
    classification_name VARCHAR(100),
    sector VARCHAR(200),
    industry VARCHAR(200),
    market_cap BIGINT,
    per REAL,
    pbr REAL,
    roe REAL,
    eps REAL,
    bps REAL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_screener_classification
ON screener_cache(classification_type, classification_name);

CREATE INDEX IF NOT EXISTS idx_screener_updated
ON screener_cache(updated_at);
