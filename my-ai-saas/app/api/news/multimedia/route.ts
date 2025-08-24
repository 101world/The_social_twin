import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Minimal shape used by this API; Supabase RPC may return more fields
type Article = {
  id?: string;
  title?: string;
  content?: string;
  published_at?: string;
  source_name?: string;
  source_url?: string;
  category?: string;
  image_url?: string | null;
  video_url?: string | null;
  youtube_url?: string | null;
  [k: string]: unknown;
};

type CategoryAgg = {
  count: number;
  with_images: number;
  with_videos: number;
  with_youtube: number;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get('type') || 'all'; // 'images', 'videos', 'youtube', 'all'
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10) || 20;

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

  const list: Article[] = (articles as Article[] | null) ?? [];

    // Calculate multimedia statistics
    const stats = {
      total: list.length,
      with_images: list.filter(a => !!a.image_url).length,
      with_videos: list.filter(a => !!a.video_url).length,
      with_youtube: list.filter(a => !!a.youtube_url).length,
      multimedia_only: list.filter(a => a.image_url || a.video_url || a.youtube_url).length,
    };

    // Group by media type for better organization
    const categorized = {
      images: list.filter(a => !!a.image_url),
      videos: list.filter(a => !!a.video_url),
      youtube: list.filter(a => !!a.youtube_url),
      all: list,
    };

    // Get top categories with multimedia content
    const categoryStats: Record<string, CategoryAgg> = {};
    for (const article of list) {
      const cat = (article.category || 'General') as string;
      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          count: 0,
          with_images: 0,
          with_videos: 0,
          with_youtube: 0,
        };
      }
      categoryStats[cat].count++;
      if (article.image_url) categoryStats[cat].with_images++;
      if (article.video_url) categoryStats[cat].with_videos++;
      if (article.youtube_url) categoryStats[cat].with_youtube++;
    }

    return NextResponse.json({
      success: true,
      data: {
        articles: list,
        categorized,
        statistics: stats,
        category_breakdown: Object.entries(categoryStats)
          .map(([category, s]) => ({ category, ...s }))
          .sort((a, b) => b.count - a.count),
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
