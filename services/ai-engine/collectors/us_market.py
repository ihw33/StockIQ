import yfinance as yf
import pandas as pd
from typing import List, Dict

class USMarketCollector:
    def __init__(self):
        pass

    def get_market_movers(self) -> Dict[str, List[Dict]]:
        """
        Fetches US Market Movers (Day's Gainers/Losers/Active) using yfinance.
        Note: yfinance doesn't have a direct 'movers' API for all lists, 
        so we might monitor a specific watchlist or sector ETFs for this MVP.
        For now, we will return the status of major indices and big tech (Magnificent 7).
        """
        tickers = [
            "^IXIC", # Nasdaq
            "^DJI",  # Dow Jones
            "^GSPC", # S&P 500
            "NVDA", "TSLA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AMD", "INTC"
        ]
        
        data = yf.download(tickers, period="1d", progress=False, threads=False)
        
        # Determine the latest date available
        if data.empty:
             return {}

        latest_close = data['Close'].iloc[-1]
        latest_open = data['Open'].iloc[-1]
        
        results = []
        for symbol in tickers:
            try:
                price = latest_close[symbol]
                prev_close = data['Open'][symbol].iloc[-1] # Approximation if no prev close
                # Better: Get ticker info for more details if needed, but slower.
                
                # Calculate change
                change_percent = ((price - prev_close) / prev_close) * 100
                
                results.append({
                    "symbol": symbol,
                    "price": float(price),
                    "change_percent": float(change_percent)
                })
            except Exception as e:
                print(f"Error processing {symbol}: {e}")
                
        return {"indices_and_tech": results}

    def get_market_map_data(self) -> List[Dict]:
        """
        Fetches data for Market Map (Treemap).
        Targeting Top 20 US Stocks for MVP visualization.
        """
        tickers = [
            "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "BRK-B", "LLY", "AVGO",
            "JPM", "XOM", "UNH", "V", "PG", "MA", "JNJ", "HD", "MRK", "COST"
        ]
        
        try:
            # Multi-threaded download is faster
            data = yf.download(tickers, period="2d", group_by="ticker", progress=False, threads=True)
            results = []
            
            for symbol in tickers:
                try:
                    # Handle MultiIndex columns
                    hist = data[symbol]
                    if hist.empty: continue
                    
                    # Calculate change
                    close = hist['Close'].iloc[-1]
                    prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else hist['Open'].iloc[-1]
                    change_pct = ((close - prev_close) / prev_close) * 100
                    
                    # Sector mapping (Static for MVP)
                    sector_map = {
                        "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology", "AVGO": "Technology",
                        "GOOGL": "Communication", "META": "Communication", 
                        "AMZN": "Consumer", "TSLA": "Consumer", "HD": "Consumer", "COST": "Consumer",
                        "BRK-B": "Financial", "JPM": "Financial", "V": "Financial", "MA": "Financial",
                        "LLY": "Healthcare", "UNH": "Healthcare", "JNJ": "Healthcare", "MRK": "Healthcare",
                        "XOM": "Energy", "PG": "Defensive"
                    }
                    
                    results.append({
                        "name": symbol,
                        "size": float(close), # Visualizing by Price as proxy for Market Cap in MVP (yfinance marketCap is slow/unreliable in bulk)
                        "change": float(change_pct),
                        "children": [], # Leaf node
                        "sector": sector_map.get(symbol, "Other")
                    })
                except Exception as e:
                    print(f"Error extracting {symbol}: {e}")
                    continue
            
            # Group by Sector for Recharts Treemap
            sectors = {}
            for stock in results:
                sec = stock['sector']
                if sec not in sectors:
                    sectors[sec] = {"name": sec, "children": []}
                sectors[sec]["children"].append(stock)
                
            return list(sectors.values())
            
        except Exception as e:
            print(f"[USMarketCollector] Map Data Error: {e}")
            return []

    def get_ticker_news(self, symbol: str):
        ticker = yf.Ticker(symbol)
        return ticker.news
