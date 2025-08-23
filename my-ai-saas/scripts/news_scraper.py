"""
News Scraper System for 101World
Fetches daily news from multiple sources and caches them for fast access
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Any
import time
import logging
from dataclasses import dataclass, asdict
import feedparser
from bs4 import BeautifulSoup
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class NewsArticle:
    id: str
    title: str
    snippet: str
    url: str
    source: str
    category: str
    publish_date: str
    image_url: str = None

class NewsSource:
    def __init__(self, name: str, rss_url: str = None, base_url: str = None, category: str = "General"):
        self.name = name
        self.rss_url = rss_url
        self.base_url = base_url
        self.category = category

class NewsScraper:
    def __init__(self, cache_dir: str = "./data"):
        self.cache_dir = cache_dir
        self.ensure_cache_dir()
        
        # Define news sources
        self.sources = [
            NewsSource("BBC", "http://feeds.bbci.co.uk/news/rss.xml", "https://www.bbc.com", "General"),
            NewsSource("CNN", "http://rss.cnn.com/rss/edition.rss", "https://www.cnn.com", "General"),
            NewsSource("Reuters", "https://www.reuters.com/tools/rss", "https://www.reuters.com", "General"),
            NewsSource("TechCrunch", "https://techcrunch.com/feed/", "https://techcrunch.com", "Technology"),
            NewsSource("BBC Tech", "http://feeds.bbci.co.uk/news/technology/rss.xml", "https://www.bbc.com", "Technology"),
            NewsSource("BBC Business", "http://feeds.bbci.co.uk/news/business/rss.xml", "https://www.bbc.com", "Business"),
            NewsSource("BBC Sports", "http://feeds.bbci.co.uk/sport/rss.xml", "https://www.bbc.com", "Sports"),
            NewsSource("BBC Health", "http://feeds.bbci.co.uk/news/health/rss.xml", "https://www.bbc.com", "Health"),
        ]
        
        # Request headers to avoid being blocked
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def ensure_cache_dir(self):
        """Ensure cache directory exists"""
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def fetch_rss_articles(self, source: NewsSource) -> List[NewsArticle]:
        """Fetch articles from RSS feed"""
        articles = []
        
        try:
            logger.info(f"Fetching RSS from {source.name}: {source.rss_url}")
            
            # Parse RSS feed
            feed = feedparser.parse(source.rss_url)
            
            if feed.bozo:
                logger.warning(f"RSS feed parsing issues for {source.name}: {feed.bozo_exception}")
            
            for entry in feed.entries[:10]:  # Limit to 10 articles per source
                try:
                    # Extract article data
                    title = getattr(entry, 'title', 'No Title')
                    link = getattr(entry, 'link', '')
                    
                    # Get snippet from description or summary
                    snippet = ''
                    if hasattr(entry, 'summary'):
                        # Clean HTML tags from summary
                        soup = BeautifulSoup(entry.summary, 'html.parser')
                        snippet = soup.get_text().strip()
                    elif hasattr(entry, 'description'):
                        soup = BeautifulSoup(entry.description, 'html.parser')
                        snippet = soup.get_text().strip()
                    
                    # Limit snippet length
                    if len(snippet) > 300:
                        snippet = snippet[:297] + "..."
                    
                    # Get publish date
                    publish_date = datetime.now().isoformat()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        try:
                            publish_date = datetime(*entry.published_parsed[:6]).isoformat()
                        except:
                            pass
                    
                    # Try to extract image URL
                    image_url = None
                    if hasattr(entry, 'media_content') and entry.media_content:
                        image_url = entry.media_content[0].get('url')
                    elif hasattr(entry, 'enclosures') and entry.enclosures:
                        for enclosure in entry.enclosures:
                            if enclosure.type.startswith('image/'):
                                image_url = enclosure.href
                                break
                    
                    article = NewsArticle(
                        id=str(uuid.uuid4()),
                        title=title,
                        snippet=snippet,
                        url=link,
                        source=source.name,
                        category=source.category,
                        publish_date=publish_date,
                        image_url=image_url
                    )
                    
                    articles.append(article)
                    
                except Exception as e:
                    logger.error(f"Error processing article from {source.name}: {e}")
                    continue
            
            logger.info(f"Fetched {len(articles)} articles from {source.name}")
            
        except Exception as e:
            logger.error(f"Error fetching RSS from {source.name}: {e}")
        
        return articles
    
    def scrape_all_sources(self) -> List[NewsArticle]:
        """Scrape articles from all configured sources"""
        all_articles = []
        
        for source in self.sources:
            try:
                articles = self.fetch_rss_articles(source)
                all_articles.extend(articles)
                
                # Add delay between requests to be respectful
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"Error scraping {source.name}: {e}")
                continue
        
        # Remove duplicates based on URL
        seen_urls = set()
        unique_articles = []
        for article in all_articles:
            if article.url not in seen_urls:
                seen_urls.add(article.url)
                unique_articles.append(article)
        
        logger.info(f"Scraped {len(unique_articles)} unique articles from {len(self.sources)} sources")
        return unique_articles
    
    def create_daily_brief(self, articles: List[NewsArticle]) -> Dict[str, Any]:
        """Create daily briefing structure"""
        categories = list(set(article.category for article in articles))
        
        # Sort articles by publish date (newest first)
        sorted_articles = sorted(articles, key=lambda x: x.publish_date, reverse=True)
        
        brief = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "articles": [asdict(article) for article in sorted_articles],
            "categories": sorted(categories),
            "total_articles": len(articles),
            "sources": list(set(article.source for article in articles)),
            "last_updated": datetime.now().isoformat()
        }
        
        return brief
    
    def save_daily_brief(self, brief: Dict[str, Any]):
        """Save daily briefing to cache file"""
        cache_file = os.path.join(self.cache_dir, "daily-brief.json")
        
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(brief, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Daily briefing saved to {cache_file}")
            
        except Exception as e:
            logger.error(f"Error saving daily briefing: {e}")
            raise
    
    def run_daily_scrape(self):
        """Run the complete daily scraping process"""
        logger.info("Starting daily news scrape...")
        
        try:
            # Scrape all sources
            articles = self.scrape_all_sources()
            
            if not articles:
                logger.warning("No articles were scraped!")
                return
            
            # Create daily briefing
            brief = self.create_daily_brief(articles)
            
            # Save to cache
            self.save_daily_brief(brief)
            
            logger.info(f"Daily scrape completed successfully. {len(articles)} articles cached.")
            
        except Exception as e:
            logger.error(f"Daily scrape failed: {e}")
            raise

def main():
    """Main function to run the scraper"""
    scraper = NewsScraper()
    scraper.run_daily_scrape()

if __name__ == "__main__":
    main()
