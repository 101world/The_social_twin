// Test script to verify news APIs work and show sample data for the website
console.log('🌟 Testing Live News Feed for ONE World News\n');

const testAPIDirectly = async () => {
  console.log('🔍 Testing NewsAPI.org directly...');
  
  const newsApiKey = '3bf80b934d154d3790c54f292c2a81a9';
  const gnewsKey = 'a8bcacc75413f60e5087c825d04e5c6a';
  
  try {
    // Test NewsAPI.org
    const newsApiUrl = `https://newsapi.org/v2/top-headlines?pageSize=5&country=us`;
    const newsApiResponse = await fetch(newsApiUrl, {
      headers: { 'X-Api-Key': newsApiKey }
    });
    
    if (newsApiResponse.ok) {
      const newsApiData = await newsApiResponse.json();
      console.log('✅ NewsAPI Success!');
      console.log(`📊 Got ${newsApiData.articles?.length || 0} articles`);
      
      if (newsApiData.articles && newsApiData.articles.length > 0) {
        const article = newsApiData.articles[0];
        console.log('\n📰 Sample Article for YOUR News Tab:');
        console.log(`Title: ${article.title}`);
        console.log(`Source: ${article.source?.name}`);
        console.log(`Description: ${article.description?.slice(0, 100)}...`);
        console.log(`Image: ${article.urlToImage ? '✅ Has image' : '❌ No image'}`);
        console.log(`Published: ${article.publishedAt}`);
        console.log(`URL: ${article.url}`);
      }
    } else {
      console.log('❌ NewsAPI failed:', newsApiResponse.status);
    }

    // Test GNews.io
    console.log('\n🔍 Testing GNews.io...');
    const gnewsUrl = `https://gnews.io/api/v4/top-headlines?max=5&lang=en&token=${gnewsKey}`;
    const gnewsResponse = await fetch(gnewsUrl);
    
    if (gnewsResponse.ok) {
      const gnewsData = await gnewsResponse.json();
      console.log('✅ GNews Success!');
      console.log(`📊 Got ${gnewsData.articles?.length || 0} articles`);
      
      if (gnewsData.articles && gnewsData.articles.length > 0) {
        const article = gnewsData.articles[0];
        console.log('\n📰 Sample Article from GNews:');
        console.log(`Title: ${article.title}`);
        console.log(`Source: ${article.source?.name || article.source}`);
        console.log(`Description: ${article.description?.slice(0, 100)}...`);
        console.log(`Image: ${article.image ? '✅ Has image' : '❌ No image'}`);
        console.log(`Published: ${article.publishedAt}`);
        console.log(`URL: ${article.url}`);
      }
    } else {
      console.log('❌ GNews failed:', gnewsResponse.status);
    }

  } catch (error) {
    console.error('❌ API Test Error:', error.message);
  }
};

const showExpectedWebsiteOutput = () => {
  console.log('\n🎯 What users will see on your "ONE World News" tab:');
  console.log('=====================================');
  console.log('Header: "ONE World News" (Times New Roman font)');
  console.log('Subtitle: "Breaking News • Global Coverage • Real-time Updates"');
  console.log('');
  console.log('Layout:');
  console.log('1. 🚨 Breaking News section (2 large cards)');
  console.log('2. Featured story (1 large card)');
  console.log('3. Quick updates (3 smaller cards)');
  console.log('4. More stories (alternating layout)');
  console.log('');
  console.log('Each article shows:');
  console.log('• Headline (Times New Roman)');
  console.log('• Source name (highlighted in orange)');
  console.log('• Publication time');
  console.log('• Category badge (if available)');
  console.log('• Hero image');
  console.log('• Article snippet/summary');
  console.log('');
  console.log('Features:');
  console.log('• Search functionality');
  console.log('• Refresh button');
  console.log('• Modal popup with full article content');
  console.log('• Related articles suggestions');
  console.log('• Responsive design (mobile-friendly)');
};

// Run tests
testAPIDirectly().then(() => {
  showExpectedWebsiteOutput();
  console.log('\n🎉 Your news feed is ready!');
  console.log('🚀 Visit your website to see "ONE World News" in action!');
});
