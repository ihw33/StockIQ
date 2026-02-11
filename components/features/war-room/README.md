# War Room (워룸)

투자자 매매동향 + AI 분석 패널

## 컴포넌트 구조

```
war-room/
├── right-panel.tsx         # 메인 패널 (탭 전환, 폴링)
├── ai-control-panel.tsx    # AI 분석 탭 (버튼, 최근 알림)
└── reports-tab.tsx         # 보고서 탭 (목록 표시)
```

## 핵심 컴포넌트

### right-panel.tsx (225줄)
**역할**: 탭 관리, 백엔드 폴링, 보고서 추가

중요 로직:
```typescript
// 15초마다 백엔드에서 새 보고서 확인
useEffect(() => {
  const checkPending = async () => {
    const res = await fetch('/api/reports/pending?minutes=10');
    // 중복 체크:
    // 1. deletedDbIds - 사용자가 삭제한 보고서
    // 2. processedDbIdsRef - 이미 추가한 보고서
    // 3. existsInStore - 스토어에 이미 있는 보고서
  };

  const interval = setInterval(checkPending, 15000);
}, []);
```

⚠️ **중복 방지 메커니즘**:
1. `deletedDbIds` (Zustand) - 사용자가 삭제한 보고서 ID 추적
2. `processedDbIdsRef` (useRef) - 이미 처리한 보고서 ID (컴포넌트 재마운트 시 리셋됨)
3. `existsInStore` 체크 - 스토어에 이미 있는 dbId는 추가하지 않음

### ai-control-panel.tsx (644줄)
**역할**: 분석 버튼, 최근 알림 표시

분석 버튼:
- "알고리즘 분석" → `/api/ai/algo-analysis-start`
- "종합 분석" → `/api/ai/deep-analysis-start`
- "기업 분석" → `/api/ai/company-analysis-start`

⚠️ **중요**:
- 버튼 클릭 → 백그라운드 분석 시작 (즉시 완료 X)
- 15초 폴링으로 결과 수신
- `recentAlerts`로 최근 10개 알림 표시

### reports-tab.tsx (171줄)
**역할**: 보고서 목록 표시, 필터링

필터:
- `all` - 전체
- `algo` - 알고리즘만
- `llm` - 종합 분석만
- `company` - 기업 분석만

시간 표시: `MM/DD HH:MM` 형식

## 데이터 흐름

1. 사용자가 "알고리즘 분석" 클릭
2. `ai-control-panel` → API 호출
3. 백엔드 백그라운드 작업 시작
4. `right-panel` 15초 폴링 → 새 보고서 발견
5. 중복 체크 통과 → `addReport()` (Zustand)
6. `reports-tab`에 표시

## Store 연동

`lib/store/report-store.ts`:
- `reports` - 보고서 목록 (최대 100개)
- `deletedDbIds` - 삭제한 보고서 ID
- `addReport()` - 보고서 추가 (ID: `${symbol}_${mode}_${timestamp}`)
- `deleteReport()` - 보고서 삭제 (dbId를 deletedDbIds에 추가)

## 주의사항

- 컴포넌트 리마운트 시 `processedDbIdsRef` 리셋됨
- 스토어 체크(`existsInStore`)가 최종 중복 방지
- 폴링 간격: 15초 (너무 짧으면 부하)
- localStorage 동기화 (페이지 간 이동 시에도 유지)
