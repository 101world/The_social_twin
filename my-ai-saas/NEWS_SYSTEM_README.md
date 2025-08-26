# News System Documentation

## Overview

A comprehensive news aggregation system for 101World that scrapes daily news from multiple sources and provides fast search capabilities.

## Features

- 📰 **Daily News Briefing** - Automated daily scraping from trusted sources
- 🔍 **Real-time Search** - Search across cached articles by keyword and category  
- 📱 **Mobile Responsive** - Clean, modern interface that works on all devices
- 🏷️ **Category Filtering** - Filter news by Technology, Business, Politics, Sports, Health, etc.
- ⚡ **Fast Loading** - Cached articles for instant access
- 🔄 **Auto Updates** - Scheduled scraping every 4 hours

## System Architecture

```
Frontend (Next.js)          Backend APIs              Python Scraper
    │                           │                          │
  ├─ /social-twin news page  ├─ /api/news/daily-brief   ├─ news_scraper.py
    ├─ Search interface        ├─ /api/news/search        ├─ scheduler.py  
    └─ Category filters        └─ Cached JSON responses   └─ RSS/HTML parsing
```

## Quick Start

### 1. Frontend is Ready
The news reader is canonicalized to the Social Twin at `/social-twin` (the legacy `/news` route now redirects to `/social-twin`).

### 2. Set Up Python Scraper (Optional but Recommended)

```bash
# Navigate to scripts directory
cd scripts

# Install Python dependencies
pip install -r requirements.txt

# Run setup (creates directories, tests connection)
python setup_scraper.py

# Test manual scraping
python news_scraper.py

# Start scheduled scraper (runs every 4 hours)
python scheduler.py
```

### 3. News Sources Configuration

The scraper is pre-configured with these sources:
- **BBC News** - General, Technology, Business, Sports, Health
- **CNN** - General news
- **Reuters** - Global news
- **TechCrunch** - Technology news

You can customize sources in `news_scraper.py`.

## API Endpoints

### GET `/api/news/daily-brief`
Returns the cached daily news briefing.

**Response:**
```json
{
  "date": "2025-08-23",
  "articles": [
    {
      "id": "uuid",
      "title": "Article Title",
      "snippet": "Article summary...",
      "url": "https://source.com/article",
      "source": "BBC",
      "category": "Technology",
      "publishDate": "2025-08-23T10:00:00Z",
      "imageUrl": "https://..."
    }
  ],
  "categories": ["Technology", "Business", "Politics"],
  "totalArticles": 50
}
```

### GET `/api/news/search?query=keyword&category=tech`
Searches cached articles and optionally performs real-time search.

**Parameters:**
- `query` - Search keyword
- `category` - Filter by category (optional)

**Response:**
```json
{
  "articles": [...],
  "cached": true,
  "query": "AI",
  "category": "technology"
}
```

## File Structure

```
my-ai-saas/
├── app/
│   ├── news/page.tsx              # News page component
│   └── api/news/
│       ├── daily-brief/route.ts   # Daily briefing API
│       └── search/route.ts        # Search API
├── components/
│   └── Navbar.tsx                 # Updated with news icon
├── data/
│   └── daily-brief.json          # Cached news data
└── scripts/
  ├── news_scraper.py            # Main scraper
    ├── scheduler.py               # Automated scheduling
    ├── setup_scraper.py           # Setup script
    └── requirements.txt           # Python dependencies
```

## Customization

### Adding News Sources

Edit `news_scraper.py` and add to the `sources` list:

```python
NewsSource("Source Name", "https://source.com/rss.xml", "https://source.com", "Category")
```

### Changing Update Frequency

Edit `scheduler.py`:

```python
# Run every 2 hours instead of 4
schedule.every(2).hours.do(run_scheduled_scrape)

# Change daily time
schedule.every().day.at("08:00").do(run_scheduled_scrape)
```

### Styling the News Page

The news reader uses Tailwind CSS classes and supports dark mode. Customize the design in `components/SocialNewsPanel.tsx` (Social Twin) or `app/news/page.tsx` (legacy).

## Production Deployment

### Environment Variables (Optional)
```env
NEWS_CACHE_DIR=/path/to/cache
NEWS_UPDATE_INTERVAL=4
NEWS_MAX_ARTICLES=100
```

### Systemd Service (Linux)
Create `/etc/systemd/system/news-scraper.service`:

```ini
[Unit]
Description=News Scraper Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/app/scripts
ExecStart=/usr/bin/python3 scheduler.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable news-scraper
sudo systemctl start news-scraper
```

### Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 6:00 AM
4. Action: Start program `python.exe`
5. Arguments: `C:\path\to\scripts\scheduler.py`

## Troubleshooting

### No Articles Showing
1. Check if `data/daily-brief.json` exists
2. Run `python news_scraper.py` manually
3. Check scraper logs for errors

### RSS Feed Errors
- Some sites may block requests
- Add delays between requests
- Use proper User-Agent headers
- Consider using proxy services

### Performance Optimization
- Limit articles per source (currently 10)
- Implement pagination for large result sets
- Add database storage for better performance
- Cache search results

## Future Enhancements

- [ ] Real-time notifications for breaking news
- [ ] User preferences for personalized feeds
- [ ] Social sharing capabilities
- [ ] AI-powered article summarization
- [ ] Sentiment analysis
- [ ] Trending topics detection
- [ ] Newsletter generation
- [ ] Mobile app integration

## Support

For issues or questions about the news system:
1. Check the logs in the terminal
2. Verify API endpoints are responding
3. Test with manual scraper run
4. Contact development team

---

The news system is now ready to use! Visit `/social-twin` to see the canonical news reader in action.
