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
  publishDate: string;
  imageUrl?: string;
}

interface DailyBrief {
  date: string;
  articles: NewsArticle[];
  categories: string[];
}

export default function NewsPage() {
  const { user } = useUser();
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [searchResults, setSearchResults] = useState<NewsArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
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
      setDailyBrief(data);
    } catch (err: any) {
      console.error('Failed to load daily brief:', err);
      setError('Failed to load daily briefing. Please try again later.');
      // Set mock data for development
      setDailyBrief({
        date: new Date().toISOString().split('T')[0],
        articles: [
          {
            id: '1',
            title: 'AI Revolution in 2025: New Breakthrough in Machine Learning',
            snippet: 'Scientists have developed a new AI model that can understand context better than ever before. This breakthrough could revolutionize how we interact with artificial intelligence...',
            url: 'https://example.com/ai-breakthrough',
            source: 'TechNews',
            category: 'Technology',
            publishDate: new Date().toISOString(),
            imageUrl: 'https://via.placeholder.com/300x200?text=AI+News'
          },
          {
            id: '2',
            title: 'Global Climate Summit Reaches Historic Agreement',
            snippet: 'World leaders have signed a comprehensive climate agreement that sets ambitious targets for carbon reduction over the next decade...',
            url: 'https://example.com/climate-summit',
            source: 'WorldNews',
            category: 'Environment',
            publishDate: new Date().toISOString()
          },
          {
            id: '3',
            title: 'Stock Markets Hit Record Highs Amid Economic Optimism',
            snippet: 'Major stock indices reached new peaks today as investors showed confidence in the global economic recovery...',
            url: 'https://example.com/stock-markets',
            source: 'FinanceDaily',
            category: 'Business',
            publishDate: new Date().toISOString()
          }
        ],
        categories: ['Technology', 'Environment', 'Business', 'Politics', 'Sports', 'Health']
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/news/search?query=${encodeURIComponent(searchQuery)}&category=${selectedCategory}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setSearchResults(data.articles || []);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
      // Mock search results for development
      setSearchResults([
        {
          id: 'search-1',
          title: `Search Results for "${searchQuery}"`,
          snippet: 'This is a mock search result. The actual news search API is not yet implemented but will return real results once the backend is set up.',
          url: 'https://example.com/search-result',
          source: 'SearchEngine',
          category: selectedCategory === 'all' ? 'General' : selectedCategory,
          publishDate: new Date().toISOString()
        }
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredArticles = dailyBrief?.articles.filter(article => 
    selectedCategory === 'all' || article.category.toLowerCase() === selectedCategory.toLowerCase()
  ) || [];

  const displayArticles = searchResults.length > 0 ? searchResults : filteredArticles;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 14h-8"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18h-5"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h8v4h-8z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Latest News</h1>
              <p className="text-slate-600 dark:text-slate-400">Stay updated with the latest news and trends</p>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search news articles..."
                className="w-full px-4 py-3 pl-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {dailyBrief?.categories.map(category => (
                <option key={category} value={category.toLowerCase()}>{category}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </>
              )}
            </button>
          </form>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              All
            </button>
            {dailyBrief?.categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category.toLowerCase())}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category.toLowerCase()
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Daily Brief Header */}
        {searchResults.length === 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Daily Brief
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {dailyBrief?.date ? `Latest news for ${new Date(dailyBrief.date).toLocaleDateString()}` : 'Loading latest news...'}
            </p>
          </div>
        )}

        {/* Search Results Header */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Search Results
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Found {searchResults.length} articles for "{searchQuery}"
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading news...</p>
            </div>
          </div>
        )}

        {/* Articles Grid */}
        {!isLoading && displayArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayArticles.map((article) => (
              <article
                key={article.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group"
              >
                {article.imageUrl && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                      {article.category}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {article.source}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 mb-4">
                    {article.snippet}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(article.publishDate).toLocaleDateString()}
                    </span>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                    >
                      Read more
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* No Results */}
        {!isLoading && displayArticles.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No articles found</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {searchResults.length === 0 ? 'No articles available for the selected category.' : 'Try adjusting your search query or category filter.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
