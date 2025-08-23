"""
Enhanced News Scraper System for 101World
Fetches daily news with multimedia content (images, videos) from multiple sources
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
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
from fake_useragent import UserAgent

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
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    video_thumbnail: Optional[str] = None
    video_platform: Optional[str] = None  # youtube, vimeo, etc.
    content_full: Optional[str] = None
    author: Optional[str] = None
    tags: List[str] = None

class NewsSource:
    def __init__(self, name: str, rss_url: str = None, base_url: str = None, category: str = "General", homepage_url: str = None):
        self.name = name
        self.rss_url = rss_url
        self.base_url = base_url
        self.homepage_url = homepage_url
        self.category = category

class MultimediaExtractor:
    """Extract images and videos from articles"""
    
    def __init__(self):
        self.ua = UserAgent()
        
    def extract_og_image(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        """Extract Open Graph image"""
        try:
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                return self._resolve_url(og_image['content'], base_url)
        except Exception as e:
            logger.debug(f"Error extracting OG image: {e}")
        return None
    
    def extract_first_content_image(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        """Extract first meaningful image from article content"""
        try:
            # Look for images in article content
            content_selectors = [
                'article img', '.content img', '.post-content img', 
                '.article-body img', '.entry-content img', 'main img'
            ]
            
            for selector in content_selectors:
                imgs = soup.select(selector)
                for img in imgs:
                    src = img.get('src') or img.get('data-src')
                    if src and self._is_valid_image(src):
                        return self._resolve_url(src, base_url)
            
            # Fallback: any img with reasonable size
            for img in soup.find_all('img'):
                src = img.get('src') or img.get('data-src')
                if src and self._is_valid_image(src):
                    # Skip small images (likely icons/logos)
                    width = img.get('width')
                    height = img.get('height')
                    if width and height:
                        try:
                            if int(width) < 100 or int(height) < 100:
                                continue
                        except:
                            pass
                    return self._resolve_url(src, base_url)
                    
        except Exception as e:
            logger.debug(f"Error extracting content image: {e}")
        return None
    
    def extract_videos(self, soup: BeautifulSoup, article_url: str) -> List[Dict[str, str]]:
        """Extract video URLs and metadata"""
        videos = []
        
        try:
            # YouTube videos
            youtube_patterns = [
                r'youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
                r'youtu\.be/([a-zA-Z0-9_-]+)',
                r'youtube\.com/embed/([a-zA-Z0-9_-]+)'
            ]
            
            # Check iframes first
            for iframe in soup.find_all('iframe'):
                src = iframe.get('src', '')
                for pattern in youtube_patterns:
                    match = re.search(pattern, src)
                    if match:
                        video_id = match.group(1)
                        videos.append({
                            'platform': 'youtube',
                            'video_id': video_id,
                            'url': f"https://www.youtube.com/watch?v={video_id}",
                            'embed_url': f"https://www.youtube.com/embed/{video_id}",
                            'thumbnail': f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                        })
                        break
            
            # Check for Vimeo
            vimeo_iframes = soup.find_all('iframe', src=re.compile(r'vimeo\.com'))
            for iframe in vimeo_iframes:
                src = iframe.get('src', '')
                match = re.search(r'vimeo\.com/video/(\d+)', src)
                if match:
                    video_id = match.group(1)
                    videos.append({
                        'platform': 'vimeo',
                        'video_id': video_id,
                        'url': f"https://vimeo.com/{video_id}",
                        'embed_url': f"https://player.vimeo.com/video/{video_id}"
                    })
            
            # Check article text for video links
            text_content = soup.get_text()
            for pattern in youtube_patterns:
                matches = re.findall(pattern, text_content)
                for video_id in matches:
                    # Avoid duplicates
                    if not any(v.get('video_id') == video_id for v in videos):
                        videos.append({
                            'platform': 'youtube',
                            'video_id': video_id,
                            'url': f"https://www.youtube.com/watch?v={video_id}",
                            'embed_url': f"https://www.youtube.com/embed/{video_id}",
                            'thumbnail': f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                        })
            
        except Exception as e:
            logger.debug(f"Error extracting videos: {e}")
        
        return videos[:3]  # Limit to 3 videos per article
    
    def _resolve_url(self, url: str, base_url: str) -> str:
        """Resolve relative URLs to absolute"""
        if url.startswith('http'):
            return url
        return urljoin(base_url, url)
    
    def _is_valid_image(self, url: str) -> bool:
        """Check if URL looks like a valid image"""
        if not url:
            return False
        
        # Skip base64 images, tracking pixels, etc.
        if url.startswith('data:') or 'pixel' in url.lower() or '1x1' in url:
            return False
            
        # Check for image extensions
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
        url_lower = url.lower()
        
        return any(ext in url_lower for ext in image_extensions) or 'image' in url_lower

class EnhancedNewsScraper:
    def __init__(self, cache_dir: str = "./data"):
        self.cache_dir = cache_dir
        self.db_path = os.path.join(cache_dir, "news_cache.db")
        self.multimedia_extractor = MultimediaExtractor()
        self.ua = UserAgent()
        self.ensure_cache_dir()
        self.init_database()
        
        # Enhanced news sources with multimedia focus
        self.sources = [
            NewsSource("BBC", "http://feeds.bbci.co.uk/news/rss.xml", "https://www.bbc.com", "General"),
            NewsSource("BBC Tech", "http://feeds.bbci.co.uk/news/technology/rss.xml", "https://www.bbc.com", "Technology"),
            NewsSource("BBC Business", "http://feeds.bbci.co.uk/news/business/rss.xml", "https://www.bbc.com", "Business"),
            NewsSource("CNN", "http://rss.cnn.com/rss/edition.rss", "https://www.cnn.com", "General"),
            NewsSource("TechCrunch", "https://techcrunch.com/feed/", "https://techcrunch.com", "Technology"),
            NewsSource("Reuters", "https://www.reuters.com/tools/rss", "https://www.reuters.com", "General"),
            NewsSource("ESPN", "https://www.espn.com/espn/rss/news", "https://www.espn.com", "Sports"),
            NewsSource("BBC Sports", "http://feeds.bbci.co.uk/sport/rss.xml", "https://www.bbc.com", "Sports"),
            NewsSource("BBC Health", "http://feeds.bbci.co.uk/news/health/rss.xml", "https://www.bbc.com", "Health"),
            NewsSource("National Geographic", "https://www.nationalgeographic.com/pages/feed/", "https://www.nationalgeographic.com", "Environment"),
        ]
        
        # Request headers to avoid being blocked
        self.headers = {
            'User-Agent': self.ua.random,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
    
    def ensure_cache_dir(self):
        """Ensure cache directory exists"""
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def init_database(self):
        """Initialize SQLite database for caching"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS articles (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        snippet TEXT,
                        url TEXT UNIQUE NOT NULL,
                        source TEXT,
                        category TEXT,
                        publish_date TEXT,
                        image_url TEXT,
                        video_url TEXT,
                        video_thumbnail TEXT,
                        video_platform TEXT,
                        content_full TEXT,
                        author TEXT,
                        tags TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        quality_score INTEGER DEFAULT 0
                    )
                ''')
                
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_publish_date ON articles(publish_date);
                ''')
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_category ON articles(category);
                ''')
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_source ON articles(source);
                ''')
                
                logger.info("Database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
    
    def fetch_article_content(self, url: str, source_name: str) -> Optional[NewsArticle]:
        """Fetch and parse full article content using newspaper3k"""
        try:
            # Use newspaper3k for better content extraction
            article = Article(url)
            article.set_config(headers=self.headers)
            article.download()
            article.parse()
            
            # Extract multimedia content from HTML
            soup = BeautifulSoup(article.html, 'lxml')
            
            # Get the best image
            image_url = None
            if article.top_image:
                image_url = article.top_image
            else:
                image_url = self.multimedia_extractor.extract_og_image(soup, url)
                if not image_url:
                    image_url = self.multimedia_extractor.extract_first_content_image(soup, url)
            
            # Extract videos
            videos = self.multimedia_extractor.extract_videos(soup, url)
            video_info = videos[0] if videos else {}
            
            # Create article object
            news_article = NewsArticle(
                id=str(uuid.uuid4()),
                title=article.title or "No Title",
                snippet=article.summary[:300] + "..." if len(article.summary) > 300 else article.summary,
                url=url,
                source=source_name,
                category="General",  # Will be set by caller
                publish_date=article.publish_date.isoformat() if article.publish_date else datetime.now().isoformat(),
                image_url=image_url,
                video_url=video_info.get('url'),
                video_thumbnail=video_info.get('thumbnail'),
                video_platform=video_info.get('platform'),
                content_full=article.text,
                author=', '.join(article.authors) if article.authors else None,
                tags=article.keywords[:10] if article.keywords else []
            )
            
            return news_article
            
        except Exception as e:
            logger.error(f"Error fetching article content from {url}: {e}")
            return None
    
    def fetch_rss_articles(self, source: NewsSource) -> List[NewsArticle]:
        """Fetch articles from RSS feed with enhanced content extraction"""
        articles = []
        
        try:
            logger.info(f"Fetching RSS from {source.name}: {source.rss_url}")
            
            # Parse RSS feed
            feed = feedparser.parse(source.rss_url)
            
            if feed.bozo:
                logger.warning(f"RSS feed parsing issues for {source.name}: {feed.bozo_exception}")
            
            for entry in feed.entries[:8]:  # Limit to 8 articles per source
                try:
                    url = getattr(entry, 'link', '')
                    if not url:
                        continue
                    
                    # Check if article already exists in database
                    if self.article_exists(url):
                        logger.debug(f"Article already exists: {url}")
                        continue
                    
                    # Try to fetch full article content
                    article = self.fetch_article_content(url, source.name)
                    
                    if not article:
                        # Fallback to RSS data
                        title = getattr(entry, 'title', 'No Title')
                        snippet = ''
                        if hasattr(entry, 'summary'):
                            soup = BeautifulSoup(entry.summary, 'html.parser')
                            snippet = soup.get_text().strip()
                        
                        if len(snippet) > 300:
                            snippet = snippet[:297] + "..."
                        
                        publish_date = datetime.now().isoformat()
                        if hasattr(entry, 'published_parsed') and entry.published_parsed:
                            try:
                                publish_date = datetime(*entry.published_parsed[:6]).isoformat()
                            except:
                                pass
                        
                        article = NewsArticle(
                            id=str(uuid.uuid4()),
                            title=title,
                            snippet=snippet,
                            url=url,
                            source=source.name,
                            category=source.category,
                            publish_date=publish_date
                        )
                    
                    # Set category from source
                    article.category = source.category
                    
                    # Calculate quality score
                    quality_score = self.calculate_quality_score(article)
                    
                    # Only include high-quality articles
                    if quality_score >= 3:
                        articles.append(article)
                        logger.debug(f"Added article: {article.title[:50]}... (Score: {quality_score})")
                    
                except Exception as e:
                    logger.error(f"Error processing article from {source.name}: {e}")
                    continue
            
            logger.info(f"Fetched {len(articles)} high-quality articles from {source.name}")
            
        except Exception as e:
            logger.error(f"Error fetching RSS from {source.name}: {e}")
        
        return articles
    
    def calculate_quality_score(self, article: NewsArticle) -> int:
        """Calculate article quality score (0-10)"""
        score = 0
        
        # Title quality
        if article.title and len(article.title) > 10:
            score += 2
        
        # Snippet quality
        if article.snippet and len(article.snippet) > 50:
            score += 2
        
        # Has image
        if article.image_url:
            score += 2
        
        # Has video
        if article.video_url:
            score += 2
        
        # Full content available
        if article.content_full and len(article.content_full) > 200:
            score += 1
        
        # Author information
        if article.author:
            score += 1
        
        return min(score, 10)
    
    def article_exists(self, url: str) -> bool:
        """Check if article already exists in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('SELECT id FROM articles WHERE url = ?', (url,))
                return cursor.fetchone() is not None
        except:
            return False
    
    def save_articles_to_db(self, articles: List[NewsArticle]):
        """Save articles to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                for article in articles:
                    quality_score = self.calculate_quality_score(article)
                    
                    conn.execute('''
                        INSERT OR REPLACE INTO articles 
                        (id, title, snippet, url, source, category, publish_date, 
                         image_url, video_url, video_thumbnail, video_platform, 
                         content_full, author, tags, quality_score)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        article.id, article.title, article.snippet, article.url,
                        article.source, article.category, article.publish_date,
                        article.image_url, article.video_url, article.video_thumbnail,
                        article.video_platform, article.content_full, article.author,
                        json.dumps(article.tags) if article.tags else None, quality_score
                    ))
                
                conn.commit()
                logger.info(f"Saved {len(articles)} articles to database")
                
        except Exception as e:
            logger.error(f"Error saving articles to database: {e}")
    
    def scrape_all_sources(self) -> List[NewsArticle]:
        """Scrape articles from all configured sources"""
        all_articles = []
        
        for source in self.sources:
            try:
                articles = self.fetch_rss_articles(source)
                all_articles.extend(articles)
                
                # Add delay between requests to be respectful
                time.sleep(2)
                
            except Exception as e:
                logger.error(f"Error scraping {source.name}: {e}")
                continue
        
        # Save to database
        if all_articles:
            self.save_articles_to_db(all_articles)
        
        logger.info(f"Scraped {len(all_articles)} total articles from {len(self.sources)} sources")
        return all_articles
    
    def get_daily_brief_from_db(self) -> Dict[str, Any]:
        """Get daily briefing from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Get articles from last 24 hours, ordered by quality and recency
                cursor = conn.execute('''
                    SELECT * FROM articles 
                    WHERE publish_date >= date('now', '-1 day')
                    ORDER BY quality_score DESC, publish_date DESC
                    LIMIT 50
                ''')
                
                articles = []
                categories = set()
                sources = set()
                
                for row in cursor.fetchall():
                    article_data = {
                        'id': row[0],
                        'title': row[1],
                        'snippet': row[2],
                        'url': row[3],
                        'source': row[4],
                        'category': row[5],
                        'publish_date': row[6],
                        'image_url': row[7],
                        'video_url': row[8],
                        'video_thumbnail': row[9],
                        'video_platform': row[10],
                        'author': row[12],
                        'tags': json.loads(row[13]) if row[13] else []
                    }
                    
                    articles.append(article_data)
                    categories.add(row[5])
                    sources.add(row[4])
                
                brief = {
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "articles": articles,
                    "categories": sorted(list(categories)),
                    "total_articles": len(articles),
                    "sources": sorted(list(sources)),
                    "last_updated": datetime.now().isoformat(),
                    "multimedia_count": {
                        "with_images": len([a for a in articles if a.get('image_url')]),
                        "with_videos": len([a for a in articles if a.get('video_url')])
                    }
                }
                
                return brief
                
        except Exception as e:
            logger.error(f"Error getting daily brief from database: {e}")
            return {"date": datetime.now().strftime("%Y-%m-%d"), "articles": [], "categories": []}
    
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
    
    def cleanup_old_articles(self, days_to_keep: int = 7):
        """Remove articles older than specified days"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    DELETE FROM articles 
                    WHERE publish_date < date('now', '-{} day')
                '''.format(days_to_keep))
                
                deleted = conn.total_changes
                logger.info(f"Cleaned up {deleted} old articles")
                
        except Exception as e:
            logger.error(f"Error cleaning up old articles: {e}")
    
    def run_daily_scrape(self):
        """Run the complete daily scraping process"""
        logger.info("Starting enhanced daily news scrape with multimedia extraction...")
        
        try:
            # Clean up old articles first
            self.cleanup_old_articles()
            
            # Scrape all sources
            articles = self.scrape_all_sources()
            
            # Get daily briefing from database
            brief = self.get_daily_brief_from_db()
            
            # Save to cache
            self.save_daily_brief(brief)
            
            logger.info(f"Enhanced daily scrape completed successfully.")
            logger.info(f"Total articles: {brief['total_articles']}")
            logger.info(f"Articles with images: {brief['multimedia_count']['with_images']}")
            logger.info(f"Articles with videos: {brief['multimedia_count']['with_videos']}")
            
        except Exception as e:
            logger.error(f"Enhanced daily scrape failed: {e}")
            raise

def main():
    """Main function to run the enhanced scraper"""
    scraper = EnhancedNewsScraper()
    scraper.run_daily_scrape()

if __name__ == "__main__":
    main()
