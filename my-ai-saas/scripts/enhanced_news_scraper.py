"""
Enhanced Multi-Source News Scraper with Multimedia Support
Implements comprehensive news aggregation with global sources and multimedia extraction
"""

import os
import json
import asyncio
import aiohttp
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
import time
import logging
from dataclasses import dataclass, asdict
import feedparser
from bs4 import BeautifulSoup
import uuid
import re
import sqlite3
from urllib.parse import urljoin, urlparse
import yt_dlp
from newspaper import Article
import hashlib
from playwright.async_api import async_playwright
from fake_useragent import UserAgent
import snscrape.modules.twitter as sntwitter
from apscheduler.schedulers.blocking import BlockingScheduler
import warnings
warnings.filterwarnings("ignore")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class EnhancedNewsArticle:
    id: str
    title: str
    summary: str
    url: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    youtube_url: Optional[str] = None
    category: str = "General"
    source: str = "Unknown"
    published_at: str = None
    quality_score: int = 0
    content_hash: str = None

class EnhancedMultimediaExtractor:
    """Advanced multimedia extraction with multiple sources"""
    
    def __init__(self):
        self.ua = UserAgent()
        
    def extract_youtube_videos(self, soup: BeautifulSoup, text: str) -> List[str]:
        """Extract YouTube video URLs from HTML and text"""
        youtube_urls = []
        
        # YouTube patterns
        patterns = [
            r'youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
            r'youtu\.be/([a-zA-Z0-9_-]+)',
            r'youtube\.com/embed/([a-zA-Z0-9_-]+)'
        ]
        
        # Check iframes
        for iframe in soup.find_all('iframe'):
            src = iframe.get('src', '')
            for pattern in patterns:
                match = re.search(pattern, src)
                if match:
                    video_id = match.group(1)
                    youtube_urls.append(f"https://www.youtube.com/watch?v={video_id}")
                    break
        
        # Check text content
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for video_id in matches:
                url = f"https://www.youtube.com/watch?v={video_id}"
                if url not in youtube_urls:
                    youtube_urls.append(url)
        
        return youtube_urls[:3]  # Limit to 3 videos
    
    def extract_best_image(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        """Extract the best quality image from article"""
        
        # Priority order for image extraction
        selectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'article img',
            '.hero-image img',
            '.featured-image img',
            '.article-image img',
            '.content img',
            'img[class*="featured"]',
            'img[class*="hero"]'
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            for elem in elements:
                img_url = elem.get('content') or elem.get('src') or elem.get('data-src')
                if img_url and self._is_high_quality_image(img_url):
                    return self._resolve_url(img_url, base_url)
        
        return None
    
    def extract_videos(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        """Extract video URLs (non-YouTube)"""
        
        # Look for video tags
        for video in soup.find_all('video'):
            src = video.get('src')
            if src:
                return self._resolve_url(src, base_url)
            
            # Check source tags within video
            for source in video.find_all('source'):
                src = source.get('src')
                if src:
                    return self._resolve_url(src, base_url)
        
        return None
    
    def _is_high_quality_image(self, url: str) -> bool:
        """Check if image URL is high quality"""
        if not url or url.startswith('data:'):
            return False
        
        # Skip tracking pixels and small images
        skip_patterns = ['1x1', 'pixel', 'tracking', 'blank', 'spacer']
        for pattern in skip_patterns:
            if pattern in url.lower():
                return False
        
        # Check for image extensions
        image_exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        return any(ext in url.lower() for ext in image_exts) or 'image' in url.lower()
    
    def _resolve_url(self, url: str, base_url: str) -> str:
        """Resolve relative URLs"""
        if url.startswith('http'):
            return url
        return urljoin(base_url, url)

class EnhancedNewsScraper:
    """Main scraper class with multiple source support"""
    
    def __init__(self, cache_dir: str = "./data"):
        self.cache_dir = cache_dir
        self.db_path = os.path.join(cache_dir, "enhanced_news.db")
        self.multimedia_extractor = EnhancedMultimediaExtractor()
        self.ua = UserAgent()
        self.session = None
        self.ensure_cache_dir()
        self.init_database()
        
        # Browser headers
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive"
        }
        
        # Enhanced source list
        self.rss_sources = {
            # Global Aggregators
            "Google News": "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
            "Yahoo News": "https://news.yahoo.com/rss/",
            "Bing News": "https://www.bing.com/news/search?q=news&format=rss",
            
            # Reputable Sources
            "BBC World": "http://feeds.bbci.co.uk/news/world/rss.xml",
            "BBC Technology": "http://feeds.bbci.co.uk/news/technology/rss.xml",
            "BBC Business": "http://feeds.bbci.co.uk/news/business/rss.xml",
            "Reuters World": "https://feeds.reuters.com/reuters/worldNews",
            "Reuters Technology": "https://feeds.reuters.com/reuters/technologyNews",
            "AP News": "https://feeds.apnews.com/rss/apf-topnews",
            "The Guardian": "https://www.theguardian.com/world/rss",
            "CNN World": "http://rss.cnn.com/rss/edition.rss",
            "CNN Tech": "http://rss.cnn.com/rss/edition_technology.rss",
            
            # Tech & Business
            "TechCrunch": "https://techcrunch.com/feed/",
            "Wired": "https://www.wired.com/feed/rss",
            "Ars Technica": "http://feeds.arstechnica.com/arstechnica/index",
            "The Verge": "https://www.theverge.com/rss/index.xml",
            "Hacker News": "https://hnrss.org/frontpage",
            
            # Sports & Entertainment
            "ESPN": "https://www.espn.com/espn/rss/news",
            "BBC Sports": "http://feeds.bbci.co.uk/sport/rss.xml",
            
            # Science & Health
            "BBC Science": "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
            "National Geographic": "https://www.nationalgeographic.com/pages/feed/",
            
            # Reddit
            "Reddit WorldNews": "https://www.reddit.com/r/worldnews/.rss",
            "Reddit News": "https://www.reddit.com/r/news/.rss",
            "Reddit Technology": "https://www.reddit.com/r/technology/.rss"
        }
        
        # Categories mapping
        self.category_mapping = {
            "technology": ["tech", "technolog", "digital", "ai", "cyber"],
            "business": ["business", "econom", "finance", "market", "trade"],
            "sports": ["sport", "football", "basketball", "soccer", "olympics"],
            "health": ["health", "medic", "disease", "virus", "vaccine"],
            "science": ["science", "research", "study", "discover", "climate"],
            "politics": ["politic", "election", "government", "president", "congress"],
            "entertainment": ["entertainment", "celebrity", "movie", "music", "award"]
        }
    
    def ensure_cache_dir(self):
        """Ensure cache directory exists"""
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def init_database(self):
        """Initialize enhanced database schema"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS news_articles (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        summary TEXT,
                        url TEXT UNIQUE NOT NULL,
                        image_url TEXT,
                        video_url TEXT,
                        youtube_url TEXT,
                        category TEXT,
                        source TEXT,
                        published_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        quality_score INTEGER DEFAULT 0,
                        content_hash TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create performance indexes
                conn.execute('CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category)')
                conn.execute('CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC)')
                conn.execute('CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source)')
                conn.execute('CREATE INDEX IF NOT EXISTS idx_news_hash ON news_articles(content_hash)')
                
                logger.info("Enhanced database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
    
    async def fetch_with_playwright(self, url: str) -> Optional[str]:
        """Fetch content from JavaScript-heavy sites using Playwright"""
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle")
                content = await page.content()
                await browser.close()
                return content
        except Exception as e:
            logger.error(f"Playwright fetch failed for {url}: {e}")
            return None
    
    def fetch_rss_feed(self, source_name: str, rss_url: str) -> List[EnhancedNewsArticle]:
        """Fetch articles from RSS feed"""
        articles = []
        
        try:
            logger.info(f"Fetching RSS from {source_name}: {rss_url}")
            
            # Parse RSS feed
            feed = feedparser.parse(rss_url)
            
            if feed.bozo:
                logger.warning(f"RSS parsing issues for {source_name}: {feed.bozo_exception}")
            
            for entry in feed.entries[:10]:  # Limit per source
                try:
                    url = getattr(entry, 'link', '')
                    title = getattr(entry, 'title', 'No Title')
                    
                    if not url or self.article_exists_by_url(url):
                        continue
                    
                    # Extract summary
                    summary = ''
                    if hasattr(entry, 'summary'):
                        soup = BeautifulSoup(entry.summary, 'html.parser')
                        summary = soup.get_text().strip()[:300]
                    
                    # Determine category
                    category = self.determine_category(title + ' ' + summary)
                    
                    # Try to fetch full article
                    article_data = self.fetch_full_article(url)
                    
                    # Create article object
                    article = EnhancedNewsArticle(
                        id=str(uuid.uuid4()),
                        title=title,
                        summary=summary or article_data.get('summary', ''),
                        url=url,
                        image_url=article_data.get('image_url'),
                        video_url=article_data.get('video_url'),
                        youtube_url=article_data.get('youtube_url'),
                        category=category,
                        source=source_name,
                        published_at=self.parse_date(entry),
                        quality_score=self.calculate_quality_score(title, summary, article_data),
                        content_hash=self.generate_content_hash(title, url)
                    )
                    
                    if article.quality_score >= 3:  # Quality threshold
                        articles.append(article)
                    
                except Exception as e:
                    logger.error(f"Error processing article from {source_name}: {e}")
                    continue
            
            logger.info(f"Fetched {len(articles)} quality articles from {source_name}")
            
        except Exception as e:
            logger.error(f"Error fetching RSS from {source_name}: {e}")
        
        return articles
    
    def fetch_full_article(self, url: str) -> Dict[str, Any]:
        """Fetch full article content with multimedia"""
        try:
            # Use newspaper for content extraction
            article = Article(url)
            article.download()
            article.parse()
            
            # Parse HTML for multimedia
            soup = BeautifulSoup(article.html, 'lxml')
            
            # Extract multimedia
            image_url = self.multimedia_extractor.extract_best_image(soup, url)
            video_url = self.multimedia_extractor.extract_videos(soup, url)
            youtube_urls = self.multimedia_extractor.extract_youtube_videos(soup, article.text)
            
            return {
                'summary': article.summary[:300] if article.summary else '',
                'image_url': image_url or article.top_image,
                'video_url': video_url,
                'youtube_url': youtube_urls[0] if youtube_urls else None
            }
            
        except Exception as e:
            logger.debug(f"Error fetching full article from {url}: {e}")
            return {}
    
    def determine_category(self, text: str) -> str:
        """Determine article category based on content"""
        text_lower = text.lower()
        
        for category, keywords in self.category_mapping.items():
            if any(keyword in text_lower for keyword in keywords):
                return category.title()
        
        return "General"
    
    def calculate_quality_score(self, title: str, summary: str, article_data: Dict) -> int:
        """Calculate article quality score (0-10)"""
        score = 0
        
        # Basic content quality
        if title and len(title) > 15:
            score += 2
        if summary and len(summary) > 50:
            score += 2
        
        # Multimedia content
        if article_data.get('image_url'):
            score += 2
        if article_data.get('video_url'):
            score += 2
        if article_data.get('youtube_url'):
            score += 1
        
        # Content quality indicators
        if any(word in title.lower() for word in ['breaking', 'exclusive', 'live', 'update']):
            score += 1
        
        return min(score, 10)
    
    def parse_date(self, entry) -> str:
        """Parse publication date from RSS entry"""
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            try:
                return datetime(*entry.published_parsed[:6]).isoformat()
            except:
                pass
        return datetime.now().isoformat()
    
    def generate_content_hash(self, title: str, url: str) -> str:
        """Generate content hash for deduplication"""
        content = f"{title}{url}".encode('utf-8')
        return hashlib.md5(content).hexdigest()
    
    def article_exists_by_url(self, url: str) -> bool:
        """Check if article exists by URL"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('SELECT id FROM news_articles WHERE url = ?', (url,))
                return cursor.fetchone() is not None
        except:
            return False
    
    def article_exists_by_hash(self, content_hash: str) -> bool:
        """Check if article exists by content hash"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('SELECT id FROM news_articles WHERE content_hash = ?', (content_hash,))
                return cursor.fetchone() is not None
        except:
            return False
    
    def save_articles(self, articles: List[EnhancedNewsArticle]):
        """Save articles to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                saved_count = 0
                for article in articles:
                    # Skip duplicates
                    if self.article_exists_by_hash(article.content_hash):
                        continue
                    
                    conn.execute('''
                        INSERT OR REPLACE INTO news_articles 
                        (id, title, summary, url, image_url, video_url, youtube_url, 
                         category, source, published_at, quality_score, content_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        article.id, article.title, article.summary, article.url,
                        article.image_url, article.video_url, article.youtube_url,
                        article.category, article.source, article.published_at,
                        article.quality_score, article.content_hash
                    ))
                    saved_count += 1
                
                conn.commit()
                logger.info(f"Saved {saved_count} new articles to database")
                
        except Exception as e:
            logger.error(f"Error saving articles: {e}")
    
    async def scrape_twitter_trending(self) -> List[EnhancedNewsArticle]:
        """Scrape trending news from Twitter/X"""
        articles = []
        try:
            # Get trending news tweets
            search_terms = ["breaking news", "just in", "developing"]
            
            for term in search_terms:
                tweets = sntwitter.TwitterSearchScraper(f"{term} -filter:retweets").get_items()
                
                count = 0
                for tweet in tweets:
                    if count >= 5:  # Limit per search term
                        break
                    
                    if len(tweet.rawContent) > 50:  # Quality filter
                        article = EnhancedNewsArticle(
                            id=str(uuid.uuid4()),
                            title=tweet.rawContent[:100] + "..." if len(tweet.rawContent) > 100 else tweet.rawContent,
                            summary=tweet.rawContent,
                            url=f"https://twitter.com/user/status/{tweet.id}",
                            category="Breaking",
                            source="Twitter",
                            published_at=tweet.date.isoformat() if tweet.date else datetime.now().isoformat(),
                            quality_score=5,
                            content_hash=self.generate_content_hash(tweet.rawContent, str(tweet.id))
                        )
                        articles.append(article)
                        count += 1
            
            logger.info(f"Scraped {len(articles)} trending tweets")
            
        except Exception as e:
            logger.error(f"Error scraping Twitter: {e}")
        
        return articles
    
    def get_daily_briefing(self) -> Dict[str, Any]:
        """Generate daily briefing from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Get recent high-quality articles
                cursor = conn.execute('''
                    SELECT * FROM news_articles 
                    WHERE published_at >= date('now', '-1 day')
                    ORDER BY quality_score DESC, published_at DESC
                    LIMIT 100
                ''')
                
                articles = []
                categories = set()
                sources = set()
                
                for row in cursor.fetchall():
                    article_data = {
                        'id': row[0],
                        'title': row[1],
                        'summary': row[2],
                        'url': row[3],
                        'image_url': row[4],
                        'video_url': row[5],
                        'youtube_url': row[6],
                        'category': row[7],
                        'source': row[8],
                        'published_at': row[9],
                        'quality_score': row[10]
                    }
                    
                    articles.append(article_data)
                    categories.add(row[7] or "General")
                    sources.add(row[8] or "Unknown")
                
                briefing = {
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "articles": articles,
                    "categories": sorted(list(categories)),
                    "total_articles": len(articles),
                    "sources": sorted(list(sources)),
                    "last_updated": datetime.now().isoformat(),
                    "multimedia_stats": {
                        "with_images": len([a for a in articles if a.get('image_url')]),
                        "with_videos": len([a for a in articles if a.get('video_url')]),
                        "with_youtube": len([a for a in articles if a.get('youtube_url')])
                    }
                }
                
                return briefing
                
        except Exception as e:
            logger.error(f"Error generating daily briefing: {e}")
            return {"date": datetime.now().strftime("%Y-%m-%d"), "articles": []}
    
    def cleanup_old_articles(self, days_to_keep: int = 7):
        """Remove old articles"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    DELETE FROM news_articles 
                    WHERE published_at < date('now', '-{} day')
                '''.format(days_to_keep))
                
                deleted = conn.total_changes
                logger.info(f"Cleaned up {deleted} old articles")
                
        except Exception as e:
            logger.error(f"Error cleaning up: {e}")
    
    async def run_full_scrape(self):
        """Run complete scraping process"""
        logger.info("Starting enhanced news scraping...")
        
        try:
            # Clean up old articles
            self.cleanup_old_articles()
            
            all_articles = []
            
            # Scrape RSS sources
            for source_name, rss_url in self.rss_sources.items():
                try:
                    articles = self.fetch_rss_feed(source_name, rss_url)
                    all_articles.extend(articles)
                    
                    # Rate limiting
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Error scraping {source_name}: {e}")
                    continue
            
            # Scrape Twitter trending (if available)
            try:
                twitter_articles = await self.scrape_twitter_trending()
                all_articles.extend(twitter_articles)
            except Exception as e:
                logger.warning(f"Twitter scraping unavailable: {e}")
            
            # Save all articles
            self.save_articles(all_articles)
            
            # Generate daily briefing
            briefing = self.get_daily_briefing()
            
            # Save briefing to cache
            cache_file = os.path.join(self.cache_dir, "daily-briefing.json")
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(briefing, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Enhanced scraping completed!")
            logger.info(f"Total articles: {briefing['total_articles']}")
            logger.info(f"With images: {briefing['multimedia_stats']['with_images']}")
            logger.info(f"With videos: {briefing['multimedia_stats']['with_videos']}")
            logger.info(f"With YouTube: {briefing['multimedia_stats']['with_youtube']}")
            
        except Exception as e:
            logger.error(f"Enhanced scraping failed: {e}")
            raise

def main():
    """Main function to run enhanced scraper"""
    scraper = EnhancedNewsScraper()
    asyncio.run(scraper.run_full_scrape())

if __name__ == "__main__":
    main()
