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

interface DailyBrief {
  date: string;
  articles: NewsArticle[];
  categories: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Path to cached daily briefing
    const cacheFile = join(process.cwd(), 'data', 'daily-brief.json');
    
    // Check if cache file exists
    if (!existsSync(cacheFile)) {
      // Return mock data if cache doesn't exist yet
      const mockBrief: DailyBrief = {
        date: new Date().toISOString().split('T')[0],
        articles: [
          {
            id: 'mock-1',
            title: 'Welcome to Your News Dashboard',
            snippet: 'This is a placeholder article. The news scraper will populate this with real articles once configured. Set up your news sources and run the scraper to get started.',
            url: 'https://101world.io',
            source: '101World',
            category: 'Technology',
            publishDate: new Date().toISOString(),
            imageUrl: 'https://via.placeholder.com/600x400?text=News+Coming+Soon'
          },
          {
            id: 'mock-2',
            title: 'AI Technology Trends 2025',
            snippet: 'Artificial Intelligence continues to evolve at a rapid pace. This mock article demonstrates how news will be displayed once your scraper is configured.',
            url: 'https://101world.io',
            source: 'TechDaily',
            category: 'Technology',
            publishDate: new Date().toISOString()
          },
          {
            id: 'mock-3',
            title: 'Global Economic Updates',
            snippet: 'Stay informed about the latest economic developments worldwide. Real news articles will appear here once the scraping system is active.',
            url: 'https://101world.io',
            source: 'FinanceNews',
            category: 'Business',
            publishDate: new Date().toISOString()
          }
        ],
        categories: ['Technology', 'Business', 'Politics', 'Sports', 'Health', 'Environment']
      };
      
      return NextResponse.json(mockBrief);
    }

    // Read cached briefing
    const cacheData = readFileSync(cacheFile, 'utf-8');
    const briefing: DailyBrief = JSON.parse(cacheData);
    
    // Check if briefing is from today
    const today = new Date().toISOString().split('T')[0];
    if (briefing.date !== today) {
      // Briefing is outdated, trigger refresh (in production, this would trigger the scraper)
      console.log(`Daily briefing is outdated (${briefing.date} vs ${today}). Consider running the scraper.`);
    }
    
    return NextResponse.json(briefing);
    
  } catch (error) {
    console.error('Error loading daily brief:', error);
    
    // Return fallback data on error
    const fallbackBrief: DailyBrief = {
      date: new Date().toISOString().split('T')[0],
      articles: [
        {
          id: 'fallback-1',
          title: 'News Service Temporarily Unavailable',
          snippet: 'We are experiencing technical difficulties loading the news feed. Please try again later or contact support if this issue persists.',
          url: 'mailto:support@101world.io',
          source: '101World',
          category: 'System',
          publishDate: new Date().toISOString()
        }
      ],
      categories: ['System']
    };
    
    return NextResponse.json(fallbackBrief, { status: 500 });
  }
}
