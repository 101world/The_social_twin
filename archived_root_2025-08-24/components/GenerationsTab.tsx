'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import CreditDisplay from './CreditDisplay';

interface Generation {
  id: string;
  user_id: string;
  type: 'text' | 'image' | 'video';
  prompt: string | null;
  result_url: string | null;
  content: string | null;
  posted: boolean;
  metadata: any;
  created_at: string;
  posted_at: string | null;
}

interface GenerationsTabProps {
  darkMode?: boolean;
  onAddToCanvas?: (url: string, type: 'image' | 'video') => void;
}

export default function GenerationsTab({ darkMode = false, onAddToCanvas }: GenerationsTabProps) {
  const { userId } = useAuth();
  const { user } = useUser();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'text' | 'image' | 'video'>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    byType: { text: 0, image: 0, video: 0 }
  });

  useEffect(() => {
    if (userId) {
      fetchGenerations();
      calculateStats();
    }
  }, [userId, filter]);

  const fetchGenerations = async (pageNum = 0, reset = true) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '20',
        page: pageNum.toString(),
      });

      const response = await fetch(`/api/generations?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch generations');
      }

      const data = await response.json();
      const items = data.items || [];

      // Apply client-side filtering if needed
      const filteredItems = filter === 'all' 
        ? items 
        : items.filter((gen: Generation) => gen.type === filter);

      if (reset) {
        setGenerations(filteredItems);
      } else {
        setGenerations(prev => [...prev, ...filteredItems]);
      }

      setHasMore(items.length === 20);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load generations');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async () => {
    try {
      const response = await fetch('/api/generations?limit=1000');
      if (response.ok) {
        const data = await response.json();
        const items = data.items || [];

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const todayCount = items.filter((gen: Generation) => 
          new Date(gen.created_at) >= today
        ).length;

        const weekCount = items.filter((gen: Generation) => 
          new Date(gen.created_at) >= weekAgo
        ).length;

        const monthCount = items.filter((gen: Generation) => 
          new Date(gen.created_at) >= monthAgo
        ).length;

        const byType = items.reduce((acc: any, gen: Generation) => {
          acc[gen.type] = (acc[gen.type] || 0) + 1;
          return acc;
        }, { text: 0, image: 0, video: 0 });

        setStats({
          total: items.length,
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount,
          byType
        });
      }
    } catch (err) {
      console.error('Failed to calculate stats:', err);
    }
  };

  const getCostByType = (type: string) => {
    switch (type) {
      case 'text': return 1;
      case 'image': return 5;
      case 'video': return 10;
      default: return 1;
    }
  };

  const totalCreditsUsed = generations.reduce((sum, gen) => sum + getCostByType(gen.type), 0);

  const regenerateItem = async (generation: Generation) => {
    if (!generation.prompt) return;
    
    // This would trigger a new generation with the same prompt
    // You can integrate this with your existing generation logic
    console.log('Regenerating:', generation.prompt);
  };

  const deleteGeneration = async (id: string) => {
    if (!confirm('Are you sure you want to delete this generation?')) return;
    
    try {
      const response = await fetch(`/api/generations/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setGenerations(prev => prev.filter(gen => gen.id !== id));
        calculateStats();
      }
    } catch (err) {
      console.error('Failed to delete generation:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDisplayUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('http') && !url.startsWith(window.location.origin)) {
      return `/api/social-twin/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  return (
    <div className={`h-full flex flex-col ${darkMode ? 'text-white' : 'text-black'}`}>
      {/* Header with Credits Display */}
      <div className={`border-b p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Your Generations</h2>
          <CreditDisplay className="w-64" showDetails={false} />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <div className="text-sm opacity-70">Total Generations</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <div className="text-sm opacity-70">Today</div>
            <div className="text-2xl font-bold text-blue-500">{stats.today}</div>
          </div>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <div className="text-sm opacity-70">This Week</div>
            <div className="text-2xl font-bold text-green-500">{stats.thisWeek}</div>
          </div>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <div className="text-sm opacity-70">Credits Used</div>
            <div className="text-2xl font-bold text-purple-500">{totalCreditsUsed}</div>
          </div>
        </div>

        {/* Generation Type Distribution */}
        <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} mb-4`}>
          <div className="text-sm opacity-70 mb-2">Generation Types</div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-sm">Text: {stats.byType.text}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-sm">Image: {stats.byType.image}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span className="text-sm">Video: {stats.byType.video}</span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex gap-2">
          {['all', 'text', 'image', 'video'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type as any)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                filter === type
                  ? 'bg-blue-500 text-white'
                  : darkMode
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Generations List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && page === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className={`text-center p-8 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
            <p>{error}</p>
            <button
              onClick={() => fetchGenerations()}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center p-8 opacity-70">
            <p>No generations found.</p>
            <p className="text-sm mt-2">Start generating content to see your history here!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {generations.map((generation) => (
              <div
                key={generation.id}
                className={`border rounded-lg p-4 ${
                  darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      generation.type === 'text'
                        ? 'bg-blue-100 text-blue-800'
                        : generation.type === 'image'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {generation.type.toUpperCase()}
                    </div>
                    <div className="text-xs opacity-70">
                      {getCostByType(generation.type)} credits
                    </div>
                  </div>
                  <div className="text-xs opacity-70">
                    {formatDate(generation.created_at)}
                  </div>
                </div>

                {generation.prompt && (
                  <div className="mb-3">
                    <div className="text-sm font-medium opacity-70 mb-1">Prompt:</div>
                    <div className="text-sm">{generation.prompt}</div>
                  </div>
                )}

                {generation.content && generation.type === 'text' && (
                  <div className="mb-3">
                    <div className="text-sm font-medium opacity-70 mb-1">Generated Text:</div>
                    <div className={`text-sm p-3 rounded ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      {generation.content}
                    </div>
                  </div>
                )}

                {generation.result_url && (generation.type === 'image' || generation.type === 'video') && (
                  <div className="mb-3">
                    {generation.type === 'image' ? (
                      <img
                        src={getDisplayUrl(generation.result_url)}
                        alt="Generated content"
                        className="max-w-full h-auto rounded border max-h-64 object-contain"
                      />
                    ) : (
                      <video
                        src={getDisplayUrl(generation.result_url)}
                        controls
                        className="max-w-full h-auto rounded border max-h-64"
                      />
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-opacity-20">
                  {generation.prompt && (
                    <button
                      onClick={() => regenerateItem(generation)}
                      className={`px-3 py-1 text-xs rounded border ${
                        darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      Regenerate
                    </button>
                  )}
                  
                  {generation.result_url && onAddToCanvas && (generation.type === 'image' || generation.type === 'video') && (
                    <button
                      onClick={() => onAddToCanvas(generation.result_url!, generation.type as 'image' | 'video')}
                      className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600"
                    >
                      Add to Canvas
                    </button>
                  )}

                  <button
                    onClick={() => deleteGeneration(generation.id)}
                    className={`px-3 py-1 text-xs rounded border border-red-500 text-red-500 hover:bg-red-50 ${
                      darkMode ? 'hover:bg-red-900' : ''
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => fetchGenerations(page + 1, false)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
