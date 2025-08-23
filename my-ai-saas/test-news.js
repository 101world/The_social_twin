const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tnlftxudmiryrgkajfun.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk5NDE4MSwiZXhwIjoyMDcwNTcwMTgxfQ.80sKPr0NTPuGCwKhm3VZisadRdU1aQLkHFgfokyQcIk'
);

async function showScrapedNews() {
  console.log('📰 Showing actual scraped news from Supabase...\n');
  
  const { data: articles, error } = await supabase
    .from('news_articles')
    .select('title, source, published_at, url')
    .order('published_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${articles.length} articles:\n`);
  
  articles.forEach((article, i) => {
    console.log(`${i + 1}. ${article.title}`);
    console.log(`   Source: ${article.source}`);
    console.log(`   Published: ${new Date(article.published_at).toLocaleString()}`);
    console.log(`   URL: ${article.url}`);
    console.log('');
  });
  
  // Count by source
  const { data: sources } = await supabase
    .from('news_articles')
    .select('source');
    
  const sourceCounts = sources.reduce((acc, article) => {
    acc[article.source] = (acc[article.source] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📊 Articles by source:');
  Object.entries(sourceCounts).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} articles`);
  });
}

showScrapedNews();
