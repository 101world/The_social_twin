-- Temporary fix to allow news scraper to work with anon key
-- Run this in your Supabase SQL editor

-- Disable RLS temporarily for news_articles table
ALTER TABLE news_articles DISABLE ROW LEVEL SECURITY;

-- Or, better approach: Create a policy that allows inserts for the scraper
-- (Run this instead of disabling RLS completely)
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "allow_news_scraper_insert" ON news_articles;

-- Create a policy that allows inserts (for news scraper)
CREATE POLICY "allow_news_scraper_insert" ON news_articles
FOR INSERT
WITH CHECK (true);

-- Create a policy that allows public read access
CREATE POLICY "allow_public_read" ON news_articles
FOR SELECT
USING (true);

-- Create a policy that allows public updates (for quality scores, etc.)
CREATE POLICY "allow_public_update" ON news_articles
FOR UPDATE
USING (true)
WITH CHECK (true);
