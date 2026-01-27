import sys
import os
import asyncio

# Add current directory to path so we can import collectors
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from collectors.us_market import USMarketCollector
from collectors.macro import MacroCollector
from collectors.news import NewsCollector

async def test_collectors():
    print("--- 1. Testing US Market Collector (yfinance) ---")
    try:
        us_collector = USMarketCollector()
        market_data = us_collector.get_market_movers()
        print("Success! Sample Data:")
        # Print first 2 items to avoid clutter
        if "indices_and_tech" in market_data:
            print(market_data["indices_and_tech"][:2]) 
        else:
            print(market_data)
    except Exception as e:
        print(f"FAILED: {e}")

    print("\n--- 2. Testing Macro Collector (FRED/Yahoo) ---")
    try:
        # Note: Without API KEY, FRED might fail or limit. 
        # We'll see if it handles graceful failure or if we need to set a dummy key for testing structure.
        # For now, let's assume the class handles missing key gracefully or we might need to mock.
        macro_collector = MacroCollector(api_key="mock_key_if_needed") 
        # Note: The current implementation requires a real key for FRED. 
        # Let's see if it errors out as expected (proving the code runs).
        macro_data = macro_collector.get_key_indicators()
        print(f"Result (Expect error if no key): {macro_data}")
    except Exception as e:
        print(f"FAILED: {e}")

    print("\n--- 3. Testing News Collector (RSS) ---")
    try:
        news_collector = NewsCollector()
        news_data = news_collector.get_market_sentiment_news()
        print(f"Success! Fetched {len(news_data)} articles.")
        if news_data:
            print(f"Sample: {news_data[0]['title']}")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_collectors())
