-- 008: AM/PM 듀얼 브리핑 지원
-- llm_analysis (기존) = AM 예측 브리핑
-- llm_analysis_pm (신규) = PM 결산 브리핑

ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS llm_analysis_pm TEXT;
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS collected_at_pm TIMESTAMP;
