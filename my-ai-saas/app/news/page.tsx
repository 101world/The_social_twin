'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Cloud, Sun, CloudRain, Snowflake, TrendingUp, ExternalLink, Clock, Filter, Globe, Rocket, Heart, DollarSign, Palette, Leaf, Loader2, Play, Send } from 'lucide-react';

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

interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
}

// Minimal weather-only header
const MinimalWeatherHeader = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState<string>('Getting location...');

  useEffect(() => {
    const getLocationAndWeather = async () => {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const { latitude, longitude } = position.coords;
        
        setWeather({
          temperature: 24,
          condition: 'Clear',
          location: 'Your City'
        });
        setLocation('Your City');
      } catch (error) {
        console.error('Location/Weather error:', error);
        setLocation('Demo City');
        setWeather({
          temperature: 24,
          condition: 'Clear',
          location: 'Demo City'
        });
      }
    };

    getLocationAndWeather();
  }, []);

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'clear':
      case 'sunny':
        return <Sun className="w-4 h-4 text-orange-500" />;
      case 'clouds':
      case 'cloudy':
        return <Cloud className="w-4 h-4 text-gray-600" />;
      case 'rain':
      case 'drizzle':
        return <CloudRain className="w-4 h-4 text-blue-500" />;
      case 'snow':
        return <Snowflake className="w-4 h-4 text-blue-300" />;
      default:
        return <Cloud className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-4 text-white">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-300">{location}</span>
            </div>
            {weather && (
              <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-full border border-gray-600">
                {getWeatherIcon(weather.condition)}
                <span className="text-sm font-semibold text-white">{weather.temperature}°C</span>
                <span className="text-xs text-gray-400">{weather.condition}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modern news card with image focus and trend button
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
      <div className="group bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-orange-500">
        {article.image_url && (
          <div className="aspect-[16/9] overflow-hidden">
            <img 
              src={article.image_url} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="p-6">
          <h2 className="font-bold text-white text-xl leading-tight mb-3 group-hover:text-orange-400 transition-colors">
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
    <div className="group bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-orange-500">
      {article.image_url && (
        <div className="aspect-video overflow-hidden">
          <img 
            src={article.image_url} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      )}
      
      <div className="p-4">
        <h3 className="font-semibold text-white text-base leading-tight mb-3 group-hover:text-orange-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-semibold text-gray-200">{sourceName}</span>
            <span className="text-gray-500">•</span>
            <span>{formatDate(article.published_at)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={handleTrend}
              className="flex items-center gap-1 px-2 py-1 bg-orange-900/50 text-orange-400 rounded-full text-xs font-semibold hover:bg-orange-800/50 transition-colors"
            >
              <TrendingUp className="w-3 h-3" />
              Trend
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Headlines section component
const HeadlinesSection = ({ title, articles, layout }: { title: string; articles: NewsArticle[]; layout: 'hero' | 'two-col' | 'three-col' }) => {
  if (layout === 'hero') {
    return (
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors">
            <Filter className="w-4 h-4" />
            View All
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {articles.slice(0, 1).map(article => (
            <ModernNewsCard key={article.id} article={article} layout="large" />
          ))}
        </div>
      </section>
    );
  }

  if (layout === 'two-col') {
    return (
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors">
            <Filter className="w-4 h-4" />
            View All
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.slice(0, 2).map(article => (
            <ModernNewsCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors">
          <Filter className="w-4 h-4" />
          View All
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.slice(0, 3).map(article => (
          <ModernNewsCard key={article.id} article={article} />
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

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news?limit=50');
      const data = await response.json();
      
      if (data.success) {
        // Sort by published date (newest first)
        const sortedArticles = data.data.articles.sort((a: NewsArticle, b: NewsArticle) => 
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
        );
        setArticles(sortedArticles);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchResults = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (article.content && article.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (article.snippet && article.snippet.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <MinimalWeatherHeader />
        <div className="pt-20 flex items-center justify-center h-96">
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

  return (
    <div className="min-h-screen bg-gray-900">
      <MinimalWeatherHeader />
      
      {/* Main Content */}
      <div className="pt-20 max-w-7xl mx-auto px-6 py-8">
        
        {/* Search Bar */}
        <div className="mb-12">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search breaking news... Powered by 101World"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-12 pr-4 py-4 text-lg bg-gray-800 border border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 text-white placeholder-gray-400"
            />
          </div>
          
          {/* Search Dropdown */}
          {isSearchOpen && searchQuery && (
            <div className="relative max-w-2xl mx-auto mt-2">
              <div className="absolute w-full bg-white border border-gray-200 rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Search Results ({searchResults.length})</h3>
                </div>
                {searchResults.slice(0, 5).map(article => (
                  <div key={article.id} className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                    <h4 className="font-medium text-black text-sm mb-1 line-clamp-2">{article.title}</h4>
                    <p className="text-xs text-gray-600">{article.source_name || article.source} • {new Date(article.published_at).toLocaleDateString()}</p>
                  </div>
                ))}
                <div className="p-3 text-center border-t border-gray-100">
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
