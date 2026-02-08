-- 006_llm_analysis.sql
-- LLM 팀 브리핑 + 뉴스 저장 컬럼
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS llm_analysis TEXT;
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS news_context TEXT;
