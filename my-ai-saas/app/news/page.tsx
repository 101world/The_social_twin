"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface NewsArticle {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  category: string;
  publish_date: string;
  image_url?: string;
  video_url?: string;
  video_thumbnail?: string;
  video_platform?: string;
  content_full?: string;
  author?: string;
  tags?: string[];
}

interface DailyBrief {
  date: string;
  articles: NewsArticle[];
  categories: string[];
  total_articles: number;
  sources: string[];
  last_updated: string;
  multimedia_count?: {
    with_images: number;
    with_videos: number;
  };
}

export default function NewsPage() {
  const { user } = useUser();
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [searchResults, setSearchResults] = useState<NewsArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load daily briefing on mount
  useEffect(() => {
    loadDailyBrief();
  }, []);

  const loadDailyBrief = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/news/daily-brief');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      
      // Ensure data has the expected structure
      const briefData = {
        date: data.date || new Date().toISOString().split('T')[0],
        articles: Array.isArray(data.articles) ? data.articles : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        total_articles: data.total_articles || 0,
        sources: Array.isArray(data.sources) ? data.sources : [],
        last_updated: data.last_updated || new Date().toISOString(),
        multimedia_count: data.multimedia_count || { with_images: 0, with_videos: 0 }
      };
      
      setDailyBrief(briefData);
      setSearchResults(briefData.articles);
    } catch (err: any) {
      console.error('Failed to load daily brief:', err);
      setError('Failed to load news. Please try again later.');
      // Set fallback empty data
      setDailyBrief({
        date: new Date().toISOString().split('T')[0],
        articles: [],
        categories: [],
        total_articles: 0,
        sources: [],
        last_updated: new Date().toISOString(),
        multimedia_count: { with_images: 0, with_videos: 0 }
      });
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && selectedCategory === 'All') {
      setSearchResults(dailyBrief?.articles || []);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedCategory !== 'All') params.append('category', selectedCategory);

      const response = await fetch(`/api/news/search?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setSearchResults(Array.isArray(data.articles) ? data.articles : []);
    } catch (error) {
      console.error('Error searching articles:', error);
      setError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSearchResults(dailyBrief?.articles || []);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="space-y-4">
            <div className="h-12 w-64 bg-gray-800 rounded animate-pulse" />
            <div className="h-8 w-full max-w-md bg-gray-800 rounded animate-pulse" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg">
                  <div className="h-48 w-full bg-gray-700 rounded-t-lg animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-6 w-full bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 w-full bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            📰 Daily News Briefing
          </h1>
          <p className="text-gray-300 text-lg">
            Stay informed with the latest news from around the world
          </p>
          {dailyBrief && (
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                📅 {dailyBrief.date}
              </span>
              <span>{dailyBrief.total_articles || 0} articles</span>
              <span>{(dailyBrief.sources || []).length} sources</span>
              {dailyBrief.multimedia_count && (
                <>
                  <span className="flex items-center gap-1">
                    🖼️ {dailyBrief.multimedia_count.with_images || 0} with images
                  </span>
                  <span className="flex items-center gap-1">
                    🎬 {dailyBrief.multimedia_count.with_videos || 0} with videos
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Search and Filter */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search articles, topics, or authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-400 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button 
              onClick={handleSearch} 
              disabled={isSearching}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            <button 
              onClick={clearSearch} 
              className="px-6 py-3 border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {['All', ...(dailyBrief?.categories || [])].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category 
                    ? 'bg-blue-600 text-white' 
                    : 'border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Articles Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(searchResults || []).map((article) => (
            <div key={article.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:shadow-xl transition-shadow">
              {/* Image */}
              {article.image_url && (
                <div className="relative h-48 bg-gray-800">
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="p-6">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-900 text-blue-200 text-xs font-medium rounded border border-blue-800">
                    {article.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {article.source}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                  {article.title}
                </h3>
                
                <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                  {article.snippet}
                </p>

                {/* Tags */}
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(article.tags || []).slice(0, 3).map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded border border-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="flex flex-col gap-2 text-sm text-gray-400 mb-4">
                  {article.author && (
                    <div className="flex items-center gap-1">
                      👤 <span>{article.author}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    📅 <span>{formatDate(article.publish_date || new Date().toISOString())}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button 
                  onClick={() => window.open(article.url, '_blank')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Read Full Article →
                </button>
              </div>
            </div>
          ))}
        </div>

        {(searchResults || []).length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">
              No articles found matching your criteria.
            </p>
            <button onClick={clearSearch} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
              Show All Articles
            </button>
          </div>
        )}

        {/* Last Updated */}
        {dailyBrief?.last_updated && (
          <div className="text-center mt-12 text-sm text-gray-400">
            Last updated: {formatDate(dailyBrief.last_updated)}
          </div>
        )}
      </div>
    </div>
  );
}
