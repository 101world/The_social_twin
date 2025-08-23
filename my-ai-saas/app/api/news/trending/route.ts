import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Use the Supabase function for trending news
    const { data: articles, error } = await supabase
      .rpc('get_trending_news', {
        category_filter: category,
        limit_count: limit
      });

    if (error) {
      console.error('Supabase trending error:', error);
      throw error;
    }

    // Get multimedia stats
    const multimedia_stats = {
      with_images: articles?.filter(a => a.image_url).length || 0,
      with_videos: articles?.filter(a => a.video_url).length || 0,
      with_youtube: articles?.filter(a => a.youtube_url).length || 0
    };

    // Group by category for trending topics
    const categories = {};
    articles?.forEach(article => {
      const cat = article.category || 'General';
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(article);
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: articles || [],
        total: articles?.length || 0,
        multimedia_stats,
        trending_categories: Object.keys(categories).map(cat => ({
          category: cat,
          count: categories[cat].length,
          latest: categories[cat][0]?.published_at
        })),
        filters: {
          category,
          limit
        },
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Trending news API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch trending news',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
