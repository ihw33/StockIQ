# FinanceDataReader vs 네이버증권 API 비교

**목적:** 스크리너 구현 시 업종/섹터 데이터 소스 선택

---

## 1. 개요

| 구분 | FinanceDataReader | 네이버증권 API |
|------|-------------------|----------------|
| 타입 | 공식 Python 라이브러리 | 비공식 크롤링/API |
| 라이선스 | MIT (상업적 사용 가능) | 이용약관 주의 (크롤링 제한 가능) |
| 설치 | `pip install finance-datareader` | requests + BeautifulSoup |
| 유지보수 | 활발한 커뮤니티 | 네이버 페이지 변경 시 깨짐 |

---

## 2. 데이터 비교

### A. 종목 리스트 + 업종 정보

#### FinanceDataReader ⭐
```python
import FinanceDataReader as fdr

# KOSPI 전체 종목
df = fdr.StockListing('KOSPI')

# 컬럼:
# - Code: 종목코드 (005930)
# - Name: 종목명 (삼성전자)
# - Sector: 대분류 (Technology, Finance, Manufacturing, ...)
# - Industry: 소분류 (Semiconductors, Banking, Auto, ...)
# - ListingDate: 상장일
# - Market: KOSPI/KOSDAQ/KONEX
# - MarketCap: 시가총액
```

**업종 분류 체계:**
- **대분류 (Sector)**: 약 10개 (IT, 금융, 제조, 서비스, ...)
- **소분류 (Industry)**: 약 50개 (반도체, 은행, 자동차, 인터넷, ...)
- **출처**: KRX 공식 분류 + GICS (Global Industry Classification Standard)

#### 네이버증권 🔶
```python
# 비공식 크롤링 예시
import requests
from bs4 import BeautifulSoup

url = "https://finance.naver.com/sise/sise_group.naver?type=group"
# 또는
url = f"https://finance.naver.com/item/main.naver?code={symbol}"

# 파싱 필요:
# - 업종명
# - 업종 코드
# - 소속 종목
```

**업종 분류 체계:**
- **대분류**: 업종별 (약 30개)
- **테마**: 200+ 개 (AI, 2차전지, 메타버스, K-뷰티, ...)
- **출처**: 네이버 자체 분류 (비공식)

---

## 3. 상세 비교표

| 항목 | FinanceDataReader | 네이버증권 |
|------|-------------------|-----------|
| **신뢰성** | ⭐⭐⭐⭐⭐ 공식 라이브러리 | ⭐⭐⭐ 크롤링 (변경 위험) |
| **속도** | ⭐⭐⭐⭐⭐ 매우 빠름 (직접 fetch) | ⭐⭐⭐ HTML 파싱 필요 |
| **업종 분류** | ⭐⭐⭐⭐ KRX/GICS 표준 | ⭐⭐⭐⭐⭐ 테마 그룹 풍부 |
| **실시간성** | ⭐⭐⭐ 일별 업데이트 | ⭐⭐⭐⭐ 실시간 가능 |
| **API 제한** | ⭐⭐⭐⭐⭐ 무제한 | ⭐⭐ 과도한 요청 시 차단 위험 |
| **추가 데이터** | 시세, 재무제표 | **뉴스, 토론, 외국인/기관 비율** |
| **구현 난이도** | ⭐⭐⭐⭐⭐ 매우 쉬움 | ⭐⭐⭐ 파싱 로직 필요 |
| **유지보수** | ⭐⭐⭐⭐⭐ 안정적 | ⭐⭐ 페이지 변경 시 수정 필요 |
| **법적 리스크** | ⭐⭐⭐⭐⭐ 없음 | ⭐⭐ 이용약관 확인 필요 |

---

## 4. 네이버증권의 강점

### A. 테마 그룹 (★ 핵심 차별점)
- **200+ 테마**: AI, 2차전지, 메타버스, K-뷰티, 바이오시밀러, ...
- **실시간 업데이트**: 시장 트렌드 반영 빠름
- **투자자 관심도**: 토론실, 뉴스, 관련주

**예시 URL:**
```
https://finance.naver.com/sise/theme.naver?&field=ALL
→ 테마별 종목 리스트
```

### B. 뉴스 + 공시 연동
- 종목별 실시간 뉴스
- 공시 요약
- 증권사 리포트

**Issue #8 (네이버 뉴스 API)**와 연계 가능!

### C. 커뮤니티 데이터
- 토론실 댓글 분석 (투자 심리)
- 외국인/기관 실시간 수급

---

## 5. FinanceDataReader의 강점

### A. 안정성 + 속도
- 공식 라이브러리 → 유지보수 보장
- KRX 데이터 직접 fetch → 파싱 불필요
- 대량 종목 조회 시 빠름 (1,000+ 종목 1초 이내)

### B. 표준 업종 분류
- GICS 기반 → 글로벌 표준
- 금융 분석에 적합 (PER, ROE 등과 조합)

### C. 다양한 데이터 소스
```python
# 미국 주식
fdr.StockListing('NYSE')
fdr.StockListing('NASDAQ')

# 환율, 채권, 원자재
fdr.DataReader('USD/KRW')
fdr.DataReader('KR10YT=RR')  # 한국 10년물 국채
```

---

## 6. 스크리너 적용 시나리오

### Scenario A: FinanceDataReader 단독 사용 ⭐ (권장)

**Phase 1-3:**
- ✅ 빠른 구현 (1-2일)
- ✅ 안정적 운영
- ✅ KRX 표준 업종 필터

**한계:**
- ❌ 테마 그룹 없음 (AI, 2차전지 등)
- ❌ 실시간 뉴스 연동 어려움

**코드 예시:**
```python
def get_screener_data():
    # 1. 전체 종목 + 업종
    df = fdr.StockListing('KOSPI')

    # 2. company_financials 조인
    df = df.merge(financials, on='Code')

    # 3. 필터링
    result = df[
        (df['Sector'] == 'Technology') &
        (df['PER'] >= 8) & (df['PER'] <= 15)
    ]

    return result
```

### Scenario B: 네이버증권 단독 사용 🔶

**Phase 1-3:**
- ⚠️ 크롤링 구현 필요 (3-5일)
- ⚠️ 안정성 낮음 (페이지 변경 시)
- ✅ 테마 그룹 활용 가능

**한계:**
- ❌ 대량 요청 시 차단 위험
- ❌ 법적 리스크 (이용약관 확인 필요)

**코드 예시:**
```python
def get_naver_theme_stocks(theme_id):
    url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no={theme_id}"
    res = requests.get(url)
    soup = BeautifulSoup(res.text, 'html.parser')

    # 파싱 로직 (페이지 변경 시 깨짐)
    stocks = []
    for row in soup.select('table.type_5 tr'):
        # ...복잡한 파싱...
        pass

    return stocks
```

### Scenario C: 하이브리드 (FDR + 네이버) ⭐⭐ (최적)

**Phase 1-3: FinanceDataReader**
- 기본 스크리너 구현
- KRX 표준 업종 필터

**Phase 5: 네이버 테마 추가**
- 테마 그룹 필터 추가
- 뉴스 연동 (Issue #8)

**장점:**
- ✅ 빠른 초기 구현
- ✅ 안정적 운영
- ✅ 추후 테마 기능 확장

**구현 예시:**
```python
# 기본: FinanceDataReader
df = fdr.StockListing('KOSPI')

# 추가: 네이버 테마 (캐싱)
themes = get_naver_themes()  # 1일 1회 크롤링
df['themes'] = df['Code'].apply(lambda x: get_stock_themes(x, themes))

# 필터링
result = df[
    (df['Sector'] == 'Technology') |  # FDR 업종
    (df['themes'].str.contains('AI'))  # 네이버 테마
]
```

---

## 7. 추천 결론

### 🏆 권장: Scenario C (하이브리드)

**Phase 1-3 (즉시):**
```
FinanceDataReader로 스크리너 구현
→ 안정적, 빠름, 법적 리스크 없음
```

**Phase 5 (향후):**
```
네이버 테마 그룹 추가
→ AI, 2차전지 등 트렌드 필터
→ Issue #8 (뉴스 연동)과 시너지
```

### 이유:

1. **빠른 출시**: FDR로 1-2일 내 구현 가능
2. **안정성**: 크롤링 리스크 없음
3. **확장성**: 네이버 테마를 점진적으로 추가
4. **법적 안전**: 공식 라이브러리 사용

---

## 8. 구현 로드맵

### Week 1: FinanceDataReader 기반 스크리너
- [x] GitHub Issue #9 생성
- [ ] Phase 1: 기본 페이지 + Sector 필터
- [ ] Phase 2: 필터 패널 (Sector, Industry)
- [ ] Phase 3: 결과 테이블

### Week 2-3: 네이버 테마 준비
- [ ] 네이버 테마 크롤러 개발
- [ ] DB에 테마 매핑 저장 (company_themes 테이블)
- [ ] 1일 1회 자동 업데이트 스케줄러

### Week 4: 통합
- [ ] 스크리너에 "테마" 필터 추가
- [ ] 네이버 뉴스 연동 (Issue #8)
- [ ] "AI 관련주", "2차전지" 등 인기 테마 프리셋

---

## 9. 참고 코드

### FinanceDataReader 현재 사용 예시
```python
# services/ai-engine/strategies/screener.py (line 15-20)
def get_stock_listing():
    """Get all KOSPI stocks"""
    kospi = fdr.StockListing('KOSPI')
    return kospi
```

### 네이버 테마 크롤링 예시 (향후)
```python
# services/ai-engine/collectors/naver_theme_collector.py (NEW)
def get_theme_list():
    """네이버 전체 테마 목록"""
    url = "https://finance.naver.com/sise/theme.naver"
    # 크롤링 로직
    return themes

def get_theme_stocks(theme_id):
    """특정 테마의 종목 리스트"""
    url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no={theme_id}"
    # 크롤링 로직
    return stocks
```

---

## 결론 요약

| 선택지 | 추천도 | 이유 |
|--------|--------|------|
| **A. FDR 단독** | ⭐⭐⭐⭐ | 빠르고 안정적, 하지만 테마 없음 |
| **B. 네이버 단독** | ⭐⭐ | 테마 좋지만 불안정, 리스크 높음 |
| **C. 하이브리드** | ⭐⭐⭐⭐⭐ | 최고! 빠른 출시 + 확장 가능 |

**최종 추천:**
1. **지금**: FinanceDataReader로 스크리너 완성
2. **나중**: 네이버 테마 추가 (Phase 5)
3. **통합**: Issue #8 (뉴스)와 연계
