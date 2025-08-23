import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      }, { status: 400 });
    }

    // Use the Supabase search function
    const { data: articles, error } = await supabase
      .rpc('search_news', {
        search_query: query.trim(),
        category_filter: category,
        limit_count: limit
      });

    if (error) {
      console.error('Supabase search error:', error);
      throw error;
    }

    // Calculate search relevance scores
    const scoredArticles = articles?.map(article => {
      let relevanceScore = 0;
      const queryLower = query.toLowerCase();
      const titleLower = (article.title || '').toLowerCase();
      const summaryLower = (article.summary || '').toLowerCase();

      // Title matches get higher score
      if (titleLower.includes(queryLower)) {
        relevanceScore += 10;
      }

      // Summary matches
      if (summaryLower.includes(queryLower)) {
        relevanceScore += 5;
      }

      // Exact word matches get bonus
      const queryWords = queryLower.split(' ');
      queryWords.forEach(word => {
        if (titleLower.includes(word)) relevanceScore += 3;
        if (summaryLower.includes(word)) relevanceScore += 1;
      });

      return {
        ...article,
        relevance_score: relevanceScore
      };
    }).sort((a, b) => b.relevance_score - a.relevance_score) || [];

    // Get related categories for this search
    const relatedCategories = {};
    scoredArticles.forEach(article => {
      const cat = article.category || 'General';
      relatedCategories[cat] = (relatedCategories[cat] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: scoredArticles,
        total: scoredArticles.length,
        query,
        related_categories: Object.entries(relatedCategories)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count),
        filters: {
          query,
          category,
          limit
        },
        metadata: {
          search_time: new Date().toISOString(),
          total_results: scoredArticles.length,
          with_multimedia: scoredArticles.filter(a => 
            a.image_url || a.video_url || a.youtube_url
          ).length
        }
      },
      // Backward compatibility
      articles: scoredArticles,
      cached: false
    });

  } catch (error) {
    console.error('News search API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to search news articles',
      details: error instanceof Error ? error.message : 'Unknown error',
      articles: []
    }, { status: 500 });
  }
}
