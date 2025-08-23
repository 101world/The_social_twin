import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required'
      }, { status: 400 });
    }

    const searchTerm = query.trim().toLowerCase();
    
    // First, check if we have recent articles matching the search in Supabase
    const { data: existingArticles } = await supabase
      .from('news_articles')
      .select('*')
      .or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,source.ilike.%${searchTerm}%`)
      .order('published_at', { ascending: false })
      .limit(20);

    // If we found relevant articles, return them
    if (existingArticles && existingArticles.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          articles: existingArticles,
          total: existingArticles.length,
          source: 'cached',
          query: searchTerm
        }
      });
    }

    // If no cached results, perform live RSS search
    const parser = new Parser();
    const searchResults: any[] = [];
    
    // Search-specific RSS feeds with query parameters
    const searchFeeds = [
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
    ];

    // General feeds to search through
    const generalFeeds = [
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
      'http://feeds.bbci.co.uk/news/world/rss.xml',
      'https://feeds.reuters.com/reuters/worldNews',
      'https://www.theguardian.com/world/rss'
    ];

    // Search through feeds
    for (const feedUrl of [...searchFeeds, ...generalFeeds]) {
      try {
        const feed = await parser.parseURL(feedUrl);
        
        for (const entry of (feed.items || []).slice(0, 15)) {
          const title = entry.title || '';
          const content = entry.contentSnippet || entry.content || '';
          const summary = content.slice(0, 300);
          
          // Check if the search term appears in title or content
          if (title.toLowerCase().includes(searchTerm) || 
              content.toLowerCase().includes(searchTerm)) {
            
            const article = {
              id: entry.id || entry.link || Math.random().toString(36).slice(2),
              title: title,
              snippet: summary,
              summary: summary,
              url: entry.link,
              image_url: null, // RSS usually doesn't have images
              video_url: null,
              youtube_url: null,
              category: 'Search Result',
              source: feed.title || 'Search',
              published_at: entry.isoDate || new Date().toISOString(),
              quality_score: title.toLowerCase().includes(searchTerm) ? 3 : 1, // Higher score for title matches
              content_hash: null
            };
            
            searchResults.push(article);
            
            if (searchResults.length >= 30) break;
          }
        }
        
        if (searchResults.length >= 30) break;
        
      } catch (feedError) {
        console.warn(`Failed to fetch feed ${feedUrl}:`, feedError);
        continue;
      }
    }

    // Sort by quality score and recency
    searchResults.sort((a, b) => {
      const scoreA = a.quality_score || 0;
      const scoreB = b.quality_score || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

    // Save search results to Supabase for future reference
    if (searchResults.length > 0) {
      try {
        const articlesToSave = searchResults.slice(0, 20).map(article => ({
          title: article.title,
          summary: article.summary,
          url: article.url,
          image_url: article.image_url,
          video_url: article.video_url,
          youtube_url: article.youtube_url,
          category: article.category,
          source: article.source,
          published_at: article.published_at,
          quality_score: article.quality_score,
          content_hash: article.content_hash
        }));

        await supabase
          .from('news_articles')
          .upsert(articlesToSave, { 
            onConflict: 'url',
            ignoreDuplicates: true 
          });
      } catch (saveError) {
        console.warn('Failed to save search results:', saveError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        articles: searchResults,
        total: searchResults.length,
        source: 'live_search',
        query: searchTerm
      }
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
