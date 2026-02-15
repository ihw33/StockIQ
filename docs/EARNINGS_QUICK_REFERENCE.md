# Korean Earnings Calendar - Quick Reference Card

## One-Page Decision Guide

### Question 1: Do you have 5 minutes?
→ YES: **Test Finnhub Korean support** (Option A)
→ NO: Skip to Question 2

### Question 2: Want API or scraping?
→ API only: Use DART (historical validation only)
→ Scraping OK: **Use earnings.kr** (Option B) ← RECOMMENDED

### Question 3: Already using Finnhub?
→ YES: Test 005930.KS first
→ NO: earnings.kr scraping is your answer

---

## Quick Code Reference

### Test Finnhub (Option A)
```python
import requests
from datetime import date, timedelta

resp = requests.get(
    "https://finnhub.io/api/v1/calendar/earnings",
    params={
        "from": date.today().isoformat(),
        "to": (date.today() + timedelta(days=30)).isoformat(),
        "token": os.getenv("FINNHUB_API_KEY"),
    }
)

korean = [e for e in resp.json()["earningsCalendar"]
          if e["symbol"] in ["005930.KS", "000660.KS"]]

print("✅ Works" if korean else "❌ Doesn't work")
```

### Web Scrape earnings.kr (Option B)
```python
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def scrape():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://earnings.kr/calendar")
        html = await page.content()
        # Parse with BeautifulSoup
        await browser.close()
```

### Validate with DART (Enhancement)
```python
from dart_fss import DartReader

reader = DartReader(api_key=os.getenv("DART_API_KEY"))
filings = reader.get_filings("005930")  # Samsung
```

---

## Data Sources Comparison

| Name | Best For | API | Effort | Quality |
|------|----------|-----|--------|---------|
| **earnings.kr** | Korean earnings calendar | ❌ | 2-3h | ⭐⭐⭐⭐⭐ |
| **Finnhub** | Unified US + Korean (if works) | ✅ | 30m | ⭐⭐⭐⭐ |
| **DART** | Historical validation | ✅ | 1h | ⭐⭐⭐⭐⭐ |
| **Naver Finance** | Alternative scraping | ❌ | 2-3h | ⭐⭐⭐⭐ |
| **pykrx** | Integration (not earnings) | N/A | N/A | N/A |

---

## Setup Checklist

- [ ] `FINNHUB_API_KEY` in `.env.local`
- [ ] `DART_API_KEY` in `.env.local` (optional)
- [ ] Python 3.13+ in venv
- [ ] For scraping: `pip install playwright beautifulsoup4`
- [ ] `playwright install chromium` (one-time)

---

## Implementation Timeline

**Option A (Finnhub test):** 5 minutes
```
1. Copy test code (5 min)
2. Run with API key
3. Get result: Works ✅ or Fails ❌
```

**Option B (earnings.kr):** 2-3 hours
```
1. Inspect DOM (30 min) - inspect earnings.kr structure
2. Build scraper (1 hour) - playwright + BeautifulSoup
3. Test & debug (30-60 min) - validate output
4. Integrate (30 min) - add to economic_calendar_collector.py
```

**Option C (Hybrid):** 3-4 hours
```
1. Do Option A + B above
2. Add DART validation (1 hour)
3. Test integration (30 min)
```

---

## File Locations (Project)

Current earnings code:
```
/Users/m4_macbook/Projects/Stockiq/services/ai-engine/
  └── collectors/
      └── economic_calendar_collector.py  ← Modify this
```

New file to create:
```
/Users/m4_macbook/Projects/Stockiq/services/ai-engine/
  └── collectors/
      └── korean_earnings_collector.py    ← Create this (Option B/C)
```

Frontend integration:
```
/Users/m4_macbook/Projects/Stockiq/components/features/macro/
  └── macro-dashboard.tsx  ← Add earnings section
```

---

## Key Symbols to Test

| Company | Symbol | Market |
|---------|--------|--------|
| Samsung Electronics | 005930 | KOSPI |
| SK Hynix | 000660 | KOSPI |
| Kakao | 035720 | KOSPI |
| Naver | 035420 | KOSPI |
| Celltrion | 068270 | KOSPI |

---

## API Endpoints

**Finnhub Earnings:**
```
GET https://finnhub.io/api/v1/calendar/earnings
  ?from=2026-02-08
  &to=2026-03-10
  &token=YOUR_KEY
```

**DART Search:**
```
GET https://opendart.fss.or.kr/api/company.json
  ?cik=005930
  &token=YOUR_KEY
```

**earnings.kr Web:**
```
https://earnings.kr/calendar
```

---

## Troubleshooting

**Finnhub returns no Korean stocks:**
→ Use Option B (earnings.kr scraping)

**earnings.kr scraper breaks:**
→ Check HTML structure changed
→ Update CSS selectors
→ Consider using selenium if playwright fails

**DART API returns old data only:**
→ Expected behavior (only historical)
→ Use for validation, not schedules

**Rate limits hit:**
→ earnings.kr: No limits (but respect ToS)
→ Finnhub: Free tier has limit
→ DART: Very generous free tier

---

## Performance Expectations

| Operation | Time | Frequency |
|-----------|------|-----------|
| Finnhub earnings check | 1-2 sec | Daily |
| earnings.kr scrape | 5-10 sec | Daily (off-peak) |
| DART validation check | 3-5 sec | Weekly |

---

## Next Step Actions

**If starting now:**
1. Do Option A (5 min Finnhub test) → Get quick answer
2. Based on result:
   - If ✅ works: Extend existing Finnhub code (30 min)
   - If ❌ fails: Implement earnings.kr scraper (2-3 h)

**If Option B (earnings.kr):**
1. Open earnings.kr in browser
2. Right-click → Inspect → Find HTML structure
3. Note CSS selectors for: date, symbol, name, market
4. Update parser code with those selectors
5. Test with 5-10 known earnings dates

**For production:**
- Add error handling (network, parsing failures)
- Log every scrape operation
- Cache results (30-60 min TTL)
- Handle Korean timezone conversions
- Validate data before storing

---

## Reference Documentation

| Document | Purpose | Link |
|----------|---------|------|
| Full Research | Complete analysis | KOREAN_EARNINGS_CALENDAR_RESEARCH.md |
| Implementation Guide | Step-by-step code | EARNINGS_CALENDAR_IMPLEMENTATION_GUIDE.md |
| This Guide | Quick reference | EARNINGS_QUICK_REFERENCE.md |

---

## Contact Points

**StockIQ Project:**
- Path: `/Users/m4_macbook/Projects/Stockiq`
- Issue: #2 (파이낸스 캘린더)
- Related: macro_dashboard.tsx

**Current Earnings Code:**
- File: `services/ai-engine/collectors/economic_calendar_collector.py`
- Function: `collect_sp500_earnings()` (US only)

**API Keys in `.env.local`:**
```
FINNHUB_API_KEY=pk_...
DART_API_KEY=...  (optional, add if needed)
```

---

## Quick Wins

1. **5 min:** Test Finnhub Korean support
2. **30 min:** Add Korean symbols to existing Finnhub code (if works)
3. **1 hour:** Create DART validation layer
4. **2-3 hours:** Full earnings.kr scraper

Pick what fits your timeline!

---

**Last updated:** 2026-02-08
**Status:** Ready to implement
