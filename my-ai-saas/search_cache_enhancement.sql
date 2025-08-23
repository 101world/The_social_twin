-- Enhancement for news_articles table to support search caching
-- This adds columns to track search queries and cache metadata

ALTER TABLE news_articles 
ADD COLUMN IF NOT EXISTS search_query TEXT,
ADD COLUMN IF NOT EXISTS cached_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster search query lookups
CREATE INDEX IF NOT EXISTS idx_news_articles_search_query ON news_articles(search_query);
CREATE INDEX IF NOT EXISTS idx_news_articles_cached_at ON news_articles(cached_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_category_cached ON news_articles(category, cached_at);

-- Create index for "Your Feed" category to improve performance
CREATE INDEX IF NOT EXISTS idx_news_articles_your_feed ON news_articles(category) WHERE category = 'Your Feed';

-- Clean up old search cache entries (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_search_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM news_articles 
  WHERE search_query IS NOT NULL 
    AND cached_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup function (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-search-cache', '0 2 * * *', 'SELECT cleanup_search_cache();');

COMMENT ON COLUMN news_articles.search_query IS 'Original search query that found this article';
COMMENT ON COLUMN news_articles.cached_at IS 'When this article was cached from a search result';
COMMENT ON FUNCTION cleanup_search_cache() IS 'Removes old search cache entries to keep database clean';
