"use client";

import { useState, useEffect, useMemo } from 'react';
import { Globe, Rocket, Heart, DollarSign, Palette, Leaf, Play, Image as ImageIcon } from 'lucide-react';

interface NewsArticle {
  id: string;
  title: string;
  snippet: string;
  summary?: string;
  url: string;
  image_url?: string;
  video_url?: string;
  youtube_url?: string;
  category: string;
  source: string;
  publish_date?: string;
  published_at?: string;
  quality_score?: number;
  author?: string;
  tags?: string[];
}

interface NewsData {
  articles: NewsArticle[];
  total: number;
  metadata?: {
    total_articles: number;
    with_images: number;
    with_videos: number;
    with_youtube: number;
    last_updated: string;
  };
}

const categoryConfig: Record<string, {
  icon: React.ComponentType<any>;
  color: string;
  accent: string;
  gradient: string;
  keywords: string[];
  description: string;
  bgColor: string;
  textColor: string;
}> = {
  'World News': {
    icon: Globe,
    color: 'bg-red-500',
    accent: 'border-red-200 hover:border-red-300',
    gradient: 'from-red-500 to-red-600',
    keywords: ['world', 'international', 'global', 'war', 'peace', 'disaster', 'breaking', 'government', 'politics'],
    description: 'Global headlines and breaking news',
    bgColor: 'bg-red-50',
    textColor: 'text-red-900'
  },
  'Future & Innovation': {
    icon: Rocket,
    color: 'bg-purple-500',
    accent: 'border-purple-200 hover:border-purple-300',
    gradient: 'from-purple-500 to-purple-600',
    keywords: ['technology', 'ai', 'space', 'innovation', 'breakthrough', 'discover', 'nasa', 'tech', 'startup', 'crypto'],
    description: 'Technology, AI, space exploration and scientific breakthroughs',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-900'
  },
  'Human Stories': {
    icon: Heart,
    color: 'bg-pink-500',
    accent: 'border-pink-200 hover:border-pink-300',
    gradient: 'from-pink-500 to-pink-600',
    keywords: ['human', 'survivor', 'hero', 'inspiring', 'culture', 'community', 'life', 'story', 'people'],
    description: 'Inspiring human interest stories and cultural highlights',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-900'
  },
  'Money & Power': {
    icon: DollarSign,
    color: 'bg-green-500',
    accent: 'border-green-200 hover:border-green-300',
    gradient: 'from-green-500 to-green-600',
    keywords: ['business', 'finance', 'economy', 'market', 'trading', 'investment', 'money', 'power', 'corporate'],
    description: 'Finance, economics, markets and power dynamics',
    bgColor: 'bg-green-50',
    textColor: 'text-green-900'
  },
  'Culture & Lifestyle': {
    icon: Palette,
    color: 'bg-orange-500',
    accent: 'border-orange-200 hover:border-orange-300',
    gradient: 'from-orange-500 to-orange-600',
    keywords: ['culture', 'lifestyle', 'entertainment', 'sports', 'music', 'art', 'fashion', 'celebrity', 'travel'],
    description: 'Entertainment, sports, arts and lifestyle trends',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-900'
  },
  'Planet & Society': {
    icon: Leaf,
    color: 'bg-emerald-500',
    accent: 'border-emerald-200 hover:border-emerald-300',
    gradient: 'from-emerald-500 to-emerald-600',
    keywords: ['climate', 'environment', 'health', 'science', 'society', 'sustainability', 'medical', 'research'],
    description: 'Climate, environment, health and social change',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-900'
  }
};

export default function NewsPage() {
  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('World News');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchNews();
    // Auto-refresh every 20 minutes (no manual control)
    const id = setInterval(() => {
      fetchNews();
    }, 20 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/news?limit=100');
      const result = await response.json();
      
      if (result.success) {
        setNewsData(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch news');
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err instanceof Error ? err.message : 'Failed to load news');
      
      // Fallback data structure
      setNewsData({
        articles: [],
        total: 0,
        metadata: {
          total_articles: 0,
          with_images: 0,
          with_videos: 0,
          with_youtube: 0,
          last_updated: new Date().toISOString()
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Gentle auto-retry when there is an error (no user button)
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => {
      fetchNews();
    }, 30 * 1000);
    return () => clearTimeout(t);
  }, [error]);

  const categorizeArticles = (articles: NewsArticle[]) => {
    const categorized: Record<string, NewsArticle[]> = {};
    
    // Initialize categories
    Object.keys(categoryConfig).forEach(category => {
      categorized[category] = [];
    });

    // Categorize articles based on content and keywords
    articles.forEach(article => {
      let assigned = false;
      
      // Check each category for keyword matches
      Object.entries(categoryConfig).forEach(([categoryName, config]) => {
        if (!assigned) {
          const content = `${article.title} ${article.snippet || article.summary || ''} ${article.category}`.toLowerCase();
          const hasKeyword = config.keywords.some(keyword => content.includes(keyword));
          
          if (hasKeyword) {
            categorized[categoryName].push(article);
            assigned = true;
          }
        }
      });
      
      // Fallback to World News if no category match
      if (!assigned) {
        categorized['World News'].push(article);
      }
    });

    return categorized;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const publishedDate = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return publishedDate.toLocaleDateString();
  };

  // Derived data (must be computed before any early return to keep hooks order stable)
  const articles = newsData?.articles || [];
  const categorizedArticles = useMemo(() => categorizeArticles(articles), [articles]);
  const selectedArticles = categorizedArticles[selectedCategory] || [];
  const SelectedIcon = categoryConfig[selectedCategory]?.icon || Globe;
  
  // Hero prefers current category; fallback to global best
  const categoryHero = selectedArticles
    .filter(a => a.image_url)
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))[0];
  const generalHero = articles
    .filter(article => article.image_url)
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))[0];
  const heroArticle = categoryHero || generalHero;
  const StoryRow = ({ article }: { article: NewsArticle }) => (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block py-6 border-b border-gray-900 hover:bg-gray-900/30 transition-colors"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-center">
        <div className="md:col-span-8">
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white group-hover:text-blue-300 transition-colors line-clamp-2">
            {article.title}
          </h3>
          <p className="mt-2 text-gray-400 line-clamp-2 md:line-clamp-3">
            {article.snippet || article.summary}
          </p>
          <div className="mt-3 flex items-center text-sm text-gray-500 gap-3">
            <span className="truncate max-w-[40ch]">{article.source}</span>
            <span>•</span>
            <span>{formatTimeAgo(article.published_at || article.publish_date || new Date().toISOString())}</span>
            {article.image_url && (
              <span className="flex items-center gap-1 text-gray-500"><ImageIcon className="w-4 h-4" /> Image</span>
            )}
            {article.video_url && (
              <span className="flex items-center gap-1 text-gray-500"><Play className="w-4 h-4" /> Video</span>
            )}
          </div>
        </div>
        <div className="md:col-span-4">
          {article.image_url && (
            <div className="relative overflow-hidden rounded-md aspect-video bg-gray-900/50">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
            </div>
          )}
        </div>
      </div>
    </a>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              <div className="w-4 h-4 bg-purple-500 rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-4 h-4 bg-pink-500 rounded-full animate-pulse animation-delay-400"></div>
              <span className="ml-3 text-gray-400 text-lg">Loading latest stories...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="text-red-400 text-xl">⚠️ Unable to load news</div>
            <div className="text-gray-400 text-center max-w-md">
              {error}
            </div>
            <div className="text-xs text-gray-500">Auto retrying in 30s…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header with category dropdown and live auto-update info */}
      <div className="border-b border-gray-900/80 bg-gray-950/70 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 tracking-tight font-serif">
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">101World News</span>
              </h1>
              <div className="flex items-center gap-3 text-gray-500 text-sm">
                <span className="relative inline-flex items-center">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden />
                  Live • auto-updates every 20 min
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">{newsData?.metadata?.total_articles || 0} stories in last 30 min</span>
                {lastUpdated ? (
                  <span className="ml-0 sm:ml-2">Updated {formatTimeAgo(lastUpdated.toISOString())}</span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center justify-center rounded-md border border-gray-800 bg-gray-900/70 p-2">
                <SelectedIcon className="w-4 h-4 text-gray-300" />
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-gray-900/70 border border-gray-800 text-white rounded-md px-3 py-2 text-sm"
              >
                {Object.keys(categoryConfig).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section (simple, no blocks) */}
        {heroArticle && (
          <section className="mb-12">
            <a href={heroArticle.url} target="_blank" rel="noopener noreferrer" className="group block">
              <div className="relative overflow-hidden rounded-lg aspect-video bg-gray-900/60">
                <img
                  src={heroArticle.image_url!}
                  alt={heroArticle.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 font-serif">{heroArticle.title}</h2>
                  <p className="text-gray-300 line-clamp-2">{heroArticle.snippet || heroArticle.summary}</p>
                </div>
              </div>
            </a>
          </section>
        )}

        {/* Stream list for selected category */}
        <section className="mt-6">
          {(selectedArticles || []).slice(0, 50).map((a) => (
            <StoryRow key={a.id} article={a} />
          ))}
          {selectedArticles.length === 0 && (
            <div className="text-center text-gray-500 py-12">No stories in this category in the last 30 minutes.</div>
          )}
        </section>
      </div>
    </div>
  );
}
