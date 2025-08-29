// Test script to check if news scraper and API work properly
console.log('🔍 Testing News System...');

const testNewsAPI = async () => {
  try {
    console.log('📰 Testing news API...');
    const response = await fetch('/api/news?limit=5');
    const data = await response.json();
    
    console.log('✅ News API Response:', {
      success: data.success,
      articleCount: data.data?.articles?.length || 0,
      totalInDB: data.data?.total || 0,
      hasImages: data.data?.articles?.filter(a => a.image_url)?.length || 0
    });
    
    if (data.data?.articles?.length > 0) {
      console.log('📄 Sample Article:', {
        title: data.data.articles[0].title,
        source: data.data.articles[0].source,
        published: data.data.articles[0].published_at,
        hasImage: !!data.data.articles[0].image_url
      });
    }
    
  } catch (error) {
    console.error('❌ News API Test Failed:', error);
  }
};

const testNewsRefresh = async () => {
  try {
    console.log('🔄 Testing news refresh...');
    const response = await fetch('/api/news/refresh', { method: 'POST' });
    const data = await response.json();
    
    console.log('✅ News Refresh Result:', data);
    
  } catch (error) {
    console.error('❌ News Refresh Test Failed:', error);
  }
};

// Run tests
testNewsAPI();
testNewsRefresh();
