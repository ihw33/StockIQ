-- 005_macro_krw.sql
-- 원/달러 환율 컬럼 추가
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS krw_usd_value DECIMAL(10,2);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS krw_usd_change DECIMAL(8,2);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS krw_usd_change_pct DECIMAL(8,3);
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS chain_analysis TEXT;
