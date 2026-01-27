# Alpha-Research: Co-Research Platform Whitepaper

## 1. Vision: Glass-box Intelligence
기존의 AI 서비스들이 "결론(Answer)"을 내려주는 데 집중했다면, **Alpha-Research**는 사용자가 결론에 도달하는 **"과정(Process)"을 증강(Augment)**하는 도구입니다.

투자 리서치는 정답이 없는 게임입니다. AI는 판사가 아니라, 유능한 **리서치 비서(Research Assistant)**가 되어야 합니다.

## 2. Core Philosophy
1.  **Transparency First**: 원본 데이터(News, Announcement, Job Posting)를 숨기지 않고 가장 먼저 노출합니다.
2.  **No Hallucination**: AI는 의견을 내지 않습니다. 오직 '발견(Detect)'하고 '강조(Highlight)'할 뿐입니다.
3.  **Human-In-The-Loop**: 최종 판단과 가설 수립은 사용자가 수행하며, 시스템은 이를 체계적으로 기록(Scrap & Log)합니다.

## 3. Key Modules

### A. The Observatory (관측소)
*목적: 시장의 모든 원본 신호(Raw Signals)를 왜곡 없이 수집하고 나열합니다.*
- **Feature**:
    - **Live Feed**: 뉴스, 공시, 채용, 특허 등의 시간순 피드.
    - **Source Indicators**: 데이터의 출처와 신뢰도를 명시.
    - **Filter & Search**: "Robotics", "Restructuring" 키워드 기반 필터링.

### B. The Prism (프리즘 - AI Highlighter)
*목적: 쏟아지는 정보 속에서 '주목할 만한 변화'를 시각적으로 돕습니다.*
- **Feature**:
    - **Diff Engine**: "지난달 대비 채용 30% 증가", "약관 내 'Risk' 단어 빈도 증가" 등 **변화량(Delta)**을 감지.
    - **Fact Highlighting**: 긴 텍스트에서 숫자, 고유명사, 날짜 등 핵심 팩트에 형광펜 효과.
    - **Noise Reduction**: 중복 기사 그룹화 및 광고성 콘텐츠 흐리게 처리.

### C. The Lab (연구소 - Hypothesis Builder)
*목적: 사용자가 수집한 단서들을 엮어 자신만의 투자 가설을 만듭니다.*
- **Feature**:
    - **Contextual Scrap**: 뉴스나 차트의 특정 부분을 드래그하여 스크랩.
    - **Thesis Note**: 스크랩한 근거들을 연결하여 "Nvidia 매수 가설: 로보틱스 팀 확장 + 신규 특허"와 같은 논리 구조 생성.
    - **Validation Tracking**: 세워둔 가설이 맞는지 추적할 수 있는 체크리스트 제공.

## 4. Tech Stack Recommendation
- **Next.js 14+**: App Router 기반의 고성능 대시보드.
- **Supabase**: 사용자별 스크랩 및 노트 저장을 위한 빠른 백엔드 구축.
- **Python (FastAPI)**: 데이터 수집 및 NLP 처리 (Prism 엔진).
- **Tailwind CSS + Shadcn/UI**: 직관적이고 밀도 높은 정보 시각화.

## 5. Next Steps
1.  **Project Setup**: `Alpha-Research` (or your preferred name) 폴더 생성.

## 6. References & Assets (Legacy Project)
This project (`Alpha-Research`) is a pivot and evolution from the previous `StockIQ` project.
When setting up this new project, refer to the following documents from the `StockIQ` archive for context on data sources and previous architectural decisions:
- **Vision**: `/Users/m4_macbook/Projects/Stockiq/docs/AI_TRADING_VISION.md`
- **Specs**: `/Users/m4_macbook/Projects/Stockiq/docs/MVP_SPECIFICATION.md`
- **Bridge Architecture**: `/Users/m4_macbook/Projects/Stockiq/docs/WINDOWS_BRIDGE_ARCH.md`

> **Note**: While we are building a fresh "Glass-box" research tool, the backend logic for data collection (Perplexity/Gemini integration) in the previous project is a valuable asset to migrate.
