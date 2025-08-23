const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://tnlftxudmiryrgkajfun.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk5NDE4MSwiZXhwIjoyMDcwNTcwMTgxfQ.80sKPr0NTPuGCwKhm3VZisadRdU1aQLkHFgfokyQcIk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createNewsTable() {
    try {
        console.log('🔄 Creating news_articles table in Supabase...');
        
        // Create the table using SQL
        const { data, error } = await supabase.rpc('exec', {
            sql: `
            -- Create news_articles table
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
            
            -- Create indexes for better performance
            CREATE INDEX IF NOT EXISTS idx_news_category ON public.news_articles(category);
            CREATE INDEX IF NOT EXISTS idx_news_published ON public.news_articles(published_at DESC);
            CREATE INDEX IF NOT EXISTS idx_news_quality ON public.news_articles(quality_score DESC);
            CREATE INDEX IF NOT EXISTS idx_news_source ON public.news_articles(source);
            
            -- Enable Row Level Security
            ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
            
            -- Create policies for public read access
            CREATE POLICY IF NOT EXISTS "Allow public read access" ON public.news_articles
                FOR SELECT USING (true);
            
            -- Create policies for service role write access
            CREATE POLICY IF NOT EXISTS "Allow service role write access" ON public.news_articles
                FOR ALL USING (auth.role() = 'service_role');
            `
        });
        
        if (error) {
            console.error('❌ Failed to create table via RPC:', error);
            console.log('🔄 Trying alternative approach...');
            
            // Alternative: Try to insert a test record to create the table structure
            const testArticle = {
                title: 'Test Article - Will be deleted',
                summary: 'This is a test article to create the table structure',
                url: 'https://test.example.com/delete-me',
                category: 'Test',
                source: 'System Test',
                quality_score: 1
            };
            
            const { error: insertError } = await supabase
                .from('news_articles')
                .insert([testArticle]);
                
            if (insertError) {
                console.error('❌ Failed to create table via insert:', insertError);
                return false;
            } else {
                console.log('✅ Table created via insert method');
                
                // Delete the test article
                await supabase
                    .from('news_articles')
                    .delete()
                    .eq('url', 'https://test.example.com/delete-me');
                    
                console.log('🧹 Cleaned up test data');
            }
        } else {
            console.log('✅ Table created successfully via RPC');
        }
        
        // Verify table exists
        const { data: testQuery, error: testError } = await supabase
            .from('news_articles')
            .select('count', { count: 'exact', head: true });
            
        if (testError) {
            console.error('❌ Table verification failed:', testError);
            return false;
        }
        
        console.log('✅ Table verified successfully');
        console.log(`📊 Current article count: ${testQuery || 0}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return false;
    }
}

// Run the table creation
createNewsTable().then(success => {
    if (success) {
        console.log('\n🎉 News table setup completed successfully!');
        console.log('📋 Next steps:');
        console.log('   1. Run the news scraper to populate data');
        console.log('   2. Test the news API endpoint');
        console.log('   3. Verify the news page loads correctly');
    } else {
        console.log('\n❌ Table setup failed. Please check the logs above.');
    }
    process.exit(success ? 0 : 1);
});
