'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Grid, List, Star, Clock, TrendingUp } from 'lucide-react';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Mock data for explore items
  const exploreItems = [
    {
      id: 1,
      title: 'AI Social Media Creator',
      description: 'Create engaging social media content with AI assistance',
      category: 'Social Media',
      rating: 4.8,
      users: '10K+',
      trending: true,
      icon: '🤖',
      href: '/social-twin'
    },
    {
      id: 2,
      title: 'News Aggregation',
      description: 'Stay updated with global news from multiple sources',
      category: 'News',
      rating: 4.6,
      users: '5K+',
      trending: false,
      icon: '📰',
      href: '/news'
    },
    {
      id: 3,
      title: 'Recipe Generator',
      description: 'Generate creative recipes with AI-powered suggestions',
      category: 'Cooking',
      rating: 4.7,
      users: '8K+',
      trending: true,
      icon: '👨‍🍳',
      href: '/my-cookbook'
    },
    {
      id: 4,
      title: 'Code of ONE',
      description: 'Explore the philosophy and principles of ONE',
      category: 'Philosophy',
      rating: 4.9,
      users: '3K+',
      trending: false,
      icon: '🎯',
      href: '/one'
    },
    {
      id: 5,
      title: 'AI Music Studio',
      description: 'Create music with AI-powered composition tools',
      category: 'Music',
      rating: 4.5,
      users: '6K+',
      trending: true,
      icon: '🎵',
      href: '/studio'
    },
    {
      id: 6,
      title: 'Project Management',
      description: 'Manage your creative projects with AI assistance',
      category: 'Productivity',
      rating: 4.4,
      users: '4K+',
      trending: false,
      icon: '📋',
      href: '/dashboard'
    }
  ];

  const filteredItems = exploreItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trendingItems = exploreItems.filter(item => item.trending);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold">Explore</h1>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-gray-800' : 'hover:bg-gray-800'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-gray-800' : 'hover:bg-gray-800'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search features, tools, and more..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 outline-none text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Trending Section */}
        {trendingItems.length > 0 && !searchQuery && (
          <section className="mb-12">
            <div className="flex items-center space-x-2 mb-6">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h2 className="text-xl font-semibold">Trending Now</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-3xl">{item.icon}</div>
                    <div className="flex items-center space-x-1 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium">{item.rating}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-2 group-hover:text-gray-300">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="px-2 py-0.5 bg-gray-800 rounded-full">
                      {item.category}
                    </span>
                    <span>{item.users} users</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* All Items */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {searchQuery ? `Search Results for "${searchQuery}"` : 'All Features'}
            </h2>
            <span className="text-sm text-gray-400">
              {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
            </span>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-3xl">{item.icon}</div>
                    <div className="flex items-center space-x-1 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium">{item.rating}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-2 group-hover:text-gray-300">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="px-2 py-0.5 bg-gray-800 rounded-full">
                      {item.category}
                    </span>
                    <span>{item.users} users</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex items-center space-x-4 bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all duration-200"
                >
                  <div className="text-3xl flex-shrink-0">{item.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold group-hover:text-gray-300 truncate">
                        {item.title}
                      </h3>
                      <div className="flex items-center space-x-1 text-yellow-400 ml-4">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">{item.rating}</span>
                      </div>
                    </div>

                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                      {item.description}
                    </p>

                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="px-2 py-0.5 bg-gray-800 rounded-full">
                        {item.category}
                      </span>
                      <span>{item.users} users</span>
                      {item.trending && (
                        <span className="flex items-center space-x-1 text-green-400">
                          <TrendingUp className="w-3 h-3" />
                          <span>Trending</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">
                No results found
              </h3>
              <p className="text-gray-500">
                Try adjusting your search terms or browse our featured tools above.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
