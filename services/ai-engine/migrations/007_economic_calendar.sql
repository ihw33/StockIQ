-- 007_economic_calendar.sql
-- 경제지표 캘린더 데이터 저장 컬럼
ALTER TABLE macro_daily ADD COLUMN IF NOT EXISTS economic_calendar JSONB;
