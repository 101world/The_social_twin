import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for full access
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const mediaType = searchParams.get('media');
    const limit = parseInt(searchParams.get('limit') || '20');

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

    // Get articles from last 7 days by default
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    query = query.gte('published_at', sevenDaysAgo.toISOString());

    const { data: articles, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Get category statistics
    const { data: categoryStats } = await supabase
      .from('news_by_category')
      .select('*');

    // Get total count
    const { count } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', sevenDaysAgo.toISOString());

    return NextResponse.json({
      success: true,
      data: {
        articles: articles || [],
        total: count || 0,
        categories: categoryStats || [],
        filters: {
          category,
          search,
          mediaType,
          limit
        },
        metadata: {
          total_articles: count || 0,
          with_images: articles?.filter(a => a.image_url).length || 0,
          with_videos: articles?.filter(a => a.video_url).length || 0,
          with_youtube: articles?.filter(a => a.youtube_url).length || 0,
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

    // Insert articles into Supabase
    const { data, error } = await supabase
      .from('news_articles')
      .insert(articles)
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
