#!/usr/bin/env python3
"""
News Scraper Setup Script
Sets up the news scraping system
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def setup_environment():
    """Set up Python environment and install dependencies"""
    print("Setting up news scraper environment...")
    
    # Check if Python is available
    try:
        result = subprocess.run([sys.executable, "--version"], capture_output=True, text=True)
        print(f"Python version: {result.stdout.strip()}")
    except Exception as e:
        print(f"Error checking Python version: {e}")
        return False
    
    # Install requirements
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if requirements_file.exists():
        print("Installing Python dependencies...")
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
            ])
            print("Dependencies installed successfully!")
        except subprocess.CalledProcessError as e:
            print(f"Error installing dependencies: {e}")
            return False
    else:
        print("Requirements file not found!")
        return False
    
    return True

def setup_directories():
    """Create necessary directories"""
    print("Creating directories...")
    
    # Create data directory in the main project
    project_root = Path(__file__).parent.parent
    data_dir = project_root / "data"
    data_dir.mkdir(exist_ok=True)
    
    print(f"Data directory created: {data_dir}")
    return True

def create_sample_config():
    """Create sample configuration file"""
    print("Creating sample configuration...")
    
    config = {
        "sources": [
            {
                "name": "BBC",
                "rss_url": "http://feeds.bbci.co.uk/news/rss.xml",
                "category": "General"
            },
            {
                "name": "TechCrunch", 
                "rss_url": "https://techcrunch.com/feed/",
                "category": "Technology"
            }
        ],
        "schedule": {
            "daily_time": "06:00",
            "update_interval_hours": 4
        },
        "cache": {
            "max_articles": 100,
            "days_to_keep": 7
        }
    }
    
    config_file = Path(__file__).parent / "config.json"
    
    try:
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"Sample configuration created: {config_file}")
        return True
        
    except Exception as e:
        print(f"Error creating config file: {e}")
        return False

def test_scraper():
    """Test the scraper with a simple run"""
    print("Testing scraper...")
    
    try:
        from news_scraper import NewsScraper
        
        scraper = NewsScraper()
        
        # Test with just one source
        from news_scraper import NewsSource
        test_source = NewsSource("BBC", "http://feeds.bbci.co.uk/news/rss.xml", "https://www.bbc.com", "General")
        
        articles = scraper.fetch_rss_articles(test_source)
        
        if articles:
            print(f"Test successful! Fetched {len(articles)} articles from BBC")
            
            # Show first article as example
            first_article = articles[0]
            print(f"Sample article: {first_article.title[:50]}...")
            
            return True
        else:
            print("Test failed - no articles fetched")
            return False
            
    except Exception as e:
        print(f"Test failed with error: {e}")
        return False

def main():
    """Main setup function"""
    print("=== News Scraper Setup ===")
    print()
    
    steps = [
        ("Setting up environment", setup_environment),
        ("Creating directories", setup_directories), 
        ("Creating sample config", create_sample_config),
        ("Testing scraper", test_scraper)
    ]
    
    for step_name, step_func in steps:
        print(f"Step: {step_name}")
        if not step_func():
            print(f"❌ Failed: {step_name}")
            sys.exit(1)
        print(f"✅ Completed: {step_name}")
        print()
    
    print("🎉 News scraper setup completed successfully!")
    print()
    print("Next steps:")
    print("1. Review and customize config.json if needed")
    print("2. Run 'python news_scraper.py' to test manual scraping")
    print("3. Run 'python scheduler.py' to start the scheduled scraper")
    print("4. Check the /news page in your web app")

if __name__ == "__main__":
    main()
