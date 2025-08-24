import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const mediaType = searchParams.get('media');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Always prefer ultra-fresh articles: last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    let query = supabase
      .from('news_articles')
      .select('*')
      .gte('published_at', thirtyMinutesAgo)
      .order('quality_score', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

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

    const { data: articles, error } = await query;
    if (error) throw error;

    const { count } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', thirtyMinutesAgo);

    const { data: categoriesData } = await supabase
      .from('news_articles')
      .select('category')
      .gte('published_at', thirtyMinutesAgo);

    const categoryStats = (categoriesData || []).reduce((acc: any[], row: any) => {
      const found = acc.find((c) => c.category === row.category);
      if (found) found.article_count += 1; else acc.push({ category: row.category, article_count: 1 });
      return acc;
    }, [] as any[]);

    return NextResponse.json({
      success: true,
      data: {
        articles: articles || [],
        total: count || 0,
        categories: categoryStats,
        filters: { category, search, mediaType, limit },
        metadata: {
          total_articles: count || 0,
          with_images: (articles || []).filter((a: any) => a.image_url).length,
          with_videos: (articles || []).filter((a: any) => a.video_url).length,
          with_youtube: (articles || []).filter((a: any) => a.youtube_url).length,
          last_updated: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    console.error('News API error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news articles' },
      { status: 500 }
    );
  }
}
