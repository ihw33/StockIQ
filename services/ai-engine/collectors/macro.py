from fredapi import Fred
import os
from datetime import datetime, timedelta

class MacroCollector:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("FRED_API_KEY")
        self.fred = Fred(api_key=self.api_key) if self.api_key else None

    def get_key_indicators(self):
        """
        Fetches key macro indicators: IR (Fed Rate), CPI, Unemployment, KR-US Exchange Rate.
        """
        if not self.fred:
            return {"error": "FRED_API_KEY not configured"}

        indicators = {
            "FEDFUNDS": "US Federal Funds Rate",
            "CPIAUCSL": "US CPI (Consumer Price Index)",
            "UNRATE": "US Unemployment Rate",
            "DEXKOUS": "USD/KRW Exchange Rate"
        }
        
        results = {}
        for series_id, name in indicators.items():
            try:
                # Fetch only the latest observation
                data = self.fred.get_series(series_id, limit=1, sort_order='desc')
                if not data.empty:
                    results[name] = {
                        "value": float(data.iloc[0]),
                        "date": data.index[0].strftime("%Y-%m-%d")
                    }
            except Exception as e:
                print(f"Error fetching {name} from FRED: {e}")
                results[name] = None

        # Fallback/Additional: Use yfinance for real-time rates if FRED is missing
        if not self.fred or results.get("USD/KRW Exchange Rate") is None:
            import yfinance as yf
            print("Attempting to fetch Macro data via Yahoo Finance (Fallback)...")
            try:
                # KRW=X: USD/KRW, ^TNX: 10 Year Treasury, ^VIX: Volatility
                yf_tickers = ["KRW=X", "^TNX", "^VIX"]
                data = yf.download(yf_tickers, period="1d", progress=False, threads=False)
                
                if not data.empty:
                    # Latest Close
                    latest = data['Close'].iloc[-1]
                    
                    results["USD/KRW Exchange Rate"] = {
                        "value": float(latest["KRW=X"]),
                        "source": "Yahoo"
                    }
                    results["US 10Y Treasury"] = {
                        "value": float(latest["^TNX"]),
                        "source": "Yahoo"
                    }
                    results["VIX (Volatility)"] = {
                        "value": float(latest["^VIX"]),
                        "source": "Yahoo"
                    }
            except Exception as e:
                print(f"Yahoo Fallback failed: {e}")

        return results
