"use client";

import { useState, useEffect, useMemo } from 'react';
import { Send, Search, Globe, Rocket, Heart, DollarSign, Palette, Leaf, Play, Image as ImageIcon, Loader2, MapPin, Cloud, Sun } from 'lucide-react';

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

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

interface StarProps {
  x: number;
  y: number;
  z: number;
  opacity: number;
  size: number;
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

// Starfield background component
const Starfield = () => {
  const [stars, setStars] = useState<StarProps[]>([]);

  useEffect(() => {
    const generateStars = () => {
      const newStars: StarProps[] = [];
      for (let i = 0; i < 200; i++) {
        newStars.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          z: Math.random(),
          opacity: Math.random() * 0.8 + 0.2,
          size: Math.random() * 2 + 0.5,
        });
      }
      setStars(newStars);
    };

    generateStars();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-pulse"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            transform: `translateZ(${star.z * 100}px)`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
};

// Weather Widget Component
const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        // Get user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Mock weather data for now - you can replace with actual API
            const mockWeather: WeatherData = {
              location: 'Your Location',
              temperature: Math.round(Math.random() * 30 + 5),
              condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
              humidity: Math.round(Math.random() * 50 + 30),
              windSpeed: Math.round(Math.random() * 20 + 5),
              icon: '☀️'
            };
            
            setWeather(mockWeather);
            setLocation('Current Location');
            setLoading(false);
          });
        }
      } catch (error) {
        console.error('Weather fetch error:', error);
        setLoading(false);
      }
    };

    fetchWeatherData();
  }, []);

  if (loading) {
    return (
      <div className="fixed top-4 left-4 bg-gray-900/80 backdrop-blur-md rounded-xl p-4 border border-gray-700 z-40">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span className="text-gray-300 text-sm">Loading weather...</span>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="fixed top-4 left-4 bg-gray-900/90 backdrop-blur-md rounded-xl p-4 border border-gray-700 z-40 min-w-[200px]">
      <div className="flex items-center space-x-2 mb-2">
        <MapPin className="w-4 h-4 text-blue-400" />
        <span className="text-gray-300 text-sm font-medium">{location}</span>
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{weather.icon}</span>
          <span className="text-2xl font-bold text-white">{weather.temperature}°C</span>
        </div>
        <div className="text-right">
          <div className="text-gray-300 text-sm">{weather.condition}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center space-x-1">
          <Cloud className="w-3 h-3 text-blue-400" />
          <span className="text-gray-400">{weather.humidity}% humidity</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-gray-400">💨 {weather.windSpeed} km/h</span>
        </div>
      </div>
    </div>
  );
};

// Smart Grid Layout Component
const SmartGrid = ({ articles, startIndex = 0 }: { articles: NewsArticle[], startIndex?: number }) => {
  const getGridLayout = (index: number) => {
    const patterns = [
      { cols: 'md:col-span-2 lg:col-span-2', rows: 'md:row-span-1', size: 'large' },
      { cols: 'md:col-span-1', rows: 'md:row-span-1', size: 'medium' },
      { cols: 'md:col-span-1', rows: 'md:row-span-1', size: 'medium' },
      { cols: 'md:col-span-1', rows: 'md:row-span-2', size: 'tall' },
      { cols: 'md:col-span-2', rows: 'md:row-span-1', size: 'wide' },
      { cols: 'md:col-span-1', rows: 'md:row-span-1', size: 'medium' },
    ];
    return patterns[index % patterns.length];
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 auto-rows-auto">
      {articles.slice(startIndex).map((article, index) => {
        const layout = getGridLayout(index);
        return (
          <div key={article.id} className={`${layout.cols} ${layout.rows}`}>
            <SmartStoryCard article={article} size={layout.size} />
          </div>
        );
      })}
    </div>
  );
};

// Enhanced Story Card with Size Variations
const SmartStoryCard = ({ article, size }: { article: NewsArticle, size: string }) => {
  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'large':
        return {
          container: 'h-64 md:h-48',
          title: 'text-lg font-bold line-clamp-3',
          description: 'text-sm line-clamp-3',
          image: 'h-32'
        };
      case 'tall':
        return {
          container: 'h-80',
          title: 'text-base font-bold line-clamp-4',
          description: 'text-sm line-clamp-4',
          image: 'h-40'
        };
      case 'wide':
        return {
          container: 'h-48',
          title: 'text-lg font-bold line-clamp-2',
          description: 'text-sm line-clamp-2',
          image: 'h-24'
        };
      default: // medium
        return {
          container: 'h-56',
          title: 'text-base font-semibold line-clamp-3',
          description: 'text-sm line-clamp-2',
          image: 'h-28'
        };
    }
  };

  const classes = getSizeClasses(size);
  const categoryInfo = Object.values(categoryConfig).find(cat => 
    cat.keywords.some(keyword => 
      article.title.toLowerCase().includes(keyword) || 
      (article.snippet && article.snippet.toLowerCase().includes(keyword))
    )
  ) || categoryConfig['World News'];

  return (
    <article className={`bg-gray-800/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-lg border border-gray-700/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 hover:border-gray-600 ${classes.container} group`}>
      {article.image_url && (
        <div className={`relative ${classes.image} overflow-hidden`}>
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
        </div>
      )}
      
      <div className="p-3 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color} text-white`}>
              {article.source}
            </span>
            {article.video_url && (
              <span className="flex items-center space-x-1 bg-red-900/30 text-red-400 px-2 py-1 rounded-full text-xs">
                <Play className="w-3 h-3" />
              </span>
            )}
          </div>
          
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group-hover:text-blue-300 transition-colors"
          >
            <h3 className={`text-white mb-2 group-hover:text-blue-300 transition-colors ${classes.title}`}>
              {article.title}
            </h3>
            
            {(article.snippet || article.summary) && (
              <p className={`text-gray-400 leading-relaxed ${classes.description}`}>
                {article.snippet || article.summary}
              </p>
            )}
          </a>
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
          <span>{new Date(article.published_at || article.publish_date || '').toLocaleDateString()}</span>
          {article.quality_score && (
            <span className="flex items-center space-x-1">
              <Heart className="w-3 h-3" />
              <span>{article.quality_score}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default function NewsPage() {
  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Your Feed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NewsArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setSelectedCategory('Search Results');
    
    try {
      const response = await fetch('/api/news/search-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSearchResults(result.data.articles || []);
      } else {
        setSearchError(result.error || 'Search failed');
      }
    } catch (err) {
      setSearchError('Failed to search news');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // Auto-refresh every 10 minutes
    const id = setInterval(() => {
      if (selectedCategory === 'Your Feed') {
        fetchNews();
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [selectedCategory]);

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
  
  let selectedArticles: NewsArticle[] = [];
  if (selectedCategory === 'Your Feed') {
    selectedArticles = articles;
  } else if (selectedCategory === 'Search Results') {
    selectedArticles = searchResults;
  } else {
    selectedArticles = categorizedArticles[selectedCategory] || [];
  }
  
  // Hero prefers current category; fallback to global best
  const categoryHero = selectedCategory === 'Your Feed'
    ? articles.filter(a => a.image_url).sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))[0]
    : selectedArticles.filter(a => a.image_url).sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))[0];
  const generalHero = articles
    .filter(article => article.image_url)
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))[0];
  const heroArticle = categoryHero || generalHero;
  const StoryCard = ({ article }: { article: NewsArticle }) => (
    <article className="group relative bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:border-gray-600">
      <div className="relative">
        {article.image_url && (
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={article.image_url}
              alt={article.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
        
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center text-xs text-gray-400 space-x-2">
              <span className="font-medium text-blue-400 truncate max-w-[120px]">{article.source}</span>
              <span>•</span>
              <time>{formatTimeAgo(article.published_at || article.publish_date || new Date().toISOString())}</time>
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(article.url);
                }}
                className="p-1.5 rounded-full hover:bg-gray-700 transition-colors"
                title="Copy link"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </button>
            </div>
          </div>
          
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <h3 className="font-semibold text-white leading-tight mb-2 group-hover:text-blue-300 transition-colors line-clamp-3">
              {article.title}
            </h3>
            
            <p className="text-sm text-gray-300 leading-relaxed line-clamp-3 mb-3">
              {article.snippet || article.summary}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                {article.video_url && (
                  <span className="flex items-center space-x-1 bg-red-900/30 text-red-400 px-2 py-1 rounded-full">
                    <Play className="w-3 h-3" />
                    <span>Video</span>
                  </span>
                )}
                {article.youtube_url && (
                  <span className="flex items-center space-x-1 bg-red-900/30 text-red-400 px-2 py-1 rounded-full">
                    <Play className="w-3 h-3" />
                    <span>YouTube</span>
                  </span>
                )}
              </div>
              
              <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Read more →
              </span>
            </div>
          </a>
        </div>
      </div>
    </article>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Starfield />
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900/50 via-black/70 to-purple-900/30 pointer-events-none z-10"></div>
        <div className="container mx-auto px-4 py-12 relative z-20">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse animation-delay-400"></div>
              <span className="ml-3 text-gray-300 text-lg">Loading latest stories...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Starfield />
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900/50 via-black/70 to-purple-900/30 pointer-events-none z-10"></div>
        <div className="container mx-auto px-4 py-12 relative z-20">
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="text-red-400 text-xl">⚠️ Unable to load news</div>
            <div className="text-gray-300 text-center max-w-md">{error}</div>
            <div className="text-xs text-gray-500">Auto retrying in 30s…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative pb-24 overflow-hidden">
      {/* 3D Starfield Background */}
      <Starfield />
      
      {/* Dark gradient overlay for depth */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900/50 via-black/70 to-purple-900/30 pointer-events-none z-10"></div>
      
      {/* Weather Widget */}
      <WeatherWidget />
      
      <main className="container mx-auto px-4 py-8 relative z-20">
        {/* Search Results Header */}
        {selectedCategory === 'Search Results' && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              Search Results for "{searchQuery}"
            </h2>
            <p className="text-gray-400">
              {isSearching ? 'Searching...' : `Found ${selectedArticles.length} articles`}
            </p>
          </div>
        )}

        {/* Loading state for search */}
        {isSearching && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-gray-300 text-lg">Searching news worldwide...</span>
            </div>
          </div>
        )}

        {/* Search Error */}
        {searchError && selectedCategory === 'Search Results' && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-8">
            <div className="text-red-400">Search failed: {searchError}</div>
          </div>
        )}

        {/* News Grid with Smart Layout */}
        <section className="mb-12">
          <SmartGrid articles={selectedArticles || []} />
        </section>
        
        {selectedArticles.length === 0 && !isSearching && (
          <div className="text-center text-gray-400 py-16">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-medium text-white mb-2">No stories found</h3>
              <p className="text-gray-400">
                {selectedCategory === 'Search Results' 
                  ? 'Try a different search term' 
                  : 'Try selecting a different category or check back in a few minutes for new stories.'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Floating Search Prompt */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-600 rounded-2xl shadow-2xl shadow-purple-500/20 p-4 min-w-[400px] max-w-[600px]">
          <div className="flex items-center space-x-3">
            <div className="relative flex-1">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-transparent text-gray-300 text-sm border-none outline-none cursor-pointer z-10"
              >
                <option value="Your Feed">Your Feed</option>
                <option value="Search Results">Search</option>
                {Object.keys(categoryConfig).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={selectedCategory === 'Search Results' ? "Search news worldwide..." : "Switch to Search to find specific news"}
                disabled={selectedCategory !== 'Search Results'}
                className="w-full bg-gray-800/80 border border-gray-500 rounded-xl px-12 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 disabled:opacity-50 backdrop-blur-sm"
              />
              
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching || selectedCategory !== 'Search Results'}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl p-3 transition-colors"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          
          <div className="flex items-center justify-center mt-2 text-xs text-gray-400">
            Live updates every 10 minutes • Powered by <span className="text-purple-400 font-semibold">101World</span>
          </div>
        </div>
      </div>
    </div>
  );
}
