-- Enhanced News System Schema for Supabase
-- Copy and paste this entire script into the Supabase SQL Editor

-- Create news_articles table with all necessary columns
CREATE TABLE IF NOT EXISTS public.news_articles (
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
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_published ON public.news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON public.news_articles(source);
CREATE INDEX IF NOT EXISTS idx_news_hash ON public.news_articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_news_quality ON public.news_articles(quality_score DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_news_articles_updated_at 
    BEFORE UPDATE ON public.news_articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access" ON public.news_articles
    FOR SELECT USING (true);

-- Create policies for service role write access (for the scraper)
CREATE POLICY "Allow service role write access" ON public.news_articles
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON public.news_articles TO anon;
GRANT SELECT ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;

-- Insert a few sample articles to test the system
INSERT INTO public.news_articles (
    title, 
    summary, 
    url, 
    category, 
    source, 
    quality_score,
    image_url
) VALUES 
(
    'Breaking: AI Technology Breakthrough Announced',
    'A major breakthrough in artificial intelligence has been announced by researchers, promising to revolutionize the tech industry.',
    'https://example.com/ai-breakthrough-2025',
    'Technology',
    'Tech News Daily',
    9,
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800'
),
(
    'Global Climate Summit Reaches Historic Agreement',
    'World leaders have reached a historic agreement on climate action at the latest global summit.',
    'https://example.com/climate-summit-2025',
    'Environment',
    'World News Network',
    8,
    'https://images.unsplash.com/photo-1569163139394-de44cb745337?w=800'
),
(
    'Space Mission Successfully Lands on Mars',
    'The latest Mars mission has successfully landed and begun transmitting valuable scientific data.',
    'https://example.com/mars-mission-2025',
    'Science',
    'Space Today',
    9,
    'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800'
),
(
    'Economic Markets Show Strong Growth',
    'Global financial markets are showing unprecedented growth as economies recover.',
    'https://example.com/market-growth-2025',
    'Business',
    'Financial Times',
    7,
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800'
),
(
    'Revolutionary Medical Treatment Approved',
    'A groundbreaking medical treatment has been approved, offering hope to millions of patients.',
    'https://example.com/medical-breakthrough-2025',
    'Health',
    'Medical News Today',
    8,
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800'
);

-- Verify the table was created successfully
SELECT 
    'Table created successfully!' as status,
    COUNT(*) as sample_articles
FROM public.news_articles;
