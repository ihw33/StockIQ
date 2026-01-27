import feedparser
from typing import List, Dict
import ssl

# Fix for some RSS feed SSL errors
if hasattr(ssl, '_create_unverified_context'):
    ssl._create_default_https_context = ssl._create_unverified_context

class NewsCollector:
    def __init__(self):
        self.feeds = {
            "hankyung_finance": "https://www.hankyung.com/feed/finance",
            "maekyung_economy": "https://www.mk.co.kr/rss/30000001/"
        }

    def get_market_sentiment_news(self) -> List[Dict]:
        """
        Collects headlines from major economic dailies to gauge mass sentiment.
        """
        all_news = []
        
        for source, url in self.feeds.items():
            feed = feedparser.parse(url)
            for entry in feed.entries[:10]: # Limit to top 10 latest
                all_news.append({
                    "source": source,
                    "title": entry.title,
                    "link": entry.link,
                    "published": entry.published if 'published' in entry else None
                })
        
        return all_news
