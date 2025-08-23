import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type') || 'all'; // 'images', 'videos', 'youtube', 'all'
    const limit = parseInt(searchParams.get('limit') || '20');

    // Use the Supabase multimedia function
    const { data: articles, error } = await supabase
      .rpc('get_multimedia_news', {
        media_type: mediaType,
        limit_count: limit
      });

    if (error) {
      console.error('Supabase multimedia error:', error);
      throw error;
    }

    // Calculate multimedia statistics
    const stats = {
      total: articles?.length || 0,
      with_images: articles?.filter(a => a.image_url).length || 0,
      with_videos: articles?.filter(a => a.video_url).length || 0,
      with_youtube: articles?.filter(a => a.youtube_url).length || 0,
      multimedia_only: articles?.filter(a => 
        a.image_url || a.video_url || a.youtube_url
      ).length || 0
    };

    // Group by media type for better organization
    const categorized = {
      images: articles?.filter(a => a.image_url) || [],
      videos: articles?.filter(a => a.video_url) || [],
      youtube: articles?.filter(a => a.youtube_url) || [],
      all: articles || []
    };

    // Get top categories with multimedia content
    const categoryStats = {};
    articles?.forEach(article => {
      const cat = article.category || 'General';
      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          count: 0,
          with_images: 0,
          with_videos: 0,
          with_youtube: 0
        };
      }
      categoryStats[cat].count++;
      if (article.image_url) categoryStats[cat].with_images++;
      if (article.video_url) categoryStats[cat].with_videos++;
      if (article.youtube_url) categoryStats[cat].with_youtube++;
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: articles || [],
        categorized,
        statistics: stats,
        category_breakdown: Object.entries(categoryStats).map(([category, stats]) => ({
          category,
          ...stats
        })).sort((a, b) => b.count - a.count),
        filters: {
          media_type: mediaType,
          limit
        },
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Multimedia news API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch multimedia news',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
