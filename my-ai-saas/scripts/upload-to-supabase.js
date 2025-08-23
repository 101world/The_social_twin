const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadNewsToSupabase() {
    try {
        console.log('🔄 Starting news upload to Supabase...');
        
        // First, let's test the connection
        const { data: testData, error: testError } = await supabase
            .from('news_articles')
            .select('count', { count: 'exact', head: true });
            
        if (testError) {
            console.error('❌ Supabase connection test failed:', testError);
            console.log('📝 This likely means the news_articles table doesn\'t exist yet.');
            console.log('📝 Please run the SQL schema in your Supabase dashboard first.');
            return;
        }
        
        console.log('✅ Supabase connection successful');
        console.log(`📊 Current articles in Supabase: ${testData || 0}`);
        
        // Read from SQLite database
        const dbPath = path.join(__dirname, 'data', 'enhanced_news.db');
        console.log(`📂 Reading from SQLite: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath);
        
        const articles = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    title,
                    summary,
                    url,
                    image_url,
                    video_url,
                    youtube_url,
                    category,
                    source,
                    published_at,
                    quality_score,
                    content_hash
                FROM news_articles 
                ORDER BY published_at DESC
                LIMIT 100
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
        
        db.close();
        
        console.log(`📰 Found ${articles.length} articles in SQLite`);
        
        if (articles.length === 0) {
            console.log('⚠️ No articles found in SQLite database');
            return;
        }
        
        // Transform data for Supabase
        const transformedArticles = articles.map(article => ({
            title: article.title,
            summary: article.summary,
            url: article.url,
            image_url: article.image_url,
            video_url: article.video_url,
            youtube_url: article.youtube_url,
            category: article.category || 'General',
            source: article.source,
            published_at: article.published_at,
            quality_score: article.quality_score || 0,
            content_hash: article.content_hash
        }));
        
        // Upload in batches to avoid timeout
    const batchSize = 5;
        let uploaded = 0;
        let skipped = 0;
        
        for (let i = 0; i < transformedArticles.length; i += batchSize) {
            const batch = transformedArticles.slice(i, i + batchSize);
            
            try {
                const { data, error } = await supabase
                    .from('news_articles')
                    .upsert(batch, { 
                        onConflict: 'url',
                        ignoreDuplicates: true 
                    })
                    .select();
                
                if (error) {
                    console.error(`❌ Error uploading batch ${i / batchSize + 1}:`, error);
                    skipped += batch.length;
                } else {
                    uploaded += data?.length || 0;
                    console.log(`✅ Uploaded batch ${i / batchSize + 1}/${Math.ceil(transformedArticles.length / batchSize)} (${data?.length || 0} articles)`);
                }
            } catch (err) {
                console.error(`❌ Exception in batch ${i / batchSize + 1}:`, err);
                skipped += batch.length;
            }
        }
        
        console.log('\n🎉 Upload Summary:');
        console.log(`✅ Successfully uploaded: ${uploaded} articles`);
        console.log(`⚠️ Skipped/Failed: ${skipped} articles`);
        console.log(`📊 Total processed: ${uploaded + skipped} articles`);
        
        // Verify the upload
        const { data: finalCount, error: countError } = await supabase
            .from('news_articles')
            .select('count', { count: 'exact', head: true });
            
        if (!countError) {
            console.log(`📈 Total articles now in Supabase: ${finalCount}`);
        }
        
    } catch (error) {
        console.error('❌ Upload failed:', error);
    }
}

// Run the upload
uploadNewsToSupabase();
