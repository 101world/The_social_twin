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

// Modern news card with mobile-optimized smaller thumbnails and high quality images
const ModernNewsCard = ({ article, layout = "default" }: { article: NewsArticle; layout?: "default" | "large" | "compact" }) => {
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

  const sourceName = article.source_name || article.source || 'Unknown Source';

  if (layout === "large") {
    return (
      <div className="group bg-black border border-gray-800 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-orange-500">
        {article.image_url && (
          <div className="aspect-[16/9] md:aspect-[16/9] h-48 md:h-64 overflow-hidden">
            <img 
              src={article.image_url} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-100 contrast-110 saturate-110"
              loading="lazy"
              style={{ imageRendering: 'auto' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="p-4 md:p-6">
          <h2 className="font-bold text-white text-lg md:text-xl leading-tight mb-3 group-hover:text-orange-400 transition-colors">
            {article.title}
          </h2>
          
          <div className="flex items-center justify-between mb-4">
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
                className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-orange-100 text-orange-600 rounded-full text-xs font-semibold hover:bg-orange-200 transition-colors"
              >
                <TrendingUp className="w-3 h-3" />
                <span className="hidden md:inline">Trend</span>
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
    <div className="group bg-black border border-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-orange-500">
      <div className="flex gap-3 md:gap-4 p-3 md:p-4">
        {article.image_url && (
          <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden">
            <img 
              src={article.image_url} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter brightness-100 contrast-110 saturate-110"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm md:text-base leading-tight mb-2 line-clamp-2 group-hover:text-orange-400 transition-colors">
            {article.title}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-medium text-gray-300">{sourceName}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(article.published_at)}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handleTrend}
                className="p-1.5 text-orange-500 hover:bg-orange-500/10 rounded-full transition-colors"
                title="Trend this"
              >
                <TrendingUp className="w-3 h-3" />
              </button>
              <button 
                onClick={openSource}
                className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
                title="View source"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HeadlinesSection = ({ title, articles, layout = "default" }: { title: string; articles: NewsArticle[]; layout?: "default" | "hero" | "two-col" | "three-col" }) => {
  if (articles.length === 0) return null;

  const getGridClass = () => {
    switch (layout) {
      case "hero": return "grid-cols-1";
      case "two-col": return "grid-cols-1 md:grid-cols-2";
      case "three-col": return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      default: return "grid-cols-1";
    }
  };

  return (
    <div className="mb-8 md:mb-12">
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
        <div className="h-px bg-gray-800 flex-1"></div>
      </div>
      
      <div className={`grid ${getGridClass()} gap-4 md:gap-6`}>
        {articles.map(article => (
          <ModernNewsCard 
            key={article.id} 
            article={article} 
            layout={layout === "hero" ? "large" : "default"}
          />
        ))}
      </div>
    </div>
  );
};

export default function NewsComponent() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Load real news from API
  useEffect(() => {
    const loadNews = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/news');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setArticles(data.data.slice(0, 20)); // Limit to 20 articles
          } else {
            console.warn('No news data available');
            setArticles([]);
          }
        } else {
          console.error('Failed to fetch news');
          setArticles([]);
        }
      } catch (error) {
        console.error('Error loading news:', error);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return articles.filter(article => 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.source_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, articles]);

  if (loading) {
    return (
      <div className="h-full bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading latest news...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      {/* Main Content - No navbar as this is embedded */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        
        {/* Search Bar */}
        <div className="mb-8 md:mb-12">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              placeholder="Search breaking news... Powered by 101World"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-3 md:py-4 text-base md:text-lg bg-black border border-gray-800 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 text-white placeholder-gray-400"
            />
          </div>
          
          {/* Search Dropdown */}
          {isSearchOpen && searchQuery && (
            <div className="relative max-w-2xl mx-auto mt-2">
              <div className="absolute w-full bg-black border border-gray-800 rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Search Results ({searchResults.length})</h3>
                </div>
                {searchResults.slice(0, 5).map(article => (
                  <div key={article.id} className="p-4 hover:bg-gray-900 cursor-pointer border-b border-gray-800 last:border-b-0">
                    <h4 className="font-medium text-white text-sm mb-1 line-clamp-2">{article.title}</h4>
                    <p className="text-xs text-gray-400">{article.source_name || article.source} • {new Date(article.published_at).toLocaleDateString()}</p>
                  </div>
                ))}
                <div className="p-3 text-center border-t border-gray-800">
                  <span className="text-xs text-gray-500">Powered by 101World</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Headlines Sections */}
        <div onClick={() => setIsSearchOpen(false)}>
          
          {/* Breaking News - Hero Layout */}
          <HeadlinesSection 
            title="Breaking News" 
            articles={articles.filter(a => a.image_url).slice(0, 1)} 
            layout="hero" 
          />
          
          {/* Top Stories - Two Column */}
          <HeadlinesSection 
            title="Top Stories" 
            articles={articles.filter(a => a.image_url).slice(1, 3)} 
            layout="two-col" 
          />
          
          {/* World News - Three Column */}
          <HeadlinesSection 
            title="World News" 
            articles={articles.filter(a => a.image_url).slice(3, 6)} 
            layout="three-col" 
          />
          
          {/* Technology - Two Column */}
          <HeadlinesSection 
            title="Technology" 
            articles={articles.filter(a => 
              a.image_url && (
                a.title.toLowerCase().includes('tech') ||
                a.title.toLowerCase().includes('ai') ||
                a.category.toLowerCase().includes('tech')
              )
            ).slice(0, 2)} 
            layout="two-col" 
          />
          
          {/* Business - Three Column */}
          <HeadlinesSection 
            title="Business" 
            articles={articles.filter(a => 
              a.image_url && (
                a.title.toLowerCase().includes('business') ||
                a.title.toLowerCase().includes('market') ||
                a.category.toLowerCase().includes('business')
              )
            ).slice(0, 3)} 
            layout="three-col" 
          />
          
          {/* Latest Updates - Two Column */}
          <HeadlinesSection 
            title="Latest Updates" 
            articles={articles.filter(a => a.image_url).slice(6, 8)} 
            layout="two-col" 
          />
          
        </div>
        
      </div>
    </div>
  );
}
