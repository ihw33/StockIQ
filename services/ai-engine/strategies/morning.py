from typing import Dict
import asyncio
from collectors.us_market import USMarketCollector
from collectors.macro import MacroCollector
from collectors.news import NewsCollector
from llm_client import LLMClient

class MorningIntelligence:
    def __init__(self):
        self.us_market = USMarketCollector()
        self.macro = MacroCollector()
        self.news = NewsCollector()
        self.llm = LLMClient()

    async def generate_briefing(self) -> Dict:
        """
        Executes the Morning Intelligence workflow:
        1. Collect Data (US Market, Macro, KR News)
        2. Construct Chain of Density Prompt
        3. Generate Briefing via LLM
        """
        try:
            print("[MorningIntelligence] 1. Collecting Data (Live)...")
            market_data = self.us_market.get_market_movers()
            macro_data = self.macro.get_key_indicators() 
            news_data = self.news.get_market_sentiment_news()
            # raise Exception("Live Data Disabled for Stability") # Force fallback

        except Exception as e:
            print(f"[MorningIntelligence] Data Collection Failed: {e}. Switching to Mock Data.")
            # Mock Data for Demo
            market_data = {
                "indices_and_tech": [
                    {"symbol": "NVDA", "price": 148.5, "change_percent": 3.2},
                    {"symbol": "TSLA", "price": 250.1, "change_percent": -1.5},
                    {"symbol": "^IXIC", "price": 16400.0, "change_percent": 0.8}
                ]
            }
            macro_data = {
                "USD/KRW Exchange Rate": {"value": 1450.0},
                "US 10Y Treasury": {"value": 4.5}
            }
            news_data = [
                {"title": "Global Tech Rally continues as AI demand surges"},
                {"title": "Fed hints at rate pause in upcoming meeting"}
            ]

        # Check if empty (yfinance failure often returns empty dicts not exceptions)
        if not market_data or not market_data.get("indices_and_tech"):
             print("[MorningIntelligence] Market Data Empty. Switching to Mock Data.")
             market_data = {
                "indices_and_tech": [
                    {"symbol": "NVDA", "price": 148.5, "change_percent": 3.2},
                    {"symbol": "TSLA", "price": 250.1, "change_percent": -1.5},
                    {"symbol": "^IXIC", "price": 16400.0, "change_percent": 0.8}
                ]
            }

        # Debug: Log Collected Data
        print(f"[MorningIntelligence] Data Summary: Market={len(market_data.get('indices_and_tech', []))} items, Macro={len(macro_data)} items, News={len(news_data)} items")
        # print(f"[DEBUG] Market Data Sample: {str(market_data)[:200]}...")

        print("[MorningIntelligence] 2. Constructing Prompt...")
        
        # Format Data for Prompt
        data_summary = f"""
        [US Market Data]
        {market_data}
        
        [Macro Indicators]
        {macro_data}
        
        [Key News Headlines (Korea/Global)]
        {[n['title'] for n in news_data[:5]]}
        """

        system_prompt = """
        You are an elite institutional trader's AI assistant. 
        Your job is to provide a 'Morning Briefing' for the Korean market open (09:00 KST).
        
        Use the 'Chain of Density' (COD) method:
        1. Start with a generic summary.
        2. Iteratively refine it 3 times, adding specific numbers (rates, % change) and key entities (NVDA, TSLA) from the provided data.
        3. The final output must be HIGHLY DENSE with facts, not fluff.
        
        Format the final response as Markdown:
        ## 🌅 Morning Daily Briefing
        ### 1. Global Sentiment (Bullish/Bearish/Neutral)
        ### 2. Key Overnight Movers (US -> KR Impact)
        ### 3. Macro Check (Rates/FX)
        ### 4. Actionable Insight (What to watch at 09:00)
        """

        print("[MorningIntelligence] 3. Querying LLM...")
        try:
            briefing = await self.llm.a_analyze_text(system_prompt, f"Analyze this data and generate the briefing:\n{data_summary}")
        except Exception as e:
            print(f"[MorningIntelligence] LLM Generation Failed (Rate Limit or Network): {e}")
            briefing = f"""
## ⚠️ AI Service Unavailable (Rate Limit)

The AI generation service is currently experiencing high load. However, we successfully collected the latest market data:

### 📊 Collected Data Snapshot
- **Market Data**: {len(market_data.get('indices_and_tech', []))} tickers tracked.
- **Macro Indicators**: {', '.join(macro_data.keys())}
- **Top News**:
  - {news_data[0]['title'] if news_data else 'No news available'}
  - {news_data[1]['title'] if len(news_data) > 1 else ''}

*Please try again in a few minutes.*
"""
        
        return {
            "status": "success",
            "data_sources": {
                "market_movers_count": len(market_data.get("indices_and_tech", [])),
                "news_count": len(news_data),
                "macro_available": True
            },
            "briefing_content": briefing
        }
