"""
News Scraper Scheduler
Runs the news scraper on a daily schedule
"""

import schedule
import time
import logging
from datetime import datetime
from news_scraper import NewsScraper

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_scheduled_scrape():
    """Run the news scraper"""
    logger.info("Starting scheduled news scrape...")
    
    try:
        scraper = NewsScraper()
        scraper.run_daily_scrape()
        logger.info("Scheduled scrape completed successfully")
        
    except Exception as e:
        logger.error(f"Scheduled scrape failed: {e}")

def main():
    """Main scheduler function"""
    logger.info("News scraper scheduler started")
    
    # Schedule daily scraping at 6 AM
    schedule.every().day.at("06:00").do(run_scheduled_scrape)
    
    # Also schedule every 4 hours for more frequent updates
    schedule.every(4).hours.do(run_scheduled_scrape)
    
    # Run once immediately on startup
    logger.info("Running initial scrape...")
    run_scheduled_scrape()
    
    # Keep the scheduler running
    while True:
        try:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
            
        except KeyboardInterrupt:
            logger.info("Scheduler stopped by user")
            break
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            time.sleep(300)  # Wait 5 minutes before retrying

if __name__ == "__main__":
    main()
