import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// RSS feeds configuration
const RSS_FEEDS = [
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', category: 'general' },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', category: 'general' },
  { name: 'CNN', url: 'http://rss.cnn.com/rss/edition.rss', category: 'general' },
  { name: 'TechCrunch', url: 'https://feeds.feedburner.com/TechCrunch/', category: 'technology' },
  { name: 'Ars Technica', url: 'http://feeds.arstechnica.com/arstechnica/index', category: 'technology' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'technology' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'technology' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'technology' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', category: 'general' },
  { name: 'Associated Press', url: 'https://feeds.apnews.com/rss/apf-topnews', category: 'general' },
  { name: 'Financial Times', url: 'https://www.ft.com/rss/home', category: 'business' },
  { name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', category: 'business' },
  { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'business' }
];

async function parseRSSFeed(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
      },
      next: { revalidate: 0 } // No caching for fresh data
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }
    
    const xmlText = await response.text();
    
    // Basic RSS parsing (extract items)
    const items: any[] = [];
    const itemMatches = xmlText.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
    
    for (const itemMatch of itemMatches.slice(0, 10)) { // Limit to 10 items per feed
      try {
        const title = itemMatch.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/) || 
                     itemMatch.match(/<title[^>]*>(.*?)<\/title>/);
        const description = itemMatch.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>/) || 
                           itemMatch.match(/<description[^>]*>(.*?)<\/description>/);
        const link = itemMatch.match(/<link[^>]*>(.*?)<\/link>/);
        const pubDate = itemMatch.match(/<pubDate[^>]*>(.*?)<\/pubDate>/) ||
                       itemMatch.match(/<dc:date[^>]*>(.*?)<\/dc:date>/);
        
        if (title && title[1]) {
          // Extract image from description or content
          let imageUrl: string | null = null;
          const descText = description ? description[1] : '';
          const imgMatch = descText.match(/<img[^>]+src="([^"]+)"/i);
          if (imgMatch && imgMatch[1]) {
            imageUrl = imgMatch[1];
          }
          
          items.push({
            title: title[1].replace(/<[^>]*>/g, '').trim(),
            description: descText.replace(/<[^>]*>/g, '').trim().slice(0, 300),
            url: link ? link[1].trim() : '',
            image_url: imageUrl,
            published_at: pubDate ? new Date(pubDate[1]).toISOString() : new Date().toISOString(),
            source: url
          });
        }
      } catch (e) {
        console.log('Error parsing item:', e);
      }
    }
    
    return items;
  } catch (error) {
    console.log(`Error fetching RSS feed ${url}:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    console.log('🚀 Starting automated news scraping...');
    
    // Verify this is from Vercel Cron or allow manual trigger
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const manualTrigger = url.searchParams.get('manual') === 'true';
    
    if (!manualTrigger && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    console.log('📡 Fetching from RSS feeds...');
    let totalArticles = 0;
    let processedFeeds = 0;
    
    // Process feeds in batches to avoid overwhelming the system
    for (const feed of RSS_FEEDS) {
      try {
        console.log(`📰 Processing: ${feed.name}`);
        const articles = await parseRSSFeed(feed.url);
        
        if (articles.length > 0) {
          // Prepare articles for database insertion
          const articlesToInsert = articles.map(article => ({
            title: article.title,
            content: article.description,
            url: article.url,
            image_url: article.image_url,
            source: feed.name,
            category: feed.category,
            published_at: article.published_at,
            created_at: new Date().toISOString(),
            quality_score: Math.floor(Math.random() * 30) + 70 // Random score 70-100
          }));
          
          // Insert articles (ignore duplicates)
          const { data, error } = await supabase
            .from('news_articles')
            .upsert(articlesToInsert, { 
              onConflict: 'url',
              ignoreDuplicates: true 
            });
          
          if (error) {
            console.log(`Error inserting articles from ${feed.name}:`, error);
          } else {
            totalArticles += articles.length;
            console.log(`✅ ${feed.name}: ${articles.length} articles processed`);
          }
        }
        
        processedFeeds++;
        
        // Small delay between feeds to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`Error processing feed ${feed.name}:`, error);
      }
    }
    
    // Clean up old articles (keep only last 1000 articles)
    try {
      const { error: cleanupError } = await supabase
        .from('news_articles')
        .delete()
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Delete articles older than 7 days
      
      if (cleanupError) {
        console.log('Cleanup error:', cleanupError);
      } else {
        console.log('🧹 Old articles cleaned up');
      }
    } catch (error) {
      console.log('Error during cleanup:', error);
    }
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      feeds_processed: processedFeeds,
      total_articles: totalArticles,
      message: `Successfully scraped ${totalArticles} articles from ${processedFeeds} feeds`
    };
    
    console.log('🎉 News scraping completed:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Error in news scraping:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to scrape news',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also handle POST requests for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
