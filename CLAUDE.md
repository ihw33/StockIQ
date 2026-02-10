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
- **마지막 커밋**: `b337c34` — DART 공시 + LLM 프롬프트 개선
- **열린 이슈**: #2(파이낸스캘린더), #3(Perplexity키), #4(NAS배포), #5(DART연동)
- **다음 작업**: 이슈 #2 파이낸스 캘린더

## 주의사항
- 백엔드 포트 **8001** (8000 아님)
- `.env.local`에 API 키 — 절대 커밋 금지
- `npm run build` 후 dev 서버 재시작 필수
- `amt_qty_tp`: 1=금액(백만원), 2=수량(천주)
