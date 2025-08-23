News ingestion pipeline (every 30 minutes)

Overview
- Python scraper (enhanced_news_scraper.py) populates a SQLite cache with fresh world news.
- Node uploader (upload-to-supabase.js) reads the cache and upserts into Supabase.
- If the cache is empty, a direct RSS fallback ensures the feed is never empty.

GitHub Actions
- Workflow: .github/workflows/news-sync.yml (cron: every 30 minutes)
- Required repo secrets:
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY

Local test
- Python: `python my-ai-saas/scripts/enhanced_news_scraper.py`
- Node: `cd my-ai-saas && npm i && node scripts/upload-to-supabase.js`

Notes
- Playwright is optional; scraper skips it if not available.
- RRS fallback uses rss-parser and a small set of global feeds.