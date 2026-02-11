# 키움 API 섹터/그룹 조사 결과

**조사 날짜**: 2026-02-11
**목적**: 스크리너에서 인포스탁 섹터/그룹 분류를 활용하기 위한 API 탐색

---

## 1. 조사 결과 요약

### ❌ 섹터/그룹 조회 API 미발견

현재 키움 REST API에서 **직접적인 업종/섹터별 종목 조회 API를 찾지 못했습니다**.

### 테스트한 API

| API ID | 엔드포인트 | 테스트 결과 | 비고 |
|--------|-----------|------------|------|
| ka10201 | /api/dostk/stkinfo | ❌ URI 미지원 | 업종별 종목 (추정) |
| ka10202 | /api/dostk/stkinfo | ❌ URI 미지원 | 섹터 목록 (추정) |
| ka10203 | /api/dostk/mrkcond | ❌ URI 미지원 | 그룹별 종목 (추정) |
| ka10204 | /api/dostk/stkinfo | ❌ URI 미지원 | 테마 그룹 (추정) |
| ka10101 | /api/dostk/mrkcond | ❌ URI 미지원 | 시장 전체 정보 (추정) |
| **ka10102** | /api/dostk/stkinfo | ✅ 작동 | 증권사 목록 (73개) |
| ka10001 | /api/dostk/stkinfo | ✅ 작동 | 종목 정보 (업종 필드 없음) |

### ka10001 (종목 정보) 분석

**응답 필드 중 섹터 관련:**
- `mac`: 시가총액 (Market Cap, 숫자값 — 업종 아님)
- `mac_wght`: 빈 값
- ❌ **업종/섹터 코드 필드 없음**

**테스트 종목:**
| 종목 | 업종 | mac 값 |
|------|------|--------|
| 삼성전자 | 반도체 | 9,915,394 |
| 카카오 | IT서비스 | 260,252 |
| 현대차 | 자동차 | 1,054,502 |
| NAVER | 인터넷 | 403,111 |

→ `mac`은 시가총액 (백만원 단위 추정)

---

## 2. 현재 활용 가능한 방법

### A. FinanceDataReader 활용 (★ 권장)

**장점:**
- 이미 `strategies/screener.py`에서 사용 중
- `fdr.StockListing('KOSPI')`로 전체 종목 + 업종 정보 제공
- 별도 API 호출 불필요

**예시 코드:**
```python
import FinanceDataReader as fdr

# KOSPI 전종목 + 업종 정보
df = fdr.StockListing('KOSPI')
# 컬럼: Code, Name, Sector, Industry, ListingDate, ...
```

**업종 정보:**
- Sector: 대분류 (예: IT, 금융, 제조)
- Industry: 소분류 (예: 반도체, 은행, 자동차)

### B. 키움 WebSocket 조건검색 (부분 활용)

**파일:** `collectors/kiwoom_condition.py`

**기능:**
- 실시간 조건식 매칭
- 사전 정의된 조건으로 종목 필터링

**제약:**
- 조건식은 HTS에서 미리 만들어야 함
- REST API처럼 동적 필터링 불가

### C. 외부 데이터 + 매핑

1. **KRX 공식 데이터** (업종 코드 제공)
2. **네이버 증권** (섹터 정보 크롤링)
3. **키움 HTS** (수동 추출 → DB 저장)

---

## 3. 스크리너 구현 권장 방안

### Phase 1: FinanceDataReader 기본 구현

```python
def get_all_stocks_with_sector():
    """전체 KOSPI/KOSDAQ 종목 + 업종 정보"""
    kospi = fdr.StockListing('KOSPI')
    kosdaq = fdr.StockListing('KOSDAQ')

    all_stocks = pd.concat([kospi, kosdaq])

    # company_financials 테이블과 조인
    # → PER, PBR, ROE 등 추가

    return all_stocks
```

**섹터 필터 예시:**
```python
# IT 업종만
it_stocks = df[df['Sector'] == 'Technology']

# 반도체만
semiconductor = df[df['Industry'] == 'Semiconductors']
```

### Phase 2: 키움 인포스탁 조건식 연동 (향후)

**전제 조건:**
1. 키움 API에 섹터/그룹 조회 API 추가되거나
2. 키움 HTS 조건식을 WebSocket으로 활용

**구현 방향:**
- HTS에서 "반도체 업종" 조건식 생성
- `kiwoom_condition.py`로 실시간 매칭
- 스크리너에서 "인포스탁 조건식" 필터 추가

---

## 4. 필요한 조치

### 즉시 구현 가능 (Phase 1)
- [x] FinanceDataReader 업종 정보 활용
- [ ] `screener.py`에 섹터 필터 추가
- [ ] 프론트엔드 필터 패널에 섹터 드롭다운

### 향후 검토 (Phase 2+)
- [ ] 키움 공식 문서 확인 (REST API 업데이트)
- [ ] KRX 공식 업종 분류 매핑
- [ ] 키움 WebSocket 조건식 통합
- [ ] 인포스탁 테마 그룹 (AI, 2차전지 등) 매핑

---

## 5. 기술적 제약 사항

### 키움 REST API 한계
- 업종/섹터별 일괄 조회 불가
- 종목 단위로만 조회 가능 (ka10001)
- 1,000+ 종목 조회 시 API 호출 과다

### 해결 방안
- **초기 로딩:** FinanceDataReader로 전체 목록 fetch
- **실시간 업데이트:** 필요 시에만 키움 API 호출
- **캐싱:** DB에 업종 정보 저장 (1일 1회 업데이트)

---

## 6. 다음 단계

### A. 스크리너 구현 계속 (권장)
1. FinanceDataReader 업종 정보로 섹터 필터 구현
2. Issue #9 Phase 1-3 완료
3. 이후 키움 API 업데이트 시 추가 연동

### B. 키움 API 추가 조사
1. 키움 개발자 센터 문서 확인
2. 고객센터 문의 (업종별 조회 API 존재 여부)
3. HTS 조건식 활용 방안 검토

---

## 참고 파일

- `/Users/m4_macbook/Projects/Stockiq/services/ai-engine/collectors/kiwoom.py`
- `/Users/m4_macbook/Projects/Stockiq/services/ai-engine/collectors/kiwoom_condition.py`
- `/Users/m4_macbook/Projects/Stockiq/services/ai-engine/strategies/screener.py`
- `/Users/m4_macbook/Projects/Stockiq/scripts/test_kiwoom_sector.py` (테스트 스크립트)
- `ka10001_sector_fields_analysis.json` (분석 결과)

---

## 결론

**키움 REST API로는 인포스탁 섹터/그룹을 직접 조회할 수 없습니다.**

**대안:** FinanceDataReader의 Sector/Industry 정보를 활용하여 스크리너 구현 → 향후 키움 API 업데이트 시 추가 연동

**추천:** Issue #9 구현을 FinanceDataReader 기반으로 진행하고, Phase 5에서 키움 인포스탁 연동 재검토
