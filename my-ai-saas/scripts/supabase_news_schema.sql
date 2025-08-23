-- Enhanced News System Schema for Supabase
-- This creates the news_articles table with all multimedia support

-- Drop existing table if it exists (for clean setup)
DROP TABLE IF EXISTS news_articles;

-- Create enhanced news_articles table
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL UNIQUE,
    image_url TEXT,
    video_url TEXT,
    youtube_url TEXT,
    category TEXT DEFAULT 'General',
    source TEXT,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    quality_score INTEGER DEFAULT 0,
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX idx_news_category ON news_articles(category);
CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_source ON news_articles(source);
CREATE INDEX idx_news_hash ON news_articles(content_hash);
CREATE INDEX idx_news_quality ON news_articles(quality_score DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_news_articles_updated_at BEFORE UPDATE
    ON news_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access" ON news_articles
    FOR SELECT USING (true);

-- Create policies for service role write access (for the scraper)
CREATE POLICY "Allow service role write access" ON news_articles
    FOR ALL USING (auth.role() = 'service_role');

-- Create a view for daily briefing
CREATE OR REPLACE VIEW daily_news_briefing AS
SELECT 
    id,
    title,
    summary,
    url,
    image_url,
    video_url,
    youtube_url,
    category,
    source,
    published_at,
    quality_score
FROM news_articles 
WHERE published_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY quality_score DESC, published_at DESC
LIMIT 100;

-- Create a view for category-wise news
CREATE OR REPLACE VIEW news_by_category AS
SELECT 
    category,
    COUNT(*) as article_count,
    MAX(published_at) as latest_article,
    AVG(quality_score) as avg_quality
FROM news_articles 
WHERE published_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY category
ORDER BY article_count DESC;

-- Create function to get trending news
CREATE OR REPLACE FUNCTION get_trending_news(
    category_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    summary TEXT,
    url TEXT,
    image_url TEXT,
    video_url TEXT,
    youtube_url TEXT,
    category TEXT,
    source TEXT,
    published_at TIMESTAMPTZ,
    quality_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.summary,
        n.url,
        n.image_url,
        n.video_url,
        n.youtube_url,
        n.category,
        n.source,
        n.published_at,
        n.quality_score
    FROM news_articles n
    WHERE (category_filter IS NULL OR n.category = category_filter)
        AND n.published_at >= CURRENT_DATE - INTERVAL '2 days'
    ORDER BY n.quality_score DESC, n.published_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to search news
CREATE OR REPLACE FUNCTION search_news(
    search_query TEXT,
    category_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    summary TEXT,
    url TEXT,
    image_url TEXT,
    video_url TEXT,
    youtube_url TEXT,
    category TEXT,
    source TEXT,
    published_at TIMESTAMPTZ,
    quality_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.summary,
        n.url,
        n.image_url,
        n.video_url,
        n.youtube_url,
        n.category,
        n.source,
        n.published_at,
        n.quality_score
    FROM news_articles n
    WHERE (
        n.title ILIKE '%' || search_query || '%' 
        OR n.summary ILIKE '%' || search_query || '%'
    )
    AND (category_filter IS NULL OR n.category = category_filter)
    AND n.published_at >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY n.quality_score DESC, n.published_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get multimedia-rich articles
CREATE OR REPLACE FUNCTION get_multimedia_news(
    media_type TEXT DEFAULT 'all', -- 'images', 'videos', 'youtube', 'all'
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    summary TEXT,
    url TEXT,
    image_url TEXT,
    video_url TEXT,
    youtube_url TEXT,
    category TEXT,
    source TEXT,
    published_at TIMESTAMPTZ,
    quality_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.summary,
        n.url,
        n.image_url,
        n.video_url,
        n.youtube_url,
        n.category,
        n.source,
        n.published_at,
        n.quality_score
    FROM news_articles n
    WHERE 
        CASE 
            WHEN media_type = 'images' THEN n.image_url IS NOT NULL
            WHEN media_type = 'videos' THEN n.video_url IS NOT NULL
            WHEN media_type = 'youtube' THEN n.youtube_url IS NOT NULL
            ELSE (n.image_url IS NOT NULL OR n.video_url IS NOT NULL OR n.youtube_url IS NOT NULL)
        END
    AND n.published_at >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY n.quality_score DESC, n.published_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for old articles
CREATE OR REPLACE FUNCTION cleanup_old_news(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM news_articles 
    WHERE published_at < CURRENT_DATE - INTERVAL days_to_keep || ' days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing
INSERT INTO news_articles (
    title, summary, url, category, source, quality_score
) VALUES 
(
    'Sample Tech News Article',
    'This is a sample technology news article for testing the system.',
    'https://example.com/tech-news-1',
    'Technology',
    'Sample Source',
    8
),
(
    'Sample Business News',
    'This is a sample business news article with multimedia content.',
    'https://example.com/business-news-1',
    'Business',
    'Sample Business Source',
    7
),
(
    'Breaking News Sample',
    'This is a sample breaking news article to test the system.',
    'https://example.com/breaking-news-1',
    'General',
    'Breaking News Source',
    9
);

-- Grant necessary permissions
GRANT SELECT ON news_articles TO anon;
GRANT SELECT ON news_articles TO authenticated;
GRANT ALL ON news_articles TO service_role;

GRANT EXECUTE ON FUNCTION get_trending_news(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_news(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_multimedia_news(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_old_news(INTEGER) TO service_role;

-- Create some useful views for analytics
CREATE OR REPLACE VIEW news_analytics AS
SELECT 
    DATE(published_at) as date,
    category,
    COUNT(*) as articles_count,
    COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_images,
    COUNT(CASE WHEN video_url IS NOT NULL THEN 1 END) as with_videos,
    COUNT(CASE WHEN youtube_url IS NOT NULL THEN 1 END) as with_youtube,
    AVG(quality_score) as avg_quality_score
FROM news_articles 
WHERE published_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(published_at), category
ORDER BY date DESC, category;

GRANT SELECT ON news_analytics TO anon;
GRANT SELECT ON news_analytics TO authenticated;
