-- 004_macro_global_markets.sql
-- 글로벌 시장 지표 + 날짜 매핑 추가

ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS us_market_date DATE;
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS us_market_day VARCHAR(4);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS kr_market_day VARCHAR(4);

-- 글로벌 시장 지표
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS nasdaq_value DECIMAL(12,2);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS nasdaq_change_pct DECIMAL(8,3);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS sp500_value DECIMAL(10,2);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS sp500_change_pct DECIMAL(8,3);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS oil_value DECIMAL(8,2);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS oil_change_pct DECIMAL(8,3);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS gold_value DECIMAL(10,2);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS gold_change_pct DECIMAL(8,3);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS bitcoin_value DECIMAL(14,2);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS bitcoin_change_pct DECIMAL(8,3);
