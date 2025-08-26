// Test script to check all news API providers individually
// Using API keys directly since dotenv isn't available

async function testNewsAPI() {
  console.log('\n🔍 Testing NewsAPI.org...');
  const apiKey = '3bf80b934d154d3790c54f292c2a81a9';
  
  if (!apiKey) {
    console.log('❌ NEWSAPI_KEY not found');
    return;
  }
  
  try {
    const url = `https://newsapi.org/v2/top-headlines?pageSize=5&country=us`;
    const response = await fetch(url, {
      headers: { 'X-Api-Key': apiKey }
    });
    
    if (!response.ok) {
      console.log('❌ NewsAPI failed:', response.status, response.statusText);
      const error = await response.text();
      console.log('Error details:', error);
      return;
    }
    
    const data = await response.json();
    console.log('✅ NewsAPI Success!');
    console.log(`📊 Got ${data.articles?.length || 0} articles`);
    
    if (data.articles && data.articles[0]) {
      const sample = data.articles[0];
      console.log('\n📰 Sample Article:');
      console.log(`Title: ${sample.title}`);
      console.log(`Source: ${sample.source?.name}`);
      console.log(`Description: ${sample.description?.slice(0, 100)}...`);
      console.log(`Image: ${sample.urlToImage ? '✅ Has image' : '❌ No image'}`);
      console.log(`Published: ${sample.publishedAt}`);
      console.log(`URL: ${sample.url}`);
    }
    
    return data.articles;
  } catch (error) {
    console.log('❌ NewsAPI error:', error.message);
  }
}

async function testGNews() {
  console.log('\n🔍 Testing GNews.io...');
  const apiKey = 'a8bcacc75413f60e5087c825d04e5c6a';
  
  if (!apiKey) {
    console.log('❌ GNEWS_IO_KEY not found');
    return;
  }
  
  try {
    const url = `https://gnews.io/api/v4/top-headlines?max=5&lang=en&token=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log('❌ GNews failed:', response.status, response.statusText);
      const error = await response.text();
      console.log('Error details:', error);
      return;
    }
    
    const data = await response.json();
    console.log('✅ GNews Success!');
    console.log(`📊 Got ${data.articles?.length || 0} articles`);
    
    if (data.articles && data.articles[0]) {
      const sample = data.articles[0];
      console.log('\n📰 Sample Article:');
      console.log(`Title: ${sample.title}`);
      console.log(`Source: ${sample.source?.name || sample.source}`);
      console.log(`Description: ${sample.description?.slice(0, 100)}...`);
      console.log(`Image: ${sample.image ? '✅ Has image' : '❌ No image'}`);
      console.log(`Published: ${sample.publishedAt}`);
      console.log(`URL: ${sample.url}`);
    }
    
    return data.articles;
  } catch (error) {
    console.log('❌ GNews error:', error.message);
  }
}

async function testNewsData() {
  console.log('\n🔍 Testing NewsData.io...');
  const apiKey = 'pub_22f3393a92744498a4535f2e65643d95';
  
  if (!apiKey) {
    console.log('❌ NEWSDATA_KEY not found');
    return;
  }
  
  try {
    const url = `https://newsdata.io/api/1/news?language=en&size=5&apikey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log('❌ NewsData failed:', response.status, response.statusText);
      const error = await response.text();
      console.log('Error details:', error);
      return;
    }
    
    const data = await response.json();
    console.log('✅ NewsData Success!');
    console.log(`📊 Got ${data.results?.length || 0} articles`);
    
    if (data.results && data.results[0]) {
      const sample = data.results[0];
      console.log('\n📰 Sample Article:');
      console.log(`Title: ${sample.title}`);
      console.log(`Source: ${sample.source_id}`);
      console.log(`Description: ${sample.description?.slice(0, 100)}...`);
      console.log(`Image: ${sample.image_url ? '✅ Has image' : '❌ No image'}`);
      console.log(`Published: ${sample.pubDate}`);
      console.log(`URL: ${sample.link}`);
    }
    
    return data.results;
  } catch (error) {
    console.log('❌ NewsData error:', error.message);
  }
}

async function testNewsRoute() {
  console.log('\n🔍 Testing local News API route...');
  
  try {
    const response = await fetch('http://localhost:3000/api/news?limit=5');
    
    if (!response.ok) {
      console.log('❌ Local API failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Local News API Success!');
    console.log(`📊 Got ${data.data?.articles?.length || 0} articles`);
    console.log(`🔧 Provider used: ${data.data?.provider_used || 'unknown'}`);
    
    if (data.data?.articles && data.data.articles[0]) {
      const sample = data.data.articles[0];
      console.log('\n📰 Sample Article from API:');
      console.log(`Title: ${sample.title}`);
      console.log(`Source: ${sample.source}`);
      console.log(`Summary: ${sample.summary?.slice(0, 100)}...`);
      console.log(`Image: ${sample.image_url ? '✅ Has image' : '❌ No image'}`);
      console.log(`Published: ${sample.published_at}`);
      console.log(`URL: ${sample.url}`);
      console.log(`Category: ${sample.category}`);
      console.log(`Quality Score: ${sample.quality_score}`);
    }
    
    if (data.data?.metadata) {
      console.log('\n📈 Metadata:');
      console.log(`Total articles: ${data.data.metadata.total_articles}`);
      console.log(`With images: ${data.data.metadata.with_images}`);
      console.log(`With videos: ${data.data.metadata.with_videos}`);
      console.log(`Categories available: ${data.data.categories?.length || 0}`);
    }
    
    return data;
  } catch (error) {
    console.log('❌ Local API error:', error.message);
    console.log('💡 Make sure your development server is running (npm run dev)');
  }
}

async function runAllTests() {
  console.log('🌟 101World News API Testing\n');
  console.log('Testing all configured news providers...\n');
  
  const newsApiArticles = await testNewsAPI();
  const gnewsArticles = await testGNews();
  const newsDataArticles = await testNewsData();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log(`NewsAPI.org: ${newsApiArticles?.length || 0} articles`);
  console.log(`GNews.io: ${gnewsArticles?.length || 0} articles`);
  console.log(`NewsData.io: ${newsDataArticles?.length || 0} articles`);
  
  const totalArticles = (newsApiArticles?.length || 0) + (gnewsArticles?.length || 0) + (newsDataArticles?.length || 0);
  console.log(`\n🎉 Total articles available: ${totalArticles}`);
  
  if (totalArticles > 0) {
    console.log('\n✅ Your news feed will have fresh content!');
    console.log('\n🚀 Now testing the integrated API route...');
    await testNewsRoute();
  } else {
    console.log('\n⚠️  No articles retrieved. Check API keys and internet connection.');
  }
}

runAllTests();
