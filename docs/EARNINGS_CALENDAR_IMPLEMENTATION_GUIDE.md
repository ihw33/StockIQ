# Korean Earnings Calendar Implementation Guide

**For:** Issue #2 (파이낸스 캘린더)
**Based on:** Research document `KOREAN_EARNINGS_CALENDAR_RESEARCH.md`

---

## Quick Start: 3 Implementation Options

### Option A: Finnhub Testing (5 minutes)
**Goal:** Verify if Finnhub supports Korean .KS tickers

**Steps:**
1. Copy test script below
2. Run with FINNHUB_API_KEY
3. If ✅ success: Use Option C
4. If ❌ failure: Use Option B

```python
# Test file: services/ai-engine/test_finnhub_korean.py
import os
import requests
from datetime import date, timedelta

def test_finnhub_korean():
    api_key = os.getenv("FINNHUB_API_KEY")
    symbols_to_test = ["005930.KS", "000660.KS"]  # Samsung, SK Hynix

    resp = requests.get(
        "https://finnhub.io/api/v1/calendar/earnings",
        params={
            "from": date.today().isoformat(),
            "to": (date.today() + timedelta(days=30)).isoformat(),
            "token": api_key,
        },
        timeout=10,
    )

    earnings = resp.json().get("earningsCalendar", [])
    korean = [e for e in earnings if e["symbol"] in symbols_to_test]

    print(f"Found {len(korean)} Korean earnings" if korean else "No Korean earnings")
    return len(korean) > 0

if __name__ == "__main__":
    result = test_finnhub_korean()
    print("✅ Use Option C" if result else "❌ Use Option B")
```

**Effort:** Minimal
**Risk:** None (just testing)

---

### Option B: Web Scraping earnings.kr (2-3 hours)
**Goal:** Scrape upcoming earnings from earnings.kr

**Implementation:**

1. **Install dependency:**
   ```bash
   cd /Users/m4_macbook/Projects/Stockiq/services/ai-engine
   source venv/bin/activate
   pip install playwright beautifulsoup4 httpx
   playwright install chromium
   ```

2. **Create collector:**
   ```python
   # File: collectors/korean_earnings_collector.py

   from datetime import datetime, timedelta, date
   from typing import List, Dict
   import httpx
   from bs4 import BeautifulSoup
   from playwright.async_api import async_playwright
   import logging

   logger = logging.getLogger(__name__)

   async def scrape_earnings_kr(days: int = 30) -> List[Dict]:
       """
       Scrape Korean earnings calendar from earnings.kr

       Returns:
       [
           {
               "date": "2026-02-15",
               "symbol": "005930",  # Samsung
               "name": "삼성전자",
               "market": "KOSPI",
               "type": "earnings"
           },
           ...
       ]
       """
       async with async_playwright() as p:
           browser = await p.chromium.launch(headless=True)
           page = await browser.new_page()

           try:
               await page.goto("https://earnings.kr/calendar", timeout=10000)
               await page.wait_for_selector("[data-earnings]", timeout=5000)

               html = await page.content()
               earnings = parse_earnings_kr_html(html)

               logger.info(f"[Korean Earnings] Scraped {len(earnings)} from earnings.kr")
               return earnings

           except Exception as e:
               logger.error(f"[Korean Earnings] earnings.kr scrape failed: {e}")
               return []
           finally:
               await browser.close()

   def parse_earnings_kr_html(html: str) -> List[Dict]:
       """
       Parse HTML from earnings.kr
       Note: Structure may change - adjust selectors as needed
       """
       soup = BeautifulSoup(html, 'html.parser')
       result = []

       # TODO: Inspect earnings.kr DOM structure
       # Update selectors below to match actual HTML

       # Example structure (adjust):
       earnings_rows = soup.select("table.earnings-calendar tr")

       for row in earnings_rows:
           try:
               date_col = row.select_one("td.date")
               symbol_col = row.select_one("td.symbol")
               name_col = row.select_one("td.name")

               if not all([date_col, symbol_col]):
                   continue

               result.append({
                   "date": date_col.text.strip(),
                   "symbol": symbol_col.text.strip(),
                   "name": name_col.text.strip() if name_col else "",
                   "market": "KOSPI" if "KOSPI" in row.text else "KOSDAQ",
               })
           except Exception as e:
               logger.debug(f"Row parse error: {e}")
               continue

       return result
   ```

3. **Integrate with economic calendar:**
   ```python
   # Update: collectors/economic_calendar_collector.py

   from .korean_earnings_collector import scrape_earnings_kr

   async def collect_all_calendar() -> Dict:
       """경제지표 + 미국실적 + 한국실적 통합 수집"""
       economic = collect_economic_events()
       earnings = collect_sp500_earnings()

       # NEW: Korean earnings
       korean = await scrape_earnings_kr(days=30)

       return {
           "economic_events": economic,
           "sp500_earnings": earnings,
           "korean_earnings": korean,  # NEW
           "collected_at": datetime.now().isoformat(),
       }
   ```

**Effort:** 2-3 hours (includes HTML inspection & debugging)
**Risk:** Website structure changes → need maintenance

---

### Option C: Extend Finnhub (if Korean support confirmed)
**Goal:** Use Finnhub for both US and Korean earnings

**Implementation:**

```python
# Update: collectors/economic_calendar_collector.py

def collect_all_earnings(days: int = 14) -> Dict:
    """
    Unified earnings collection: US + Korean via Finnhub
    (Only if Finnhub supports .KS tickers)
    """
    us_earnings = collect_sp500_earnings(days)
    korean_earnings = collect_korean_earnings_finnhub(days)

    return {
        "us": us_earnings,
        "korean": korean_earnings,
    }

def collect_korean_earnings_finnhub(days: int = 14) -> List[Dict]:
    """Collect Korean earnings from Finnhub (if supported)"""
    if not FINNHUB_API_KEY:
        logger.warning("[Calendar] FINNHUB_API_KEY not set")
        return []

    # Korean stock mappings
    KOSPI_KOSDAQ = {
        "005930.KS": "Samsung",
        "000660.KS": "SK Hynix",
        "035720.KS": "Kakao",
        # ... more companies
    }

    try:
        today = date.today()
        end = today + timedelta(days=days)

        resp = requests.get(
            "https://finnhub.io/api/v1/calendar/earnings",
            params={
                "from": today.isoformat(),
                "to": end.isoformat(),
                "token": FINNHUB_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()

        all_earnings = resp.json().get("earningsCalendar", [])
        korean = [
            e for e in all_earnings
            if e.get("symbol") in KOSPI_KOSDAQ
        ]

        result = []
        for e in sorted(korean, key=lambda x: x.get("date", "")):
            symbol = e["symbol"]
            result.append({
                "date": e.get("date"),
                "symbol": symbol,
                "name": KOSPI_KOSDAQ[symbol],
                "epsEstimate": e.get("epsEstimate"),
                "revenueEstimate": e.get("revenueEstimate"),
            })

        logger.info(f"[Calendar] Korean earnings: {len(result)}")
        return result

    except Exception as e:
        logger.warning(f"[Calendar] Korean earnings error: {e}")
        return []
```

**Effort:** 30 minutes
**Risk:** Depends on Finnhub supporting KS tickers

---

## Decision Tree

```
START
  |
  ├─ Have 5 minutes?
  │  └─ YES → Option A (Test Finnhub)
  │           ├─ Works?
  │           │  ├─ YES → Use Option C ✅
  │           │  └─ NO → Continue below
  │           └─ Doesn't work? → Continue
  │
  ├─ Want API solution?
  │  └─ YES → Use DART (validation only, see note below)
  │           └─ Good for: Historical data quality check
  │           └─ Bad for: No upcoming dates
  │
  ├─ Want best Korean earnings data?
  │  └─ YES → Option B (earnings.kr scraping) ✅ RECOMMENDED
  │           └─ Best quality & completeness
  │           └─ Requires web scraping maintenance
  │
  └─ Want easy solution?
     └─ YES → Wait for user spec
            Then choose Option A or C (Finnhub)
```

---

## DART Integration (For Validation)

Even if you implement earnings.kr scraping, you can enhance with DART:

```python
from dart_fss import DartReader

async def validate_korean_earnings(symbol: str, announced_date: str) -> bool:
    """
    Validate earnings date against DART filings
    (Post-event validation, for accuracy tracking)
    """
    reader = DartReader(api_key=DART_API_KEY)

    try:
        # Get company filings
        filings = reader.get_filings(symbol)

        # Check if earnings was actually announced
        for filing in filings:
            if filing.report_nm in ["분기보고서", "반기보고서", "사업보고서"]:
                filing_date = filing.accept_dttm
                # Validate timing matches

    except Exception as e:
        logger.debug(f"DART validation failed: {e}")
        return False
```

---

## Database Schema (If Needed)

For storing Korean earnings:

```sql
CREATE TABLE korean_earnings (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255),
    announcement_date DATE NOT NULL,
    report_type VARCHAR(50),  -- 분기, 반기, 연간
    market VARCHAR(20),       -- KOSPI, KOSDAQ

    -- Estimates (if available)
    eps_estimate DECIMAL,
    revenue_estimate BIGINT,

    -- Actual (post-announcement)
    eps_actual DECIMAL,
    revenue_actual BIGINT,

    source VARCHAR(50),  -- 'earnings.kr', 'finnhub', 'dart'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(symbol, announcement_date)
);

CREATE INDEX idx_korean_earnings_date
ON korean_earnings(announcement_date);
```

---

## API Endpoint (Frontend Integration)

Add to FastAPI:

```python
# Main.py

@app.get("/api/calendar/korean-earnings")
async def get_korean_earnings(
    days: int = 30,
    market: str = None,  # KOSPI or KOSDAQ
):
    """
    Get upcoming Korean earnings calendar

    Query params:
    - days: Forward-looking window (default 30)
    - market: Filter by KOSPI/KOSDAQ

    Returns:
    [
        {
            "date": "2026-02-15",
            "symbol": "005930",
            "name": "Samsung",
            "market": "KOSPI",
            "source": "earnings.kr"
        },
        ...
    ]
    """
    try:
        earnings = await scrape_korean_earnings(days)

        if market:
            earnings = [e for e in earnings if e["market"] == market]

        return {
            "earnings": earnings,
            "count": len(earnings),
            "next_7_days": len([e for e in earnings
                               if datetime.fromisoformat(e["date"])
                               < datetime.now() + timedelta(days=7)])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Testing Checklist

- [ ] Verify API key in `.env.local` (FINNHUB_API_KEY, DART_API_KEY if using)
- [ ] Test scraper in isolated script first
- [ ] Check earnings.kr website structure hasn't changed
- [ ] Validate data quality (check 5 known earnings dates)
- [ ] Check rate limiting (if scraping)
- [ ] Test with Korean timezone conversions
- [ ] Verify duplicate handling
- [ ] Test error recovery (timeouts, network issues)

---

## Frontend Integration Points

### Macro Dashboard
Add earnings section:
```typescript
// components/features/macro/macro-dashboard.tsx

<section className="earnings-calendar">
  <h3>Upcoming Korean Earnings</h3>
  <EarningsCalendar
    days={30}
    market="KOSPI"
  />
</section>
```

### DateStrip Navigation
Show earnings markers:
```typescript
// Show dot under date if earnings scheduled that day
<DateStrip
  showEarnings={true}
  earningsData={koreanEarnings}
/>
```

---

## Next Steps

1. **Decide on approach** (A/B/C above)
2. **If Option A:** Run test, report results
3. **If Option B:**
   - Inspect earnings.kr DOM structure
   - Build parser
   - Test scraping
4. **If Option C:**
   - Extend existing Finnhub code
   - Add Korean stock mappings

---

**Questions?** Check the full research document:
`/Users/m4_macbook/Projects/Stockiq/docs/KOREAN_EARNINGS_CALENDAR_RESEARCH.md`
