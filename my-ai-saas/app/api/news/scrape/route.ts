import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const Parser = require('rss-parser');
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
  { 
    url: 'https://www.wired.com/feed/rss', 
    category: 'Technology',
    source: 'Wired'
  },
  { 
    url: 'https://feeds.washingtonpost.com/rss/world', 
    category: 'World News',
    source: 'Washington Post'
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
  } else if (item.content && (item.content.includes('<img') || item.content.match(/srcset=|<picture|<source/))) {
    // Extract images from content, handle srcset/picture and prefer largest candidate
    const html = String(item.content || '');
    const candidates: { url: string; w?: number; dimW?: number; dimH?: number }[] = [];

    // Parse srcset attributes
    for (const m of [...html.matchAll(/srcset=["']([^"']+)["']/gi)]) {
      const srcset = m[1];
      for (const part of srcset.split(',')) {
        const p = part.trim();
        const [u, size] = p.split(/\s+/);
        if (!u) continue;
        const wMatch = (size || '').match(/(\d+)w/);
        candidates.push({ url: u, w: wMatch ? parseInt(wMatch[1], 10) : undefined });
      }
    }

    // Parse <source srcset=>
    for (const m of [...html.matchAll(/<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi)]) {
      const srcset = m[1];
      for (const part of srcset.split(',')) {
        const p = part.trim();
        const [u, size] = p.split(/\s+/);
        if (!u) continue;
        const wMatch = (size || '').match(/(\d+)w/);
        candidates.push({ url: u, w: wMatch ? parseInt(wMatch[1], 10) : undefined });
      }
    }

    // Parse <img src=>
    for (const match of [...html.matchAll(/<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi)]) {
      candidates.push({ url: match[1] });
    }

    // Normalize and detect explicit dims
    for (const c of candidates) {
      if (!c.url) continue;
      if (c.url.startsWith('//')) c.url = 'https:' + c.url;
      const dim = (c.url.match(/(\d{2,4})x(\d{2,4})/) || []);
      c.dimW = dim[1] ? parseInt(dim[1], 10) : undefined;
      c.dimH = dim[2] ? parseInt(dim[2], 10) : undefined;
    }

    // Prefer largest declared width or explicit dimensions
    candidates.sort((a, b) => (b.w || 0) - (a.w || 0) || (b.dimW || 0) - (a.dimW || 0));
    for (const c of candidates) {
      const src = c.url;
      const qualifies = (c.w && c.w >= 600) || (c.dimW && c.dimW >= 600) || /large|hero|featured|main|banner|portrait/i.test(src);
      if (qualifies) { imageUrl = src; break; }
      if (!imageUrl) imageUrl = src;
    }
  } else if (item.description && item.description.includes('<img')) {
    // Mirror same srcset/picture logic for description
    const html = String(item.description || '');
    const candidates: { url: string; w?: number; dimW?: number }[] = [];
    for (const m of [...html.matchAll(/srcset=["']([^"']+)["']/gi)]) {
      const srcset = m[1];
      for (const part of srcset.split(',')) {
        const p = part.trim();
        const [u, size] = p.split(/\s+/);
        if (!u) continue;
        const wMatch = (size || '').match(/(\d+)w/);
        candidates.push({ url: u, w: wMatch ? parseInt(wMatch[1], 10) : undefined });
      }
    }
    for (const match of [...html.matchAll(/<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi)]) candidates.push({ url: match[1] });
    for (const c of candidates) if (c.url && c.url.startsWith('//')) c.url = 'https:' + c.url;
    for (const c of candidates) {
      const dim = (c.url.match(/(\d{2,4})x(\d{2,4})/) || []);
      c.dimW = dim[1] ? parseInt(dim[1], 10) : undefined;
    }
    candidates.sort((a, b) => (b.w || 0) - (a.w || 0) || (b.dimW || 0) - (a.dimW || 0));
    for (const c of candidates) {
      const src = c.url;
      const qualifies = (c.w && c.w >= 600) || (c.dimW && c.dimW >= 600) || /large|hero|featured|main|banner|portrait/i.test(src);
      if (qualifies) { imageUrl = src; break; }
      if (!imageUrl) imageUrl = src;
    }
  }
  
  // Clean, upgrade and validate image URL
  if (imageUrl) {
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    try {
      const url = new URL(imageUrl);
      // Keep only useful sizing params and attempt to upgrade where possible
      const keepParams = ['w', 'h', 'width', 'height', 'size', 'quality', 'q', 'crop', 'fit', 'format'];
      const newParams = new URLSearchParams();
      for (const [key, value] of url.searchParams) {
        if (keepParams.some(param => key.toLowerCase().includes(param))) newParams.set(key, value);
      }
      url.search = newParams.toString();
      // Upgrade common host params
      if (url.hostname.includes('wordpress.com') || url.hostname.includes('wp.com')) {
        url.searchParams.set('w', '1600');
        url.searchParams.set('h', '1200');
        url.searchParams.set('crop', '1');
      } else if (url.hostname.includes('imgix') || url.hostname.includes('cloudinary') || url.hostname.includes('cdn') || url.hostname.includes('cloudfront') || url.hostname.includes('akamai')) {
        url.searchParams.set('w', '1600');
        url.searchParams.set('q', '90');
      }
      imageUrl = url.toString();

      // Validate extension/hosts
      const isImageExt = /\.(jpg|jpeg|png|gif|webp|avif)(?:\?|$)/i.test(imageUrl);
      const knownHost = /images\.|img\.|cdn\.|static\.|media\.|wordpress.com|medium.com|unsplash.com|pexels.com|cloudinary.com/.test(imageUrl);

      // Determine explicit dimensions if present
      const dimMatch = imageUrl.match(/(\d{2,4})x(\d{2,4})/);
      const hasLargeDim = dimMatch ? (parseInt(dimMatch[1], 10) >= 600 || parseInt(dimMatch[2], 10) >= 600) : false;

      if (isImageExt || knownHost) {
        if (!/icon|favicon|avatar/i.test(imageUrl) && (hasLargeDim || /large|hero|featured|main|banner|portrait/i.test(imageUrl) || knownHost)) {
          return imageUrl;
        }
      }
    } catch (e) {
      // If URL parsing fails, continue and fall back to OG step
    }
  }
  
  return null;
}

// Fetch Open Graph metadata from an article page to improve image/title/description
async function fetchOpenGraph(url: string): Promise<{ image?: string | null; title?: string | null; description?: string | null }> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // Increased timeout for better image discovery
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      signal: controller.signal as any
    } as any);
    clearTimeout(id);
    if (!res.ok) return {};
    const html = await res.text();
    
    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m && m[1] ? m[1].trim() : null;
    };
    
    // Enhanced image extraction with priority order for higher quality images
    let ogImage = 
      // Twitter card image (often high quality)
      pick(/<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
      pick(/<meta[^>]+property=["']twitter:image["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
      // Open Graph image
      pick(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
      pick(/<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
      pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
      // Article image
      pick(/<meta[^>]+property=["']article:image["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
      // Schema.org image
      pick(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
      // Fallback to first img src with size indicators
      pick(/<img[^>]+src=["']([^"'>]*(?:large|big|main|featured|hero|banner)[^"'>]*)["'][^>]*>/i) ||
      pick(/<img[^>]+src=["']([^"'>]*\d{3,4}x\d{3,4}[^"'>]*)["'][^>]*>/i);
      
    // Validate and improve image URL quality
    if (ogImage) {
      // Convert relative URLs to absolute
      if (ogImage.startsWith('//')) {
        ogImage = 'https:' + ogImage;
      } else if (ogImage.startsWith('/')) {
        const baseUrl = new URL(url);
        ogImage = baseUrl.origin + ogImage;
      }
      
      // Filter out small or low-quality images
      if (ogImage.includes('icon') || ogImage.includes('favicon') || 
          ogImage.includes('logo') && !ogImage.includes('large')) {
        ogImage = null;
      }
      
      // Prefer higher resolution variants if available
      if (ogImage && ogImage.includes('?')) {
        // Try to upgrade image quality by modifying URL parameters
        const url = new URL(ogImage);
        if (url.hostname.includes('wordpress.com') || url.hostname.includes('wp.com')) {
        url.searchParams.set('w', '1600');
        url.searchParams.set('h', '1200');
          url.searchParams.set('crop', '1');
          ogImage = url.toString();
        } else if (url.hostname.includes('medium.com')) {
          // Medium image optimization
        ogImage = ogImage.replace(/\*\d+$/, '*1600');
        }
      }
    }
    
    const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) || 
                     pick(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
                     pick(/<title[^>]*>([^<]+)<\/title>/i);
    const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) || 
                   pick(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"'>]+)["'][^>]*>/i) ||
                   pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"'>]+)["'][^>]*>/i);
    return { image: ogImage || null, title: ogTitle || null, description: ogDesc || null };
  } catch {
    return {};
  }
}

async function calculateQualityScore(item: any) {
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

async function scrapeRSSFeed(feedConfig: any) {
  try {
    console.log(`📡 Scraping ${feedConfig.source}...`);
    const feed = await parser.parseURL(feedConfig.url);
    const articles = [];
    
    for (const item of (feed.items || []).slice(0, 20)) {
      let imageUrl = await extractImageUrl(item);
      const qualityScore = await calculateQualityScore(item);
      
      let title = item.title || 'Untitled';
      let summary = item.contentSnippet || item.summary || item.content?.slice(0, 300) || '';
      const url = item.link;

      // If we couldn't get a solid image or title/snippet is weak, try Open Graph
      if ((!imageUrl || !/\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl)) && url) {
        const og = await fetchOpenGraph(url);
        if (og?.image) imageUrl = og.image;
        if (og?.title && (!title || title.toLowerCase() === 'untitled')) title = og.title;
        if (og?.description && (!summary || summary.length < 40)) summary = og.description;
      }

      const article = {
        title,
        summary,
        url,
        image_url: imageUrl,
        video_url: null,
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
    console.error(`❌ Failed to scrape ${feedConfig.source}:`, (error as Error).message);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting live news scraping...');
    
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
    
    // Clean up old news first
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: deletedArticles } = await supabase
      .from('news_articles')
      .delete()
      .lt('created_at', oneDayAgo)
      .select();
      
    console.log(`🗑️ Cleaned up ${deletedArticles?.length || 0} old articles`);
    
    // Scrape all RSS feeds
    let allArticles: any[] = [];
    
    for (const feedConfig of RSS_FEEDS) {
      const articles = await scrapeRSSFeed(feedConfig);
      allArticles = allArticles.concat(articles);
      
      // Small delay to be respectful to servers
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`📰 Total articles scraped: ${allArticles.length}`);
    
    if (allArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No articles scraped'
      }, { status: 500 });
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
        console.warn(`⚠️ Batch ${Math.floor(i/batchSize) + 1} failed:`, (batchError as Error).message);
        skipped += batch.length;
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Final status check
    const { data: finalCount } = await supabase
      .from('news_articles')
      .select('count', { count: 'exact', head: true });
    
    return NextResponse.json({
      success: true,
      message: 'News scraping completed successfully',
      data: {
        uploaded: uploaded,
        skipped: skipped,
        total_articles: finalCount || 0,
        scraped_from: RSS_FEEDS.length,
        last_updated: new Date().toISOString()
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
