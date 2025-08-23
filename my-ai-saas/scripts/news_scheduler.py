"""
News Scraper Scheduler
Handles automated daily news scraping with APScheduler
"""

import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
import signal
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from enhanced_news_scraper import EnhancedNewsScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('news_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NewsScraperScheduler:
    """Scheduler for automated news scraping"""
    
    def __init__(self):
        self.scheduler = BlockingScheduler()
        self.scraper = EnhancedNewsScraper()
        self.setup_signal_handlers()
    
    def setup_signal_handlers(self):
        """Setup graceful shutdown"""
        signal.signal(signal.SIGINT, self.shutdown)
        signal.signal(signal.SIGTERM, self.shutdown)
    
    def shutdown(self, signum, frame):
        """Graceful shutdown"""
        logger.info("Shutting down scheduler...")
        self.scheduler.shutdown()
        sys.exit(0)
    
    def run_scrape_job(self):
        """Job function that runs the scraper"""
        try:
            logger.info("Starting scheduled news scrape...")
            asyncio.run(self.scraper.run_full_scrape())
            logger.info("Scheduled scrape completed successfully")
        except Exception as e:
            logger.error(f"Scheduled scrape failed: {e}")
    
    def run_hourly_update(self):
        """Lighter hourly update"""
        try:
            logger.info("Running hourly news update...")
            # Run a lighter version - just RSS feeds, no Twitter
            all_articles = []
            
            # Sample top sources for hourly updates
            priority_sources = {
                "BBC Breaking": "http://feeds.bbci.co.uk/news/rss.xml",
                "Reuters Breaking": "https://feeds.reuters.com/reuters/breakingviews",
                "CNN Breaking": "http://rss.cnn.com/rss/edition.rss",
                "AP Breaking": "https://feeds.apnews.com/rss/apf-topnews"
            }
            
            for source_name, rss_url in priority_sources.items():
                try:
                    articles = self.scraper.fetch_rss_feed(source_name, rss_url)
                    all_articles.extend(articles)
                except Exception as e:
                    logger.error(f"Error in hourly update for {source_name}: {e}")
            
            # Save articles
            if all_articles:
                self.scraper.save_articles(all_articles)
                logger.info(f"Hourly update: saved {len(all_articles)} new articles")
            
        except Exception as e:
            logger.error(f"Hourly update failed: {e}")
    
    def start(self):
        """Start the scheduler"""
        logger.info("Starting News Scraper Scheduler...")
        
        # Schedule full scrape daily at 7 AM
        self.scheduler.add_job(
            func=self.run_scrape_job,
            trigger=CronTrigger(hour=7, minute=0),
            id='daily_full_scrape',
            name='Daily Full News Scrape',
            replace_existing=True
        )
        
        # Schedule hourly updates for breaking news
        self.scheduler.add_job(
            func=self.run_hourly_update,
            trigger=CronTrigger(minute=0),  # Every hour at minute 0
            id='hourly_update',
            name='Hourly News Update',
            replace_existing=True
        )
        
        # Schedule cleanup weekly
        self.scheduler.add_job(
            func=self.scraper.cleanup_old_articles,
            trigger=CronTrigger(day_of_week='sun', hour=6, minute=0),
            id='weekly_cleanup',
            name='Weekly Database Cleanup',
            replace_existing=True
        )
        
        # Run initial scrape
        logger.info("Running initial news scrape...")
        self.run_scrape_job()
        
        # Start scheduler
        logger.info("Scheduler started. Jobs scheduled:")
        for job in self.scheduler.get_jobs():
            logger.info(f"  - {job.name}: {job.trigger}")
        
        try:
            self.scheduler.start()
        except KeyboardInterrupt:
            logger.info("Scheduler stopped by user")

def main():
    """Main function"""
    scheduler = NewsScraperScheduler()
    scheduler.start()

if __name__ == "__main__":
    main()
