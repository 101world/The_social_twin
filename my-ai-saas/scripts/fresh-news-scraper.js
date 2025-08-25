const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure'],
      ['description', 'description'],
      ['content', 'content'],
    ]
  }
});

// Enhanced RSS feeds with better image sources
const RSS_FEEDS = [
  { 
    url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', 
    category: 'World News',
    source: 'Google News'
  },
  { 
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml', 
    category: 'World News',
    source: 'BBC'
  },
  { 
    url: 'https://www.reuters.com/rssFeed/worldNews', 
    category: 'World News',
    source: 'Reuters'
  },
  { 
    url: 'https://rss.cnn.com/rss/edition.rss', 
    category: 'World News',
    source: 'CNN'
  },
  { 
    url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', 
    category: 'World News',
    source: 'Wall Street Journal'
  },
  { 
    url: 'https://www.theguardian.com/world/rss', 
    category: 'World News',
    source: 'The Guardian'
  },
  { 
    url: 'https://techcrunch.com/feed/', 
    category: 'Technology',
    source: 'TechCrunch'
  },
  { 
    url: 'https://feeds.finance.yahoo.com/rss/2.0/headline', 
    category: 'Business',
    source: 'Yahoo Finance'
  },
  { 
    url: 'https://feeds.npr.org/1001/rss.xml', 
    category: 'Culture & Lifestyle',
    source: 'NPR'
  },
  { 
    url: 'https://rss.cbc.ca/lineup/world.xml', 
    category: 'World News',
    source: 'CBC'
  },
  // Additional feeds with good image support
  { 
    url: 'https://www.wired.com/feed/rss', 
    category: 'Technology',
    source: 'Wired'
  },
  { 
    url: 'https://feeds.washingtonpost.com/rss/world', 
    category: 'World News',
    source: 'Washington Post'
  },
  { 
    url: 'https://www.polygon.com/rss/index.xml', 
    category: 'Entertainment',
    source: 'Polygon'
  }
];

async function extractImageUrl(item) {
  let imageUrl = null;
  
  // Try different image sources in order of preference
  if (item['media:content']?.$ && item['media:content'].$.url) {
    imageUrl = item['media:content'].$.url;
  } else if (item['media:thumbnail']?.$ && item['media:thumbnail'].$.url) {
    imageUrl = item['media:thumbnail'].$.url;
  } else if (item.enclosure && item.enclosure.url && item.enclosure.type?.includes('image')) {
    imageUrl = item.enclosure.url;
  } else if (item.content && item.content.includes('<img')) {
    // Extract first image from content
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch) imageUrl = imgMatch[1];
  } else if (item.description && item.description.includes('<img')) {
    // Extract first image from description
    const imgMatch = item.description.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch) imageUrl = imgMatch[1];
  }
  
  // Clean and validate image URL
  if (imageUrl) {
    // Remove query parameters that might break images
    imageUrl = imageUrl.split('?')[0];
    
    // Ensure it's a valid image extension or from known image sources
    if (imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) || 
        imageUrl.includes('images.') || 
        imageUrl.includes('img.') ||
        imageUrl.includes('cdn.') ||
        imageUrl.includes('static.')) {
      return imageUrl;
    }
  }
  
  return null;
}

async function calculateQualityScore(item) {
  let score = 1;
  
  // Content quality indicators
  if (item.title && item.title.length > 20) score += 1;
  if (item.contentSnippet && item.contentSnippet.length > 50) score += 1;
  if (item.creator || item.author) score += 1;
  if (await extractImageUrl(item)) score += 2;
  
  // Recency bonus (newer = higher score)
  const pubDate = new Date(item.pubDate || item.isoDate || Date.now());
  const hoursOld = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
  if (hoursOld < 1) score += 3;      // Very fresh
  else if (hoursOld < 6) score += 2; // Recent
  else if (hoursOld < 24) score += 1; // Today
  
  return Math.min(score, 10); // Cap at 10
}

async function scrapeRSSFeed(feedConfig) {
  try {
    console.log(`📡 Scraping ${feedConfig.source}...`);
    const feed = await parser.parseURL(feedConfig.url);
    const articles = [];
    
    for (const item of (feed.items || []).slice(0, 20)) {
      const imageUrl = await extractImageUrl(item);
      const qualityScore = await calculateQualityScore(item);
      
      const article = {
        title: item.title || 'Untitled',
        summary: item.contentSnippet || item.summary || item.content?.slice(0, 300) || '',
        url: item.link,
        image_url: imageUrl,
        video_url: null, // Could be enhanced to detect video links
        youtube_url: null,
        category: feedConfig.category,
        source: feedConfig.source,
        published_at: item.pubDate || item.isoDate || new Date().toISOString(),
        quality_score: qualityScore,
        content_hash: null
      };
      
      articles.push(article);
    }
    
    console.log(`✅ Scraped ${articles.length} articles from ${feedConfig.source}`);
    return articles;
    
  } catch (error) {
    console.error(`❌ Failed to scrape ${feedConfig.source}:`, error.message);
    return [];
  }
}

async function cleanupOldNews() {
  try {
    console.log('🧹 Cleaning up news older than 24 hours...');
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: deletedArticles, error } = await supabase
      .from('news_articles')
      .delete()
      .lt('created_at', oneDayAgo)
      .select();
      
    if (error) {
      console.warn('Cleanup error:', error.message);
    } else {
      console.log(`🗑️ Cleaned up ${deletedArticles?.length || 0} old articles`);
    }
  } catch (e) {
    console.warn('Cleanup failed:', e.message);
  }
}

async function uploadFreshNews() {
  try {
    console.log('🚀 Starting fresh news scraping...');
    
    // Clean up old news first
    await cleanupOldNews();
    
    // Test Supabase connection
    const { data: testData, error: testError } = await supabase
      .from('news_articles')
      .select('count', { count: 'exact', head: true });
      
    if (testError) {
      console.error('❌ Supabase connection failed:', testError);
      return;
    }
    
    console.log('✅ Supabase connection successful');
    console.log(`📊 Current articles in Supabase: ${testData || 0}`);
    
    // Scrape all RSS feeds
    let allArticles = [];
    
    for (const feedConfig of RSS_FEEDS) {
      const articles = await scrapeRSSFeed(feedConfig);
      allArticles = allArticles.concat(articles);
      
      // Small delay to be respectful to servers
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`📰 Total articles scraped: ${allArticles.length}`);
    
    if (allArticles.length === 0) {
      console.log('⚠️ No articles scraped, exiting...');
      return;
    }
    
    // Sort by published date (newest first) and quality
    allArticles.sort((a, b) => {
      const dateA = new Date(a.published_at);
      const dateB = new Date(b.published_at);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime(); // Newest first
      }
      return (b.quality_score || 0) - (a.quality_score || 0); // Then by quality
    });
    
    // Upload to Supabase in batches
    const batchSize = 10;
    let uploaded = 0;
    let skipped = 0;
    
    for (let i = 0; i < allArticles.length; i += batchSize) {
      const batch = allArticles.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('news_articles')
          .upsert(batch, { 
            onConflict: 'url',
            ignoreDuplicates: false 
          })
          .select();
          
        if (error) {
          console.warn(`⚠️ Batch ${Math.floor(i/batchSize) + 1} error:`, error.message);
          skipped += batch.length;
        } else {
          uploaded += data?.length || 0;
          console.log(`✅ Uploaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allArticles.length/batchSize)} (${data?.length || 0} articles)`);
        }
        
      } catch (batchError) {
        console.warn(`⚠️ Batch ${Math.floor(i/batchSize) + 1} failed:`, batchError.message);
        skipped += batch.length;
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Final status check
    const { data: finalCount } = await supabase
      .from('news_articles')
      .select('count', { count: 'exact', head: true });
    
    console.log('\n🎉 Fresh News Scraping Complete!');
    console.log(`✅ Successfully uploaded: ${uploaded} articles`);
    console.log(`⚠️ Skipped/Failed: ${skipped} articles`);
    console.log(`📊 Total articles now in Supabase: ${finalCount || 0}`);
    console.log(`🕒 Latest scrape: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('💥 Fatal error in fresh news scraping:', error);
    process.exit(1);
  }
}

// Run the scraper
uploadFreshNews();
