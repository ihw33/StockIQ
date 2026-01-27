# 🎭 StockIQ AI Orchestra 이슈 정리 & 작업 계획

## 📅 현재 상황 (2025년 9월 1일)
- **총 열린 이슈**: 26개
- **AI Orchestra 구성**: 완료 ✅
- **페르소나**: 30명 배치 완료
- **프로젝트 단계**: Sprint 1 Foundation

## 🎯 이슈 재분류 & AI 협업 방식

### 🔴 Phase 1: Foundation Setup (P0-Critical)
**목표**: 기본 프로젝트 구조 완성
**협업 방식**: 각 이슈마다 여러 AI가 단계별로 협업
**기간**: 1-2주

#### 이슈 #1: Setup Next.js project with TypeScript
```yaml
작업 분해:
  Step 1 (Claude): 프로젝트 구조 설계 & package.json 설정
  Step 2 (Cursor): app/ 폴더 구조 생성 & 기본 페이지들
  Step 3 (Codex): API routes 구조 & middleware 설정
  Step 4 (Gemini): 문서화 & 가이드 작성
  Step 5 (자동화): @ai-orchestra code-review → PR 생성 → Claude 리뷰 → 자동 머지
라벨: Phase-1, frontend, backend
상태: 🔄 진행중
```

#### 이슈 #2: Configure ESLint, Prettier, and Husky
```yaml
작업 분해:
  Step 1 (Codex): ESLint 설정 파일 구성
  Step 2 (Cursor): Prettier 규칙 & VS Code 설정
  Step 3 (Claude): Husky pre-commit hooks 설정
  Step 4 (Gemini): 코딩 컨벤션 문서화
라벨: Phase-1, devops
상태: ⏳ 대기
```

#### 이슈 #3: Setup Supabase project and authentication
```yaml
작업 분해:
  Step 1 (Claude): Supabase 프로젝트 생성 & 설정
  Step 2 (Codex): 인증 API routes 구현
  Step 3 (Cursor): 로그인/회원가입 UI 구현
  Step 4 (Gemini): 인증 플로우 문서화
라벨: Phase-1, backend, database
상태: ⏳ 대기
```

#### 이슈 #4: Design database schema
```yaml
작업 분해:
  Step 1 (Claude): ERD 설계 & 테이블 구조 정의
  Step 2 (Codex): Supabase 마이그레이션 스크립트
  Step 3 (Cursor): 타입스크립트 타입 정의
  Step 4 (Gemini): DB 스키마 문서화
라벨: Phase-1, database
상태: ⏳ 대기
```

#### 이슈 #5: Implement authentication pages
```yaml
작업 분해:
  Step 1 (Cursor): 로그인/회원가입 페이지 UI
  Step 2 (Claude): 인증 상태 관리 로직
  Step 3 (Codex): 폼 유효성 검사 & 에러 핸들링
  Step 4 (Gemini): UX 가이드라인 작성
라벨: Phase-1, frontend, ui-ux
상태: ⏳ 대기
```

#### 이슈 #6: Create base layout components
```yaml
작업 분해:
  Step 1 (Cursor): Header, Sidebar, Footer 컴포넌트
  Step 2 (Claude): 반응형 레이아웃 로직
  Step 3 (Codex): 네비게이션 상태 관리
  Step 4 (Gemini): 컴포넌트 사용법 문서화
라벨: Phase-1, frontend, ui-ux
상태: ⏳ 대기
```

#### 이슈 #7: Setup shadcn/ui component library
```yaml
작업 분해:
  Step 1 (Cursor): shadcn/ui 설치 & 설정
  Step 2 (Claude): 커스텀 테마 & 스타일 정의
  Step 3 (Codex): 컴포넌트 최적화 & 번들링
  Step 4 (Gemini): 디자인 시스템 문서화
라벨: Phase-1, frontend, ui-ux
상태: ⏳ 대기
```

### 🟡 Phase 2: Core Backend (P0-Critical)
**목표**: 데이터 수집 및 API 구축
**협업 방식**: 백엔드 중심의 다중 AI 협업
**기간**: 2-3주

#### 이슈 #8: Design Provider Interface pattern
```yaml
작업 분해:
  Step 1 (Codex): Provider 패턴 인터페이스 설계
  Step 2 (Claude): 확장성 고려한 아키텍처 검토
  Step 3 (Cursor): 타입스크립트 타입 정의
  Step 4 (Gemini): 패턴 사용법 문서화
라벨: Phase-2, backend
상태: ⏳ 대기
```

#### 이슈 #9: Integrate Korea Investment Securities API
```yaml
작업 분해:
  Step 1 (Claude): API 키 관리 & 환경 설정
  Step 2 (Codex): API 클라이언트 & 래퍼 구현
  Step 3 (Cursor): 실시간 데이터 UI 컴포넌트
  Step 4 (Gemini): API 사용 가이드 작성
라벨: Phase-2, backend, frontend
상태: ⏳ 대기
```

#### 이슈 #10: Setup news collection system
```yaml
작업 분해:
  Step 1 (Codex): 뉴스 크롤링 스크립트 구현
  Step 2 (Claude): 스케줄러 & 큐 시스템 설계
  Step 3 (Cursor): 뉴스 표시 UI 컴포넌트
  Step 4 (Gemini): 수집 정책 & 가이드라인
라벨: Phase-2, backend, frontend
상태: ⏳ 대기
```

#### 이슈 #11: Configure Bull Queue with Redis
```yaml
작업 분해:
  Step 1 (Codex): Redis 연결 & Bull 큐 설정
  Step 2 (Claude): 작업 스케줄링 로직
  Step 3 (Cursor): 큐 모니터링 대시보드
  Step 4 (Gemini): 큐 관리 문서화
라벨: Phase-2, backend, devops
상태: ⏳ 대기
```

#### 이슈 #20: Implement alert system
```yaml
작업 분해:
  Step 1 (Claude): 알림 조건 설정 로직
  Step 2 (Codex): 이메일/푸시 발송 시스템
  Step 3 (Cursor): 알림 설정 UI
  Step 4 (Gemini): 알림 정책 문서화
라벨: Phase-2, backend, frontend
상태: ⏳ 대기
```

### 🟢 Phase 3: Frontend Core (P0-Critical)
**목표**: 핵심 사용자 인터페이스
**리더**: Cursor (Frontend)
**기간**: 2-3주

| 이슈 | 제목 | 담당 AI | 상태 | 우선순위 |
|------|------|---------|------|----------|
| #12 | Build dashboard page | Frontend_Lead | ⏳ 대기 | P0 |
| #13 | Implement stock detail page | Frontend_Lead | ⏳ 대기 | P0 |
| #18 | Build smart note editor | UI_UX_Designer | ⏳ 대기 | P0 |
| #19 | Integrate TradingView charts | Frontend_Lead | ⏳ 대기 | P0 |
| #22 | Mobile optimization | Frontend_Lead | ⏳ 대기 | P0 |

### 🔵 Phase 4: AI Integration (P0-Critical)
**목표**: AI 기능 통합
**리더**: Gemini (AI/ML)
**기간**: 2-3주

| 이슈 | 제목 | 담당 AI | 상태 | 우선순위 |
|------|------|---------|------|----------|
| #14 | Integrate Claude API | ML_Engineer_1 | ⏳ 대기 | P0 |
| #15 | Build news summarization engine | ML_Engineer_2 | ⏳ 대기 | P0 |
| #16 | Create prompt template system | Gemini | ⏳ 대기 | P0 |
| #17 | Implement AI cost management | ML_Engineer_1 | ⏳ 대기 | P0 |

### 🟣 Phase 5: Enhancement (P1-High)
**목표**: 품질 및 성능 개선
**리더**: 각 팀 리드
**기간**: 1-2주

| 이슈 | 제목 | 담당 AI | 상태 | 우선순위 |
|------|------|---------|------|----------|
| #21 | Add export functionality | Frontend_Lead | ⏳ 대기 | P1 |
| #23 | Performance optimization | DevOps_Engineer | ⏳ 대기 | P1 |
| #24 | Write tests | QA_Lead | ⏳ 대기 | P1 |

### 📚 Phase 6: Documentation (P1-High)
**목표**: 프로젝트 문서화
**리더**: Gemini (Documentation)
**기간**: 1주

| 이슈 | 제목 | 담당 AI | 상태 | 우선순위 |
|------|------|---------|------|----------|
| #25 | Create API documentation | Technical_Writer | ⏳ 대기 | P0 |
| #26 | Write user guide | Technical_Writer | ⏳ 대기 | P1 |

## 🎭 AI 팀별 역할 상세

### 👑 경영진 (리더십)
```yaml
Claude (CEO/PM):
  - 전체 프로젝트 관리
  - 이슈 우선순위 결정
  - 팀 간 조율
  - Issues: #1, #3, #4

Gemini (CTO):
  - 기술 아키텍처 결정
  - AI/ML 전략 수립
  - Issues: #14, #15, #16, #17

Codex (CPO):
  - 제품 기능 정의
  - 백엔드 아키텍처
  - Issues: #8, #11

Cursor (COO):
  - 프론트엔드 총괄
  - UX/UI 전략
  - Issues: #5, #6, #7, #12, #13

ChatGPT (CFO):
  - 데이터 분석
  - 성능 모니터링
  - Issues: #17, #23
```

### 🛠️ 개발팀 (실행)
```yaml
Backend_Lead:
  - API 개발
  - 데이터베이스 관리
  - Issues: #9, #20

Frontend_Lead:
  - React 컴포넌트 개발
  - 상태 관리
  - Issues: #12, #13, #19, #21, #22

Data_Engineer_1:
  - 뉴스 수집 시스템
  - 데이터 파이프라인
  - Issues: #10

ML_Engineer_1:
  - Claude API 통합
  - AI 비용 관리
  - Issues: #14, #17

ML_Engineer_2:
  - 뉴스 요약 엔진
  - 자연어 처리
  - Issues: #15

DevOps_Engineer:
  - 인프라 구성
  - 성능 최적화
  - Issues: #11, #23

UI_UX_Designer:
  - 사용자 인터페이스
  - 사용자 경험
  - Issues: #18

QA_Lead:
  - 테스트 작성
  - 품질 관리
  - Issues: #24

Technical_Writer:
  - 문서 작성
  - API 문서화
  - Issues: #25, #26
```

## 🗓️ 주간 스프린트 계획

### Week 1: Foundation (9/1 - 9/7)
```yaml
Monday (9/2):
  - Claude: Issue #1 완료 (Next.js 설정)
  - Cursor: Issue #5 시작 (인증 페이지)

Tuesday (9/3):
  - Claude: Issue #3 시작 (Supabase 설정)
  - Codex: Issue #2 시작 (린팅 설정)

Wednesday (9/4):
  - Cursor: Issue #6, #7 시작 (레이아웃, shadcn)
  - Claude: Issue #4 시작 (DB 스키마)

Thursday (9/5):
  - 전체: Phase 1 통합 테스트
  - 진행 상황 리뷰

Friday (9/6):
  - Phase 1 완료
  - Phase 2 준비
```

### Week 2: Backend Core (9/8 - 9/14)
```yaml
Monday (9/9):
  - Codex: Issue #8 (Provider 패턴)
  - Backend_Lead: Issue #9 (증권 API)

Tuesday (9/10):
  - Data_Engineer_1: Issue #10 (뉴스 수집)
  - DevOps_Engineer: Issue #11 (Queue 설정)

Wednesday-Friday:
  - Backend API 구현
  - 통합 테스트
```

### Week 3-4: Frontend & AI Integration
```yaml
Frontend Development:
  - Cursor 팀: 대시보드, 상세페이지
  - UI/UX: 스마트 에디터

AI Integration:
  - Gemini 팀: Claude API, 요약 엔진
  - ML 팀: 프롬프트 시스템
```

## 📊 진행 상황 추적

### 일일 스탠드업 (매일 9:00 AM)
```markdown
## 🌅 Daily Standup - [날짜]

### Phase 1 Team (Foundation)
- Claude: [진행상황]
- Cursor: [진행상황]
- Codex: [진행상황]

### 오늘의 목표
- [ ] Issue #N 완료
- [ ] PR 리뷰
- [ ] 통합 테스트

### 블로커
- [문제점 및 해결책]
```

### 주간 리뷰 (매주 금요일)
```markdown
## 📈 Weekly Review - Week N

### 완료된 이슈
- ✅ Issue #1: Next.js 설정
- ✅ Issue #3: Supabase 연동
- ✅ Issue #5: 인증 페이지

### 다음 주 계획
- 🎯 Phase 2 백엔드 개발 시작
- 🎯 API 엔드포인트 구현

### 메트릭스
- 완료율: 85%
- 코드 커버리지: 75%
- 버그 수: 2개
```

## 🚀 실행 명령어

### 이슈 상태 업데이트
```bash
# 이슈 할당
gh issue edit 1 --add-assignee claude

# 라벨 추가
gh issue edit 1 --add-label "in-progress"

# 코멘트 추가
gh issue comment 1 --body "Phase 1 완료"
```

### AI Orchestra 실행
```bash
# 특정 워크플로우 실행
python3 ai_orchestra/orchestrator/main.py --workflow foundation_setup

# 페르소나별 작업 할당
python3 ai_orchestra/orchestrator/assign_tasks.py --persona Claude --issues "1,3,4"
```

## 📋 체크리스트

### Phase 1 완료 기준
- [ ] Next.js 프로젝트 실행 가능
- [ ] Supabase 연결 확인
- [ ] 기본 인증 플로우 동작
- [ ] shadcn/ui 컴포넌트 사용 가능
- [ ] 모바일 반응형 레이아웃

### 전체 MVP 완료 기준 (8주 후)
- [ ] 모든 P0 이슈 완료
- [ ] 50명 베타 사용자 확보
- [ ] 일일 활성 사용자 20명
- [ ] AI 비용 일 $10 미만
- [ ] 페이지 로딩 속도 < 2초

---

**PM Claude 메모**: 
- 이슈들을 단계별로 체계화함
- 각 AI의 전문성에 맞춰 배정
- 병렬 처리 가능한 작업들 식별
- 주간 단위 스프린트로 관리

*최종 업데이트: 2025.09.01*
*다음 업데이트: Phase 1 완료 후*
