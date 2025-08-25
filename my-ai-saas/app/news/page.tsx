'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, ExternalLink, Clock, Filter, Globe, Rocket, Heart, DollarSign, Palette, Leaf, Loader2, Play, Send } from 'lucide-react';

interface NewsArticle {
  id: string;
  title: string;
  content?: string;
  snippet?: string;
  summary?: string;
  published_at: string;
  source_name?: string;
  source?: string;
  source_url?: string;
  url?: string;
  category: string;
  quality_score: number;
  image_url?: string;
}

// Compact news card for docked/mobile layout
const CompactNewsCard = ({ article }: { article: NewsArticle }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openSource = () => {
    const url = article.source_url || article.url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const getImageUrl = () => {
    if (article.image_url) {
      return article.image_url;
    }
    const fallbackColors = ['ff6b6b', '4ecdc4', '45b7d1', 'f39c12', '9b59b6', 'e74c3c'];
    const colorIndex = article.title.length % fallbackColors.length;
    const color = fallbackColors[colorIndex];
    const encodedTitle = encodeURIComponent(article.title.slice(0, 30));
    return `https://via.placeholder.com/120x80/${color}/ffffff?text=${encodedTitle}`;
  };

  const sourceName = article.source_name || article.source || 'News';

  return (
    <div 
      onClick={openSource}
      className="flex gap-3 p-3 border border-gray-800 rounded-lg hover:border-orange-500 transition-all cursor-pointer bg-gradient-to-br from-black to-gray-950 hover:from-gray-950 hover:to-black"
    >
      <div className="flex-shrink-0">
        <img 
          src={getImageUrl()} 
          alt={article.title}
          className="w-20 h-14 object-cover rounded-md"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://picsum.photos/120/80?random=${article.id || Math.random()}`;
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white text-sm leading-tight mb-1 line-clamp-2">
          {article.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{sourceName}</span>
            {article.category && (
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-900/30 text-orange-300 border border-orange-800/40 text-[10px]">
                {article.category}
              </span>
            )}
          </div>
          <span className="flex-shrink-0 ml-2">{formatDate(article.published_at)}</span>
        </div>
      </div>
    </div>
  );
};

// Full width news card for desktop layout
const FullWidthNewsCard = ({ article, layout = "default" }: { article: NewsArticle; layout?: "default" | "large" | "compact" }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTrend = () => {
    console.log('Trending:', article.title);
  };

  const openSource = () => {
    const url = article.source_url || article.url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const getImageUrl = () => {
    if (article.image_url) {
      return article.image_url;
    }
    const fallbackColors = ['ff6b6b', '4ecdc4', '45b7d1', 'f39c12', '9b59b6', 'e74c3c'];
    const colorIndex = article.title.length % fallbackColors.length;
    const color = fallbackColors[colorIndex];
    const encodedTitle = encodeURIComponent(article.title.slice(0, 50));
    return `https://via.placeholder.com/400x225/${color}/ffffff?text=${encodedTitle}`;
  };

  const sourceName = article.source_name || article.source || 'Unknown Source';

  if (layout === "large") {
    return (
      <div className="group bg-black border border-gray-800 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-orange-500 min-w-[400px] flex-shrink-0">
        <div className="aspect-[16/9] h-48 overflow-hidden">
          <img 
            src={getImageUrl()} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://picsum.photos/400/225?random=${article.id || Math.random()}`;
            }}
          />
        </div>
        
        <div className="p-4">
          <h2 className="font-bold text-white text-lg leading-tight mb-3 group-hover:text-orange-400 transition-colors line-clamp-2">
            {article.title}
          </h2>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="font-semibold text-gray-200">{sourceName}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(article.published_at)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleTrend}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-xs font-semibold hover:bg-orange-200 transition-colors"
              >
                <TrendingUp className="w-3 h-3" />
                Trend
              </button>
              <button 
                onClick={openSource}
                className="p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-black border border-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-orange-500 min-w-[320px] flex-shrink-0">
      <div className="aspect-video h-40 overflow-hidden">
        <img 
          src={getImageUrl()} 
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://picsum.photos/320/180?random=${article.id || Math.random()}`;
          }}
        />
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-white text-base leading-tight mb-3 group-hover:text-orange-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-semibold text-gray-200 truncate">{sourceName}</span>
            <span className="text-gray-500">•</span>
            <span className="truncate">{formatDate(article.published_at)}</span>
          </div>
          
          <button 
            onClick={handleTrend}
            className="flex items-center gap-1 px-2 py-1 bg-orange-900/50 text-orange-400 rounded-full text-xs font-semibold hover:bg-orange-800/50 transition-colors"
          >
            <TrendingUp className="w-3 h-3" />
            <span className="hidden sm:inline">Trend</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Horizontal scrolling section for full width layout
const HorizontalNewsSection = ({ title, articles, layout }: { title: string; articles: NewsArticle[]; layout: 'hero' | 'normal' }) => {
  if (layout === 'hero') {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
        </div>
        
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6">
            {articles.slice(0, 3).map(article => (
              <FullWidthNewsCard key={article.id} article={article} layout="large" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors">
          <Filter className="w-4 h-4" />
          View All
        </button>
      </div>
      
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4">
          {articles.slice(0, 6).map(article => (
            <FullWidthNewsCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
};

// Vertical scrolling section for docked layout
const VerticalNewsSection = ({ title, articles }: { title: string; articles: NewsArticle[] }) => {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <button className="text-sm text-gray-400 hover:text-orange-400 transition-colors">
          View All
        </button>
      </div>
      
      <div className="space-y-3">
        {articles.slice(0, 8).map(article => (
          <CompactNewsCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
};

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Force vertical/docked layout for consistency and simplicity
  const [isSimpleMode] = useState(true);

  // No layout detection; we keep vertical layout only

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    try {
      // Primary source: our news API (DB with RSS fallback)
      const response = await fetch('/api/news?limit=50', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data?.data?.articles) ? data.data.articles : [];
        if (list.length > 0) {
          const sorted = list.sort((a: NewsArticle, b: NewsArticle) =>
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          );
          setArticles(sorted);
          return;
        }
      }
      // Fallback: daily brief endpoint (always returns something, even mock)
      await loadDailyBriefFallback();
    } catch (error) {
      console.error('Error fetching news:', error);
      await loadDailyBriefFallback();
    } finally {
      setLoading(false);
    }
  };

  const loadDailyBriefFallback = async () => {
    try {
      const res = await fetch('/api/news/daily-brief', { cache: 'no-store' });
      if (!res.ok) throw new Error('daily-brief failed');
      const brief = await res.json();
      const mapped: NewsArticle[] = (brief?.articles || []).map((a: any, i: number) => ({
        id: a.id || a.url || `brief-${i}`,
        title: a.title || 'Untitled',
        content: a.snippet || a.summary || '',
        snippet: a.snippet || a.summary || '',
        summary: a.snippet || a.summary || '',
        published_at: a.publishDate || new Date().toISOString(),
        source_name: a.source || 'Daily Brief',
        source: a.source || 'Daily Brief',
        source_url: a.url,
        url: a.url,
        category: a.category || 'General',
        quality_score: 0,
        image_url: a.imageUrl || undefined,
      }));
      setArticles(mapped);
    } catch (e) {
      // Final safety net: minimal local placeholders
      const now = new Date().toISOString();
      setArticles([
        { id: 'local-1', title: 'Stay tuned: Live news feed warming up', published_at: now, category: 'System', quality_score: 0 },
        { id: 'local-2', title: 'Tip: Check back in a moment for fresh headlines', published_at: now, category: 'System', quality_score: 0 },
      ] as NewsArticle[]);
    }
  };

  const searchResults = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (article.content && article.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (article.snippet && article.snippet.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <span className="ml-3 text-gray-300 font-medium">Loading latest news...</span>
          </div>
        </div>
      </div>
    );
  }

  // Always render Docked/Mobile Layout - Vertical Scrolling

  // Docked/Mobile Layout - Vertical Scrolling
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-md mx-auto px-4 py-6">
        
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-10 pr-4 py-3 text-sm bg-black border border-gray-800 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 text-white placeholder-gray-400"
            />
          </div>
          
          {/* Search Dropdown */}
          {isSearchOpen && searchQuery && (
            <div className="relative mt-2">
              <div className="absolute w-full bg-black border border-gray-800 rounded-lg shadow-lg z-40 max-h-64 overflow-y-auto">
                {searchResults.slice(0, 3).map(article => (
                  <div key={article.id} className="p-3 hover:bg-gray-900 cursor-pointer border-b border-gray-800 last:border-b-0">
                    <h4 className="font-medium text-white text-sm mb-1 line-clamp-2">{article.title}</h4>
                    <p className="text-xs text-gray-400">{article.source_name || article.source}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Vertical Scrolling News Sections */}
        <div onClick={() => setIsSearchOpen(false)} className="space-y-6">
          
          {/* Breaking News - Vertical */}
          <VerticalNewsSection 
            title="Breaking News" 
            articles={articles.slice(0, 3)} 
          />
          
          {/* World News - Vertical */}
          <VerticalNewsSection 
            title="World News" 
            articles={articles.slice(3, 8)} 
          />
          
          {/* Technology - Vertical */}
          <VerticalNewsSection 
            title="Technology" 
            articles={articles.filter(a => 
              a.title.toLowerCase().includes('tech') ||
              a.title.toLowerCase().includes('ai') ||
              a.category.toLowerCase().includes('tech')
            )} 
          />
          
          {/* Business - Vertical */}
          <VerticalNewsSection 
            title="Business" 
            articles={articles.filter(a => 
              a.title.toLowerCase().includes('business') ||
              a.title.toLowerCase().includes('market') ||
              a.category.toLowerCase().includes('business')
            )} 
          />
          
          {/* Latest Updates - Vertical */}
          <VerticalNewsSection 
            title="Latest Updates" 
            articles={articles.slice(8)} 
          />
          
        </div>
      </div>
    </div>
  );
}
