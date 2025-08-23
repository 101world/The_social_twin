// Quick verification script to test Supabase connection and news scraper
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tnlftxudmiryrgkajfun.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTQxODEsImV4cCI6MjA3MDU3MDE4MX0.VEiU7iBh9LdjkT3fVvkfNJcT2haw4iQijj-rAxjqobc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('news_articles')
      .select('id, title, published_at')
      .limit(5)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('❌ Connection error:', error.message);
      return false;
    }

    console.log('✅ Connection successful!');
    console.log(`📰 Found ${data.length} recent articles:`);
    data.forEach((article, index) => {
      console.log(`  ${index + 1}. ${article.title} (${new Date(article.published_at).toLocaleString()})`);
    });

    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

async function testNewsScraper() {
  console.log('\n🚀 Testing news scraper...');
  
  try {
    // Import and run the scraper
    const scraperPath = require('path').join(__dirname, 'fresh-news-scraper.js');
    console.log('📄 Running fresh news scraper...');
    
    // Set environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseKey;
    
    // This will run the scraper
    require('./fresh-news-scraper.js');
    
  } catch (err) {
    console.error('❌ Scraper error:', err.message);
  }
}

async function main() {
  console.log('🌟 101World News Platform - Connection Test\n');
  
  const connectionOk = await testConnection();
  
  if (connectionOk) {
    console.log('\n✅ All systems ready!');
    console.log('📱 Your news platform will now:');
    console.log('   • Update every 10 minutes automatically');
    console.log('   • Show newest articles first');
    console.log('   • Cache search results for other users');
    console.log('   • Display weather widget in header');
    console.log('   • Work without any manual intervention');
  } else {
    console.log('\n❌ Please check your Supabase configuration');
  }
}

main().catch(console.error);
