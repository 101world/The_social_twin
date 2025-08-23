import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface NewsArticle {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  category: string;
  publishDate: string;
  imageUrl?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const category = searchParams.get('category') || 'all';
    
    if (!query.trim()) {
      return NextResponse.json({ articles: [] });
    }
    
    // Path to cached articles
    const cacheFile = join(process.cwd(), 'data', 'daily-brief.json');
    
    let articles: NewsArticle[] = [];
    
    if (existsSync(cacheFile)) {
      const cacheData = readFileSync(cacheFile, 'utf-8');
      const briefing = JSON.parse(cacheData);
      articles = briefing.articles || [];
    }
    
    // Filter articles based on search query and category
    const filteredArticles = articles.filter(article => {
      const matchesQuery = 
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.snippet.toLowerCase().includes(query.toLowerCase()) ||
        article.source.toLowerCase().includes(query.toLowerCase());
      
      const matchesCategory = 
        category === 'all' || 
        article.category.toLowerCase() === category.toLowerCase();
      
      return matchesQuery && matchesCategory;
    });
    
    // If no cached results found, perform real-time search (mock for now)
    if (filteredArticles.length === 0) {
      // In production, this would call external news APIs or perform web scraping
      const mockResults: NewsArticle[] = [
        {
          id: `search-${Date.now()}`,
          title: `Real-time search results for "${query}"`,
          snippet: `This would contain live search results from news APIs for the query "${query}". Implement external API calls here for real-time news search.`,
          url: 'https://101world.io',
          source: 'LiveSearch',
          category: category === 'all' ? 'General' : category,
          publishDate: new Date().toISOString()
        }
      ];
      
      return NextResponse.json({ 
        articles: mockResults,
        cached: false,
        query,
        category
      });
    }
    
    // Sort by relevance (title matches first, then snippet matches)
    const sortedArticles = filteredArticles.sort((a, b) => {
      const aScore = a.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      const bScore = b.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      return bScore - aScore;
    });
    
    return NextResponse.json({
      articles: sortedArticles.slice(0, 20), // Limit to 20 results
      cached: true,
      query,
      category
    });
    
  } catch (error) {
    console.error('Error searching news:', error);
    return NextResponse.json(
      { error: 'Search failed', articles: [] },
      { status: 500 }
    );
  }
}
