-- 003_macro_daily.sql
-- 매크로 대시보드: 6축 2-Tier 외국인 스탠스 + 자기보정

CREATE TABLE IF NOT EXISTS macro_daily (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,

    -- Tier A: 글로벌 센티먼트 (선행)
    dxy_value DECIMAL(8,3),
    dxy_change_pct DECIMAL(6,3),
    dxy_score INTEGER CHECK (dxy_score BETWEEN -2 AND 2),

    us10y_value DECIMAL(6,3),
    us10y_change_bps DECIMAL(8,3),
    us10y_score INTEGER CHECK (us10y_score BETWEEN -2 AND 2),

    vix_value DECIMAL(6,2),
    vix_change_pct DECIMAL(6,3),
    vix_score INTEGER CHECK (vix_score BETWEEN -2 AND 2),

    -- Tier B: 실제 수급 (동행)
    foreign_net_amount BIGINT,
    foreign_score INTEGER CHECK (foreign_score BETWEEN -2 AND 2),

    futures_net BIGINT,
    futures_score INTEGER CHECK (futures_score BETWEEN -2 AND 2),

    short_volume BIGINT,
    short_change_pct DECIMAL(6,3),
    short_score INTEGER CHECK (short_score BETWEEN -2 AND 2),

    -- 종합
    overall_score DECIMAL(4,2),
    safety_level INTEGER CHECK (safety_level BETWEEN 1 AND 3),
    interpretation TEXT,
    prediction_direction VARCHAR(10),

    -- 자기보정 (T+1에 채움)
    actual_kospi_change DECIMAL(6,3),
    actual_foreign_net BIGINT,
    indicator_accuracy JSONB,
    adjusted_weights JSONB,

    -- 메타
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_macro_date ON macro_daily(date DESC);
