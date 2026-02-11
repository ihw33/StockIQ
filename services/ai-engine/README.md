# AI Engine (백엔드)

FastAPI 기반 분석 엔진 - 포트 8001

## 핵심 파일

### main.py (1,701줄 - 28개 엔드포인트)
**모든 API 라우트가 여기 있음**

주요 엔드포인트:
- `/api/strategy/morning-briefing` - 아침 브리핑
- `/api/strategy/chart-analysis` - 차트 분석 (algo/llm/company)
- `/api/strategy/algo-analysis-start` - 알고리즘 분석 (백그라운드)
- `/api/strategy/deep-analysis-start` - 종합 분석 (백그라운드)
- `/api/strategy/company-analysis-start` - 기업 분석 (백그라운드)
- `/api/strategy/reports/pending` - 대기 중인 보고서 조회

### database.py
**DB 연결 및 보고서 저장**

주요 함수:
- `save_analysis()` - 분석 결과 DB 저장 (매번 새 레코드 생성)
- `get_history()` - 분석 히스토리 조회

⚠️ **중요**:
- DELETE 로직 제거됨 (하루 1건 제한 없음)
- 매번 새로운 보고서 생성

### strategies/chart_analyst.py (655줄)
**AI 분석 로직**

`analyze(symbol, mode, query, position_info)`:
- `mode="algo"` - 알고리즘 분석
- `mode="llm"` - 종합 LLM 분석
- `mode="company"` - 기업 펀더멘탈 분석

### collectors/
- `kiwoom.py` - 키움 REST API 연동
- `dart_collector.py` - DART 공시 수집
- `llm_analyzer.py` - LLM 브리핑 생성
- `macro_dashboard.py` - 매크로 데이터 수집

## 분석 흐름

1. 프론트엔드 → `/api/strategy/algo-analysis-start` POST
2. `main.py` → `background_tasks.add_task(_run_algo_analysis_bg)`
3. `_run_algo_analysis_bg()` → `ChartAnalyst.analyze()`
4. 결과 → `database.save_analysis()`
5. 프론트엔드 폴링 → `/api/strategy/reports/pending`

## 주의사항

- 백그라운드 분석은 즉시 완료되지 않음 (10-30초 소요)
- DB 저장 시 매번 새 레코드 생성 (중복 제한 없음)
- 스케줄러: 매일 07:00, 18:00 KST 자동 실행
