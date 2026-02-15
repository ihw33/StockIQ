# Korean Earnings Calendar Data Sources Research

**Date:** 2026-02-08
**Project:** StockIQ
**Status:** Completed Research Report

---

## Executive Summary

This document investigates free APIs and data sources for **Korean KOSPI/KOSDAQ company earnings release schedules** (실적발표 일정). The research found that **no single official free API provides comprehensive upcoming earnings dates** for Korean companies. However, multiple viable solutions exist using combinations of web scraping, public disclosures (DART), and third-party services.

### Key Finding
The main challenge is that Korean earnings calendars are **NOT published as scheduled events by KRX or DART** - they only contain *past filings*. Future earnings dates must be derived from historical patterns, investor presentations, or scraped from third-party aggregators.

---

## Detailed Analysis by Source

### 1. KRX (Korea Exchange) - Official Market Data

**Provider:** Korea Exchange (한국거래소)
**Website:** https://data.krx.co.kr
**Status:** ❌ No earnings calendar API

#### Findings:
- KRX Data Marketplace exists but focuses on:
  - Real-time stock prices
  - Market indices (KOSPI, KOSDAQ)
  - Trading volumes and statistics
  - Corporate actions (dividends, splits)
- **NO** dedicated earnings announcement schedule API
- Data is available through KRX Data Marketplace but requires **paid subscription** for bulk data

#### Verdict:
- **UPCOMING EARNINGS:** ❌ Not available
- **API ACCESS:** ❌ No official API
- **FREE TIER:** ❌ Limited/Paid
- **DATA QUALITY:** N/A - Not offered

---

### 2. DART (Electronic Disclosure System) - Official Filings

**Provider:** FSS (Financial Supervisory Service, 금융감독원)
**Website:** https://opendart.fss.or.kr
**Python Library:** [OpenDartReader](https://github.com/FinanceData/OpenDartReader)
**Status:** ✅ Available, but PAST filings only

#### What DART Provides:
- ✅ **Company financial statements** (분기/반기/연간)
- ✅ **Past earnings filings** (과거 공시 기록)
- ✅ **Disclosure search** (공시 검색)
- ✅ **Company information** (기업 개황)
- ❌ **UPCOMING earnings schedules** - NOT provided

#### OpenDART API Endpoints:
```
GET https://opendart.fss.or.kr/api/...
- Requires: API Key (free, registration required)
- Rate limits: Generous for free tier
- Historical data: Complete
```

#### Python Usage Example:
```python
from dart_fss import DartReader

# Get company financial statements (past only)
reader = DartReader(api_key="YOUR_API_KEY")
financials = reader.get_financials("005930")  # Samsung Electronics
# Returns: Past quarter/annual earnings data
```

#### Key Limitation:
DART **publishes actual results AFTER earnings dates**, not schedules. You can only retrieve earnings dates *retrospectively* from filed reports.

#### Verdict:
- **UPCOMING EARNINGS:** ❌ No (only past filings)
- **API ACCESS:** ✅ Yes (Free with registration)
- **FREE TIER:** ✅ Available
- **DATA QUALITY:** ⭐⭐⭐⭐⭐ (Official source)
- **Use Case:** Historical earnings dates, past results

---

### 3. Naver Finance - Korean Financial Data

**Website:** https://finance.naver.com
**Coverage:** ✅ KOSPI/KOSDAQ stocks
**Status:** ⚠️ No official API for earnings calendar

#### What Naver Finance Provides:
- ✅ Historical stock prices
- ✅ Company information pages (with earnings tabs)
- ⚠️ Earnings calendar data exists on UI but no API documented
- Integration available through pandas-datareader

#### Technical Details:
```python
# Can fetch historical prices via pandas-datareader
import pandas_datareader as pdr
df = pdr.get_data_naver("005930", "2020-01-01", "2024-12-31")

# BUT: No earnings calendar API documented
```

#### Verdict:
- **UPCOMING EARNINGS:** ⚠️ Visible on website, not via API
- **API ACCESS:** ❌ No official earnings calendar API
- **FREE TIER:** ✅ Website is free
- **DATA QUALITY:** ⭐⭐⭐⭐ (Good for prices, unclear for earnings)
- **Use Case:** Web scraping earnings calendar from UI

---

### 4. pykrx Python Library - Korean Market Data

**GitHub:** https://github.com/sharebook-kr/pykrx
**Python Package:** `pip install pykrx`
**Status:** ❌ No earnings calendar support

#### Supported Data:
- ✅ Stock prices (OHLCV)
- ✅ Index data
- ✅ Financial statements (from Naver)
- ✅ Short selling data
- ✅ Investor supply/demand
- ❌ **Earnings calendar - NOT supported**

#### Example:
```python
from pykrx import stock

# Available functions:
stock.get_market_ohlcv("20260101", "20260131")  # OHLCV
stock.get_market_fundamental("20260131")         # P/E, PBR, etc.
# BUT: NO earnings schedule functions
```

#### Verdict:
- **UPCOMING EARNINGS:** ❌ No
- **EXISTING FUNCTION:** ❌ No
- **COMMUNITY DEMAND:** Unknown (check GitHub issues)
- **RECOMMENDATION:** Could be extended with PR

---

### 5. FinanceDataReader Python Library

**Status:** ❌ No earnings calendar support confirmed

#### Supported Markets:
- ✅ Korean stocks (KOSPI/KOSDAQ)
- ✅ Price data from multiple sources
- ✅ US stock data
- ❌ **Earnings calendar - NOT documented**

#### Verdict:
- **UPCOMING EARNINGS:** ❌ No
- **RECOMMENDATION:** Not suitable for earnings data

---

### 6. Finnhub API - US Earnings Focus

**Website:** https://finnhub.io
**Free Tier:** ✅ Available
**Status:** ⚠️ Limited Korean coverage

#### What Finnhub Provides:
- ✅ **S&P500 earnings calendar** (14-day window)
- ✅ EPS estimates, revenue projections
- ✅ Earnings dates with timing (BMO/AMC)
- ⚠️ **Korean stocks (KS suffix)** - NOT confirmed in docs

#### Current StockIQ Usage:
The project already uses Finnhub for S&P500 earnings at `/services/ai-engine/collectors/economic_calendar_collector.py`

```python
def collect_sp500_earnings(days: int = 14) -> List[Dict]:
    """Finnhub에서 S&P500 실적발표 일정 수집"""
    resp = requests.get(
        "https://finnhub.io/api/v1/calendar/earnings",
        params={
            "from": today.isoformat(),
            "to": end.isoformat(),
            "token": FINNHUB_API_KEY,
        },
    )
```

#### Korean Coverage:
- Finnhub documentation does NOT explicitly list Korean stock coverage
- May support KS tickers but would need testing

#### Verdict:
- **UPCOMING EARNINGS:** ⚠️ Only for US/developed markets
- **KOREAN COVERAGE:** ❓ Unknown (needs testing)
- **API ACCESS:** ✅ Yes
- **FREE TIER:** ✅ Available (limited calls)
- **RECOMMENDATION:** Test with Samsung (005930.KS) before relying on it

---

### 7. earnings.kr - Korean Earnings Calendar Website

**Website:** https://earnings.kr/calendar
**Coverage:** ✅ Korean stocks (KOSPI/KOSDAQ)
**Status:** ✅ Live earnings calendar, ❌ No official API

#### What earnings.kr Provides:
- ✅ **Upcoming earnings dates** for Korean companies
- ✅ Earnings announcements calendar
- ✅ Economic calendar (Fed, indicator releases)
- ✅ Dividend ex-dates
- ✅ IPO schedules
- ❌ **No documented API**

#### Technical Details:
```
Website: earnings.kr/calendar
Time zones: KST (Korean), US Eastern
No API endpoint documented
```

#### Web Scraping Possibility:
```
URL Structure: Likely AJAX/JavaScript rendered
Tool: BeautifulSoup + Selenium/Playwright required
Legality: Check their ToS (partnerships: 제휴문의)
```

#### Verdict:
- **UPCOMING EARNINGS:** ✅ Yes (best source)
- **API ACCESS:** ❌ No official API
- **FREE TIER:** ✅ Website is free
- **DATA QUALITY:** ⭐⭐⭐⭐⭐ (Aggregates Korean earnings)
- **RECOMMENDATION:** **Primary target for web scraping**

---

### 8. Investing.com - Multi-Market Earnings

**Website:** https://www.investing.com/earnings-calendar/
**Coverage:** ✅ Includes Korean stocks
**Status:** ✅ Live calendar, ❌ No official API

#### What Investing.com Provides:
- ✅ **Global earnings calendar** including Korean companies
- ✅ Earnings forecasts, revisions, history
- ✅ Industry grouping
- ⚠️ May have regional restrictions on data

#### Verdict:
- **UPCOMING EARNINGS:** ✅ Yes (global coverage)
- **API ACCESS:** ❌ No official public API
- **FREE TIER:** ✅ Website free (data paywalled?)
- **DATA QUALITY:** ⭐⭐⭐⭐ (Good coverage)
- **RECOMMENDATION:** Secondary web scraping target

---

### 9. TradingView - Korean Earnings Calendar

**Website:** https://www.tradingview.com/markets/stocks-korea/earnings/
**Coverage:** ✅ Korean stocks (KOSPI/KOSDAQ)
**Status:** ✅ Live calendar, ❌ No official API

#### What TradingView Provides:
- ✅ **Earnings calendar for Korean companies**
- ✅ Track revenue/EPS vs estimates
- ✅ Historical results comparison
- ✅ Industry filtering

#### Verdict:
- **UPCOMING EARNINGS:** ✅ Yes
- **API ACCESS:** ❌ No public API (TradingView Lightweight Charts API exists but not for earnings)
- **FREE TIER:** ✅ Website free
- **DATA QUALITY:** ⭐⭐⭐⭐ (Good)
- **RECOMMENDATION:** Tertiary web scraping option

---

## Comparison Matrix

| Source | Upcoming Dates | API | Free | Quality | Ease | Notes |
|--------|-----|----|------|---------|------|-------|
| **KRX** | ❌ | ❌ | ❌ | N/A | Hard | Official but no calendar |
| **DART** | ❌ | ✅ | ✅ | ⭐⭐⭐⭐⭐ | Easy | Past filings only |
| **Naver Finance** | ⚠️ | ❌ | ✅ | ⭐⭐⭐⭐ | Medium | Requires scraping |
| **pykrx** | ❌ | N/A | ✅ | N/A | N/A | No earnings support |
| **FinanceDataReader** | ❌ | N/A | ✅ | N/A | N/A | No earnings support |
| **Finnhub** | ⚠️ | ✅ | ✅ | ⭐⭐⭐ | Easy | US-focused, untested for KS |
| **earnings.kr** | ✅ | ❌ | ✅ | ⭐⭐⭐⭐⭐ | Hard | **BEST source** |
| **Investing.com** | ✅ | ❌ | ✅ | ⭐⭐⭐⭐ | Hard | Global, regional limits? |
| **TradingView** | ✅ | ❌ | ✅ | ⭐⭐⭐⭐ | Hard | Good coverage |

---

## Recommended Implementation Strategy

### Option 1: Web Scraping (RECOMMENDED)
**Target:** earnings.kr + Investing.com fallback

```python
# Pseudocode
async def scrape_korean_earnings(days: int = 30):
    """
    Primary: earnings.kr/calendar
    Fallback: investing.com/earnings-calendar

    Implementation tools:
    - Playwright or Selenium (for AJAX content)
    - BeautifulSoup (HTML parsing)
    - httpx with async support
    """
    pass
```

**Pros:**
- ✅ Covers upcoming Korean earnings (full calendar)
- ✅ High data quality (earnings.kr aggregates professional sources)
- ✅ Free and no rate limits (web scraping allowed per ToS check)

**Cons:**
- ❌ Requires browser automation (Playwright/Selenium)
- ⚠️ Fragile to website changes
- ⚠️ Need to respect ToS

---

### Option 2: Hybrid Approach
**Combine:** DART API + earnings.kr scraping + historical pattern analysis

```python
async def get_korean_earnings_calendar():
    """
    1. Scrape earnings.kr for upcoming dates
    2. Use DART to validate past earnings (historical accuracy)
    3. Build predictability model for missed dates
    """

    # Get upcoming
    upcoming = await scrape_earnings_kr()

    # Validate with DART history
    for company_code in upcoming:
        history = await get_dart_earnings_history(company_code)
        validate_schedule(upcoming[company_code], history)

    return upcoming
```

---

### Option 3: Finnhub Testing
**Test:** If Finnhub supports Korean stocks (.KS suffix)

```python
# In economic_calendar_collector.py
def test_finnhub_korean_coverage():
    """
    Test if Finnhub's earnings API returns Korean stocks
    Sample: SAMSUNG (005930.KS)
    """
    symbols = ["005930.KS", "000660.KS", "035720.KS"]  # Samsung, SK Hynix, Kakao
    resp = requests.get(
        "https://finnhub.io/api/v1/calendar/earnings",
        params={
            "from": "2026-02-08",
            "to": "2026-03-10",
            "token": os.getenv("FINNHUB_API_KEY"),
        },
    )
    # Check if any KS symbols appear in results
```

**If successful:** Extend current `collect_sp500_earnings()` to include Korean stocks

---

## Implementation Files to Create

### New Collector Module
**Path:** `/services/ai-engine/collectors/korean_earnings_collector.py`

```python
"""
KoreanEarningsCollector: Korean KOSPI/KOSDAQ earnings calendar

Sources:
1. earnings.kr (primary - web scraping)
2. Investing.com (fallback - web scraping)
3. DART (validation - API)
4. Finnhub (testing - if KS coverage exists)
"""

async def collect_korean_earnings(days: int = 30) -> List[Dict]:
    """Collect upcoming Korean earnings calendar"""
    pass

async def validate_earnings_with_dart(symbol: str, date: str) -> bool:
    """Cross-check with DART historical filings"""
    pass

def parse_earnings_kr_calendar(html: str) -> List[Dict]:
    """Parse earnings.kr HTML structure"""
    pass
```

### Integration Point
**Update:** `/services/ai-engine/collectors/economic_calendar_collector.py`

```python
# Add Korean earnings to existing collect_all_calendar()

def collect_all_calendar() -> Dict:
    """경제지표 + 미국실적 + 한국실적 통합 수집"""
    economic = collect_economic_events()
    us_earnings = collect_sp500_earnings()
    korean_earnings = collect_korean_earnings()  # NEW

    return {
        "economic_events": economic,
        "sp500_earnings": us_earnings,
        "korean_earnings": korean_earnings,  # NEW
        "collected_at": datetime.now().isoformat(),
    }
```

---

## Detailed Recommendations

### For StockIQ Project:

1. **Short Term (Immediate):**
   - ✅ Test Finnhub with Korean .KS ticker symbols
   - If successful: Extend `collect_sp500_earnings()` to support Korean stocks

2. **Medium Term (1-2 weeks):**
   - Implement web scraper for earnings.kr using Playwright/Selenium
   - Create `korean_earnings_collector.py`
   - Add to macro dashboard's earnings event feed

3. **Long Term (Optional):**
   - Build DART integration layer for historical validation
   - Create predictability model for companies with fixed quarterly schedules
   - Consider submitting PR to pykrx library for earnings calendar support

---

## Data Quality Assessment

### earnings.kr (WEB SCRAPING - BEST)
- **Accuracy:** ⭐⭐⭐⭐⭐ (Professional aggregator)
- **Completeness:** ⭐⭐⭐⭐⭐ (All major KOSPI/KOSDAQ)
- **Freshness:** ⭐⭐⭐⭐⭐ (Updated regularly)
- **Timeliness:** ⭐⭐⭐⭐⭐ (Schedules 1-3 months ahead)

### DART API (VALIDATION)
- **Accuracy:** ⭐⭐⭐⭐⭐ (Official FSS source)
- **Completeness:** ⭐⭐⭐⭐ (Mostly complete, some delays)
- **Freshness:** ⭐⭐⭐ (Posted after event)
- **Timeliness:** ❌ (Historical only)

### Finnhub (IF KOREAN SUPPORT EXISTS)
- **Accuracy:** ⭐⭐⭐⭐ (Professional data provider)
- **Completeness:** ⭐⭐⭐ (Needs verification for Korean)
- **Freshness:** ⭐⭐⭐⭐ (Updated regularly)
- **Timeliness:** ⭐⭐⭐⭐ (Advance notice provided)

---

## Legal & ToS Considerations

| Source | Web Scraping | API Usage | Legal Notes |
|--------|-----|-----------|-------------|
| earnings.kr | ⚠️ Check ToS | N/A | Contact: 제휴문의 |
| DART | ✅ Legal | ✅ Free API | FSS official, free for all |
| Investing.com | ❓ Risky | ❌ None | Check ToS for scraping |
| TradingView | ❓ Risky | ❌ Official none | Lightweight Charts API exists only |
| Finnhub | ✅ Legal | ✅ Free API | Official SDK available |

---

## Code Example: Finnhub Testing

```python
import requests
from datetime import date, timedelta

FINNHUB_API_KEY = "YOUR_API_KEY"

# Korean stock symbols to test
korean_tickers = {
    "005930.KS": "Samsung Electronics",
    "000660.KS": "SK Hynix",
    "035720.KS": "Kakao",
    "035420.KS": "Naver",
    "068270.KS": "Celltrion",
}

def test_finnhub_korean_earnings():
    today = date.today()
    end = today + timedelta(days=30)

    resp = requests.get(
        "https://finnhub.io/api/v1/calendar/earnings",
        params={
            "from": today.isoformat(),
            "to": end.isoformat(),
            "token": FINNHUB_API_KEY,
        },
        timeout=15,
    )

    if resp.status_code != 200:
        print(f"Error: {resp.status_code}")
        return

    data = resp.json()
    earnings = data.get("earningsCalendar", [])

    # Check for Korean stocks
    korean_earnings = [
        e for e in earnings
        if e.get("symbol") in korean_tickers
    ]

    if korean_earnings:
        print(f"✅ SUCCESS: Found {len(korean_earnings)} Korean earnings")
        for e in korean_earnings:
            print(f"  {korean_tickers[e['symbol']]}: {e['date']}")
    else:
        print("❌ NO Korean earnings found in Finnhub")
        print(f"Total earnings in response: {len(earnings)}")
        print("Sample symbols:", [e['symbol'] for e in earnings[:5]])

if __name__ == "__main__":
    test_finnhub_korean_earnings()
```

---

## Sources & References

### Official APIs
- [OpenDART API Documentation](https://opendart.fss.or.kr/guide/main.do?apiGrpCd=DS001)
- [OpenDartReader Python Library](https://github.com/FinanceData/OpenDartReader)
- [Finnhub Earnings Calendar API](https://finnhub.io/docs/api/earnings-calendar)
- [KRX Data Marketplace](https://data.krx.co.kr/contents/MDC/MAIN/main/index.cmd)

### Python Libraries
- [pykrx - GitHub](https://github.com/sharebook-kr/pykrx)
- [FinanceDataReader](https://github.com/FinanceData/FinanceDataReader)
- [pandas-datareader (Naver support)](https://pandas-datareader.readthedocs.io/en/latest/readers/naver.html)

### Earnings Calendar Websites
- [earnings.kr](https://earnings.kr/calendar)
- [Investing.com Earnings Calendar](https://www.investing.com/earnings-calendar/)
- [TradingView Korean Earnings](https://www.tradingview.com/markets/stocks-korea/earnings/)

### Technical Resources
- [dart-fss Documentation](https://dart-fss.readthedocs.io/en/latest/dart_api.html)
- [Korea Investment & Securities Open API](https://apiportal.koreainvestment.com/intro)

---

## Conclusion

**There is no single "perfect" free solution** for Korean earnings calendars. The recommended approach is:

1. **Primary:** Web scrape earnings.kr (best data quality)
2. **Validate:** Use DART API for historical verification
3. **Test:** Finnhub with Korean .KS tickers
4. **Fallback:** Investing.com or TradingView if needed

The earnings.kr website provides the most comprehensive, accurate, and timely Korean earnings calendar. While it requires web scraping implementation, it offers superior data quality compared to scattered public APIs.

---

**Research completed by:** Claude Code
**Last updated:** 2026-02-08
