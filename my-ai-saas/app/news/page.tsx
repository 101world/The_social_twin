'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, Globe, Rocket, Heart, DollarSign, Palette, Leaf, Clock, Eye, Share2, Bookmark, ChevronRight, Play, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

// Simple inline components to avoid import issues
const Badge = ({ children, className = "", ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`} {...props}>
    {children}
  </span>
);

const Card = ({ children, className = "", ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={`rounded-lg border shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

const CardContent = ({ children, className = "", ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={`p-6 pt-0 ${className}`} {...props}>
    {children}
  </div>
);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/news?limit=100');
      const result = await response.json();
      
      if (result.success) {
        setNewsData(result.data);
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
            <Button onClick={fetchNews} variant="outline" className="border-gray-700 hover:border-gray-600">
              Reload News
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const articles = newsData?.articles || [];
  const categorizedArticles = categorizeArticles(articles);
  
  // Get hero article (highest quality with image from any category)
  const heroArticle = articles
    .filter(article => article.image_url)
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))[0];

  const NewsCard = ({ article, isHero = false, categoryColor }: { 
    article: NewsArticle; 
    isHero?: boolean; 
    categoryColor?: string;
  }) => (
    <Card className={`group cursor-pointer transition-all duration-500 bg-gray-900/80 backdrop-blur-sm border-gray-800 hover:border-gray-600 hover:shadow-2xl hover:shadow-gray-800/30 hover:-translate-y-1 ${isHero ? 'col-span-full' : ''}`}>
      <CardContent className="p-0 overflow-hidden">
        {article.image_url && (
          <div className={`relative overflow-hidden ${isHero ? 'h-96 lg:h-[500px]' : 'h-56'}`}>
            <img
              src={article.image_url}
              alt={article.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${isHero ? 'from-gray-950 via-gray-950/50 to-transparent' : 'from-gray-900 via-transparent to-transparent'}`} />
            
            {/* Media indicators */}
            <div className="absolute top-4 right-4 flex space-x-2">
              {article.image_url && (
                <div className="p-2 bg-gray-900/80 backdrop-blur-sm rounded-lg">
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                </div>
              )}
              {article.video_url && (
                <div className="p-2 bg-gray-900/80 backdrop-blur-sm rounded-lg">
                  <Play className="w-4 h-4 text-green-400" />
                </div>
              )}
              {article.youtube_url && (
                <div className="p-2 bg-gray-900/80 backdrop-blur-sm rounded-lg">
                  <Play className="w-4 h-4 text-red-400" />
                </div>
              )}
            </div>
            
            <div className={`absolute ${isHero ? 'bottom-8 left-8 right-8' : 'bottom-4 left-4 right-4'}`}>
              <Badge className={`mb-3 ${categoryColor || 'bg-red-500/90'} hover:bg-opacity-100 border-0 backdrop-blur-sm`}>
                {article.source}
              </Badge>
              {isHero && (
                <h1 className="text-white text-3xl lg:text-5xl font-bold leading-tight mb-4 line-clamp-3">
                  {article.title}
                </h1>
              )}
            </div>
          </div>
        )}
        
        <div className={`p-6 ${isHero ? 'lg:p-8' : ''}`}>
          {!isHero && (
            <h3 className="text-white text-xl font-bold mb-4 line-clamp-2 group-hover:text-blue-400 transition-colors duration-300">
              {article.title}
            </h3>
          )}
          
          <p className={`text-gray-400 line-clamp-3 mb-6 ${isHero ? 'text-lg leading-relaxed' : 'text-base'}`}>
            {article.snippet || article.summary}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>{formatTimeAgo(article.published_at || article.publish_date || new Date().toISOString())}</span>
              </span>
              {article.quality_score && (
                <span className="flex items-center space-x-2">
                  <Eye className="w-4 h-4" />
                  <span>{article.quality_score}/10</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" className="h-8 px-3 text-gray-500 hover:text-white transition-colors">
                <Bookmark className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-gray-500 hover:text-white transition-colors">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const CategorySection = ({ categoryName, articles }: { categoryName: string; articles: NewsArticle[] }) => {
    const config = categoryConfig[categoryName];
    const Icon = config.icon;
    
    if (articles.length === 0) return null;

    return (
      <section className="mb-16">
        <div className="flex items-center space-x-4 mb-8">
          <div className={`p-3 rounded-xl bg-gradient-to-r ${config.gradient} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-1">{categoryName}</h2>
            <p className="text-gray-400">{config.description}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white transition-colors">
            View All <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.slice(0, 6).map((article) => (
            <NewsCard 
              key={article.id} 
              article={article} 
              categoryColor={config.color}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Animated Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  101World News
                </span>
              </h1>
              <p className="text-gray-400">
                Real-time global coverage • {newsData?.metadata?.total_articles || 0} stories • 
                <span className="text-green-400 ml-1">
                  Live
                </span>
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search breaking news..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 w-80 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500 backdrop-blur-sm"
                />
              </div>
              
              <Button variant="outline" size="sm" className="border-gray-700 hover:border-gray-600 backdrop-blur-sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        {heroArticle && (
          <section className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Breaking Story</h2>
              <p className="text-gray-400">The most important story right now</p>
            </div>
            <NewsCard article={heroArticle} isHero={true} />
          </section>
        )}

        {/* Category Sections in Psychology-Driven Order */}
        {Object.entries(categoryConfig).map(([categoryName]) => (
          <CategorySection
            key={categoryName}
            categoryName={categoryName}
            articles={categorizedArticles[categoryName] || []}
          />
        ))}

        {/* Statistics Footer */}
        <div className="mt-20 py-12 border-t border-gray-800 bg-gradient-to-r from-gray-900/50 to-gray-950/50 rounded-2xl backdrop-blur-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                {newsData?.metadata?.total_articles || 0}
              </div>
              <div className="text-gray-400">Total Stories</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
                {newsData?.metadata?.with_images || 0}
              </div>
              <div className="text-gray-400">With Images</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-500 bg-clip-text text-transparent">
                {newsData?.metadata?.with_videos || 0}
              </div>
              <div className="text-gray-400">With Videos</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">
                {newsData?.metadata?.with_youtube || 0}
              </div>
              <div className="text-gray-400">YouTube Content</div>
            </div>
          </div>
          
          <div className="text-center mt-8 text-gray-500">
            Last updated: {newsData?.metadata?.last_updated ? new Date(newsData.metadata.last_updated).toLocaleString() : 'Just now'}
          </div>
        </div>
      </div>
    </div>
  );
}
