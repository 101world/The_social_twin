import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

// Initialize Supabase client with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to ensure the news_articles table exists
async function ensureTableExists() {
  try {
    // Try to create the table with all necessary columns
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS news_articles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          summary TEXT,
          url TEXT NOT NULL UNIQUE,
          image_url TEXT,
          video_url TEXT,
          youtube_url TEXT,
          category TEXT DEFAULT 'General',
          source TEXT,
          published_at TIMESTAMPTZ DEFAULT NOW(),
          quality_score INTEGER DEFAULT 0,
          content_hash TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category);
        CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_news_quality ON news_articles(quality_score DESC);
      `
    });
    
    if (error) {
      console.log('Table creation via RPC failed, trying direct approach');
      // Fallback: just test if we can query the table
      await supabase.from('news_articles').select('count', { count: 'exact', head: true });
    }
  } catch (error) {
    console.log('Table check/creation failed:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const mediaType = searchParams.get('media');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Ensure table exists
    await ensureTableExists();

    let query = supabase
      .from('news_articles')
      .select('*')
      .order('quality_score', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // Filter by media type
    if (mediaType) {
      switch (mediaType) {
        case 'images':
          query = query.not('image_url', 'is', null);
          break;
        case 'videos':
          query = query.not('video_url', 'is', null);
          break;
        case 'youtube':
          query = query.not('youtube_url', 'is', null);
          break;
        case 'multimedia':
          query = query.or('image_url.not.is.null,video_url.not.is.null,youtube_url.not.is.null');
          break;
      }
    }

  // Get articles from last 30 minutes by default for ultra-fresh feed
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  query = query.gte('published_at', thirtyMinutesAgo.toISOString());

    const { data: articles, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    // If no fresh articles found, fall back to direct RSS so page is never empty
    let fallbackArticles: any[] = [];
    if (!articles || articles.length === 0) {
      try {
        const parser = new Parser();
        const feeds = [
          'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
          'http://feeds.bbci.co.uk/news/world/rss.xml',
          'https://feeds.reuters.com/reuters/worldNews',
          'https://www.theguardian.com/world/rss'
        ];
        const results: any[] = [];
        for (const url of feeds) {
          const feed = await parser.parseURL(url);
          for (const entry of (feed.items || []).slice(0, 10)) {
            results.push({
              id: entry.id || entry.link || Math.random().toString(36).slice(2),
              title: entry.title || 'Untitled',
              snippet: (entry.contentSnippet || entry.content || '').slice(0, 300),
              summary: (entry.contentSnippet || entry.content || '').slice(0, 300),
              url: entry.link,
              image_url: null,
              video_url: null,
              youtube_url: null,
              category: 'General',
              source: feed.title || 'RSS',
              published_at: entry.isoDate || new Date().toISOString(),
              quality_score: 1
            });
            if (results.length >= 50) break;
          }
          if (results.length >= 50) break;
        }
        fallbackArticles = results;
      } catch (e) {
        console.warn('RSS fallback failed:', (e as Error).message);
      }
    }

    // Get total count (based on Supabase fresh window)
    const { count } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', thirtyMinutesAgo.toISOString());

    // Get category statistics
    const { data: categories } = await supabase
      .from('news_articles')
      .select('category')
      .gte('published_at', thirtyMinutesAgo.toISOString());

    // Process categories
    const categoryStats = categories?.reduce((acc: any[], article: any) => {
      const existing = acc.find(c => c.category === article.category);
      if (existing) {
        existing.article_count++;
      } else {
        acc.push({
          category: article.category,
          article_count: 1
        });
      }
      return acc;
    }, []) || [];

    return NextResponse.json({
      success: true,
      data: {
  articles: (articles && articles.length > 0) ? articles : fallbackArticles,
  total: (articles && articles.length > 0) ? (count || articles.length) : fallbackArticles.length,
        categories: categoryStats,
        filters: {
          category,
          search,
          mediaType,
          limit
        },
        metadata: {
          total_articles: (articles && articles.length > 0) ? (count || 0) : fallbackArticles.length,
          with_images: (articles && articles.length > 0)
            ? (articles?.filter((a: any) => a.image_url).length || 0)
            : 0,
          with_videos: (articles && articles.length > 0)
            ? (articles?.filter((a: any) => a.video_url).length || 0)
            : 0,
          with_youtube: (articles && articles.length > 0)
            ? (articles?.filter((a: any) => a.youtube_url).length || 0)
            : 0,
          last_updated: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch news articles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articles } = body;

    if (!Array.isArray(articles)) {
      return NextResponse.json({
        success: false,
        error: 'Articles must be an array'
      }, { status: 400 });
    }

    // Ensure table exists before inserting
    await ensureTableExists();

    // Insert articles into Supabase with upsert to handle duplicates
    const { data, error } = await supabase
      .from('news_articles')
      .upsert(articles, { 
        onConflict: 'url',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        inserted: data?.length || 0,
        articles: data
      }
    });

  } catch (error) {
    console.error('News POST API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to insert news articles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
