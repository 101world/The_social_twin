import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

// Initialize Supabase client with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

// Enhanced RSS feeds with good image support
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
    url: 'https://techcrunch.com/feed/', 
    category: 'Technology',
    source: 'TechCrunch'
  },
  { 
    url: 'https://feeds.finance.yahoo.com/rss/2.0/headline', 
    category: 'Business',
    source: 'Yahoo Finance'
  }
];

async function extractImageUrl(item: any) {
  let imageUrl = null;
  
  // Try different image sources in order of preference
  if (item['media:content']?.$ && item['media:content'].$.url) {
    imageUrl = item['media:content'].$.url;
  } else if (item['media:thumbnail']?.$ && item['media:thumbnail'].$.url) {
    imageUrl = item['media:thumbnail'].$.url;
  } else if (item.enclosure && item.enclosure.url && item.enclosure.type?.includes('image')) {
    imageUrl = item.enclosure.url;
  } else if (item.content && item.content.includes('<img')) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch) imageUrl = imgMatch[1];
  } else if (item.description && item.description.includes('<img')) {
    const imgMatch = item.description.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch) imageUrl = imgMatch[1];
  }
  
  // Clean and validate image URL
  if (imageUrl) {
    imageUrl = imageUrl.split('?')[0];
    
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

async function calculateQualityScore(item: any) {
  let score = 1;
  
  if (item.title && item.title.length > 20) score += 1;
  if (item.contentSnippet && item.contentSnippet.length > 50) score += 1;
  if (item.creator || item.author) score += 1;
  if (await extractImageUrl(item)) score += 2;
  
  const pubDate = new Date(item.pubDate || item.isoDate || Date.now());
  const hoursOld = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
  if (hoursOld < 1) score += 3;
  else if (hoursOld < 6) score += 2;
  else if (hoursOld < 24) score += 1;
  
  return Math.min(score, 10);
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Manual news scraping triggered...');
    
    // Test Supabase connection
    const { data: testData, error: testError } = await supabase
      .from('news_articles')
      .select('count', { count: 'exact', head: true });
      
    if (testError) {
      console.error('❌ Supabase connection failed:', testError);
      return NextResponse.json({
        success: false,
        error: 'Supabase connection failed',
        details: testError.message
      }, { status: 500 });
    }
    
    console.log('✅ Supabase connection successful');
    console.log(`📊 Current articles in Supabase: ${testData || 0}`);
    
    // Clean up old articles first
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: deletedArticles } = await supabase
      .from('news_articles')
      .delete()
      .lt('created_at', oneDayAgo)
      .select();
      
    console.log(`🗑️ Cleaned up ${deletedArticles?.length || 0} old articles`);
    
    // Scrape all RSS feeds
    let allArticles = [];
    
    for (const feedConfig of RSS_FEEDS) {
      try {
        console.log(`📡 Scraping ${feedConfig.source}...`);
        const feed = await parser.parseURL(feedConfig.url);
        
        for (const item of (feed.items || []).slice(0, 10)) {
          const imageUrl = await extractImageUrl(item);
          const qualityScore = await calculateQualityScore(item);
          
          const article = {
            title: item.title || 'Untitled',
            summary: item.contentSnippet || item.summary || item.content?.slice(0, 300) || '',
            url: item.link,
            image_url: imageUrl,
            video_url: null,
            youtube_url: null,
            category: feedConfig.category,
            source: feedConfig.source,
            published_at: item.pubDate || item.isoDate || new Date().toISOString(),
            quality_score: qualityScore,
            content_hash: null
          };
          
          allArticles.push(article);
        }
        
        console.log(`✅ Scraped ${feed.items?.length || 0} articles from ${feedConfig.source}`);
        
      } catch (error) {
        console.error(`❌ Failed to scrape ${feedConfig.source}:`, (error as Error).message);
      }
    }
    
    console.log(`📰 Total articles scraped: ${allArticles.length}`);
    
    if (allArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No articles scraped',
        details: 'All RSS feeds failed'
      }, { status: 500 });
    }
    
    // Sort by published date and quality
    allArticles.sort((a, b) => {
      const dateA = new Date(a.published_at);
      const dateB = new Date(b.published_at);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return (b.quality_score || 0) - (a.quality_score || 0);
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
          console.log(`✅ Uploaded batch ${Math.floor(i/batchSize) + 1}`);
        }
        
      } catch (batchError) {
        console.warn(`⚠️ Batch ${Math.floor(i/batchSize) + 1} failed:`, (batchError as Error).message);
        skipped += batch.length;
      }
    }
    
    // Final status
    const { data: finalCount } = await supabase
      .from('news_articles')
      .select('count', { count: 'exact', head: true });
    
    return NextResponse.json({
      success: true,
      message: 'News scraping completed successfully',
      data: {
        uploaded: uploaded,
        skipped: skipped,
        totalArticles: finalCount || 0,
        lastUpdated: new Date().toISOString(),
        feedsProcessed: RSS_FEEDS.length
      }
    });

  } catch (error) {
    console.error('💥 Fatal error in news scraping:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to scrape news',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'News scraper endpoint',
    usage: 'POST to trigger manual news scraping',
    status: 'Ready'
  });
}
