-- Create news_cache table for storing news articles with 20-minute cache intervals
CREATE TABLE IF NOT EXISTS news_cache (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    articles JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_news_cache_category ON news_cache(category);
CREATE INDEX IF NOT EXISTS idx_news_cache_updated_at ON news_cache(updated_at);

-- Enable RLS (Row Level Security)
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users (since this is public news data)
CREATE POLICY "Allow read access to news cache" ON news_cache FOR SELECT USING (true);

-- Create policy to allow insert/update for service role (for background updates)
CREATE POLICY "Allow write access to news cache" ON news_cache FOR ALL USING (auth.role() = 'service_role');

-- Create function to clean old cache entries (older than 30 minutes)
CREATE OR REPLACE FUNCTION clean_old_news_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM news_cache
    WHERE updated_at < NOW() - INTERVAL '30 minutes';
END;
$$;

-- Create a trigger to automatically clean old entries when new ones are inserted
CREATE OR REPLACE FUNCTION trigger_clean_old_news_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clean old entries after inserting new ones
    PERFORM clean_old_news_cache();
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS clean_news_cache_trigger ON news_cache;
CREATE TRIGGER clean_news_cache_trigger
    AFTER INSERT ON news_cache
    EXECUTE FUNCTION trigger_clean_old_news_cache();</content>
<parameter name="filePath">c:\Users\welco\OneDrive\Desktop\101World\my-ai-saas\supabase\migrations\create_news_cache.sql
