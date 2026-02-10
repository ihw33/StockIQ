# StockIQ

## 프로젝트 개요
개인 투자자용 매크로 분석 + AI 브리핑 대시보드
- GitHub: `ihw33/StockIQ`

## 아키텍처
- **프론트엔드**: Next.js 14 (localhost:3000), Tailwind, Recharts
- **백엔드**: FastAPI Python (localhost:8001), asyncpg
- **DB**: PostgreSQL `stockiq`
- **스케줄러**: AM 07:00 + PM 18:00 KST (dev 서버)

## 핵심 파일
| 파일 | 역할 |
|------|------|
| `services/ai-engine/main.py` | FastAPI 메인, 스케줄러, 매크로 API |
| `services/ai-engine/collectors/dart_collector.py` | DART 공시 수집 |
| `services/ai-engine/collectors/llm_analyzer.py` | LLM 팀 브리핑 (OpenRouter) |
| `services/ai-engine/collectors/news_collector.py` | Perplexity 뉴스 |
| `services/ai-engine/collectors/kiwoom.py` | 키움 REST API |
| `components/features/macro/macro-dashboard.tsx` | 매크로 대시보드 |
| `components/features/war-room/ai-control-panel.tsx` | 워룸 (투자자 매매동향) |

## 현재 상태
- **브랜치**: `feature/issue-2-finance-calendar`
- **마지막 커밋**: `c67d4ea` — 보고서 중복 생성 문제 해결
- **열린 이슈**: #2(파이낸스캘린더), #7(리팩토링)
- **완료 이슈**: #1(War Room 보고서 개별 표시)

## Claude 작업 방식 (중요!)

### 문제 해결 시
1. **추측 금지** - 로그/에러 메시지 먼저 확인
2. **범위 좁히기** - 프론트엔드/백엔드/DB 중 어디?
3. **최소 변경** - 단 하나의 파일만 수정
4. **검증 후 진행** - 안 되면 즉시 되돌리고 재진단

### 새 기능 개발 시
1. **관련 파일 먼저 읽기** - 기존 패턴 파악
2. **불확실하면 질문** - 추측으로 구현하지 말기
3. **한 번에 하나씩** - 여러 파일 동시 수정 금지
4. **최소한의 변경** - 꼭 필요한 것만

### 수정 전 체크리스트
- [ ] 관련 파일을 모두 읽었는가?
- [ ] 문제 원인을 정확히 파악했는가?
- [ ] 최소한의 변경인가?
- [ ] 다른 부분에 영향 없는가?

### 자주 하는 실수 (하지 말 것!)
- ❌ 문제 없는 코드를 "개선"하려고 수정
- ❌ API 엔드포인트 구조를 추측으로 판단
- ❌ 여러 파일을 동시에 수정
- ❌ 에러 로그 확인 전에 코드 수정

## 주의사항
- 백엔드 포트 **8001** (8000 아님)
- `.env.local`에 API 키 — 절대 커밋 금지
- `npm run build` 후 dev 서버 재시작 필수
- `amt_qty_tp`: 1=금액(백만원), 2=수량(천주)
