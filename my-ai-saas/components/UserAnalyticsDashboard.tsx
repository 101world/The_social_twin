'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import CreditDisplay from './CreditDisplay';

interface UsageStats {
  totalGenerations: number;
  totalCreditsUsed: number;
  generationsByType: { text: number; image: number; video: number };
  generationsByDay: Array<{ date: string; count: number; credits: number }>;
  averageCostPerGeneration: number;
  successRate: number;
  favoritePrompts: Array<{ prompt: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

interface UserAnalyticsDashboardProps {
  darkMode?: boolean;
}

export default function UserAnalyticsDashboard({ darkMode = false }: UserAnalyticsDashboardProps) {
  const { userId } = useAuth();
  const { user } = useUser();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    if (userId) {
      fetchAnalytics();
    }
  }, [userId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all generations for analysis
      const response = await fetch(`/api/generations?limit=1000&timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const data = await response.json();
      const generations = data.items || [];

      // Calculate comprehensive stats
      const analytics = calculateAnalytics(generations);
      setStats(analytics);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (generations: any[]): UsageStats => {
    const CREDIT_COSTS = { text: 1, image: 5, video: 10, 'image-modify': 3 };

    const totalGenerations = generations.length;
    const totalCreditsUsed = generations.reduce((sum, gen) => {
      const cost = CREDIT_COSTS[gen.type as keyof typeof CREDIT_COSTS] || 1;
      const batchSize = gen.metadata?.batch_size || 1;
      return sum + (cost * batchSize);
    }, 0);

    const generationsByType = generations.reduce((acc, gen) => {
      acc[gen.type] = (acc[gen.type] || 0) + 1;
      return acc;
    }, { text: 0, image: 0, video: 0 });

    // Group by day for trend analysis
    const dayMap = new Map<string, { count: number; credits: number }>();
    generations.forEach(gen => {
      const date = new Date(gen.created_at).toISOString().split('T')[0];
      const cost = CREDIT_COSTS[gen.type as keyof typeof CREDIT_COSTS] || 1;
      const batchSize = gen.metadata?.batch_size || 1;
      const credits = cost * batchSize;

      if (dayMap.has(date)) {
        const existing = dayMap.get(date)!;
        dayMap.set(date, { count: existing.count + 1, credits: existing.credits + credits });
      } else {
        dayMap.set(date, { count: 1, credits });
      }
    });

    const generationsByDay = Array.from(dayMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const averageCostPerGeneration = totalGenerations > 0 ? totalCreditsUsed / totalGenerations : 0;

    // Calculate success rate (assuming generations with result_url are successful)
    const successfulGenerations = generations.filter(gen => 
      gen.result_url || gen.content || gen.metadata?.status === 'completed'
    ).length;
    const successRate = totalGenerations > 0 ? (successfulGenerations / totalGenerations) * 100 : 0;

    // Find favorite prompts
    const promptMap = new Map<string, number>();
    generations.forEach(gen => {
      if (gen.prompt) {
        const prompt = gen.prompt.length > 50 ? gen.prompt.substring(0, 50) + '...' : gen.prompt;
        promptMap.set(prompt, (promptMap.get(prompt) || 0) + 1);
      }
    });

    const favoritePrompts = Array.from(promptMap.entries())
      .map(([prompt, count]) => ({ prompt, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Find top endpoints
    const endpointMap = new Map<string, number>();
    generations.forEach(gen => {
      if (gen.metadata?.runpod_url) {
        try {
          const url = new URL(gen.metadata.runpod_url);
          const endpoint = url.hostname;
          endpointMap.set(endpoint, (endpointMap.get(endpoint) || 0) + 1);
        } catch {
          // Invalid URL, skip
        }
      }
    });

    const topEndpoints = Array.from(endpointMap.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      totalGenerations,
      totalCreditsUsed,
      generationsByType,
      generationsByDay,
      averageCostPerGeneration,
      successRate,
      favoritePrompts,
      topEndpoints,
    };
  };

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      case 'all': return 'All Time';
      default: return 'Last 30 Days';
    }
  };

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${darkMode ? 'text-white' : 'text-black'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full flex items-center justify-center ${darkMode ? 'text-white' : 'text-black'}`}>
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`h-full flex items-center justify-center ${darkMode ? 'text-white' : 'text-black'}`}>
        <p>No analytics data available.</p>
      </div>
    );
  }

  return (
    <div className={`h-full p-6 overflow-y-auto ${darkMode ? 'text-white' : 'text-black'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Your generation insights and usage patterns
          </p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {getTimeRangeLabel(range)}
            </button>
          ))}
        </div>
      </div>

      {/* Credits Overview */}
      <div className="mb-6">
        <CreditDisplay className="w-full" showDetails={true} />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📊</span>
            <h3 className="font-medium">Total Generations</h3>
          </div>
          <div className="text-2xl font-bold text-blue-500">{stats.totalGenerations}</div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {getTimeRangeLabel(timeRange)}
          </div>
        </div>

        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💳</span>
            <h3 className="font-medium">Credits Used</h3>
          </div>
          <div className="text-2xl font-bold text-purple-500">{stats.totalCreditsUsed}</div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Avg: {stats.averageCostPerGeneration.toFixed(1)} per generation
          </div>
        </div>

        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✅</span>
            <h3 className="font-medium">Success Rate</h3>
          </div>
          <div className="text-2xl font-bold text-green-500">{stats.successRate.toFixed(1)}%</div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Successful generations
          </div>
        </div>

        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔥</span>
            <h3 className="font-medium">Most Active</h3>
          </div>
          <div className="text-2xl font-bold text-orange-500">
            {Object.entries(stats.generationsByType)
              .sort(([,a], [,b]) => b - a)[0]?.[0]?.toUpperCase() || 'N/A'}
          </div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Generation type
          </div>
        </div>
      </div>

      {/* Generation Types Distribution */}
      <div className={`p-4 rounded-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <h3 className="font-medium mb-4">Generation Types</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(stats.generationsByType).map(([type, count]) => (
            <div key={type} className="text-center">
              <div className={`text-3xl mb-2 ${
                type === 'text' ? 'text-blue-500' :
                type === 'image' ? 'text-green-500' :
                'text-purple-500'
              }`}>
                {count}
              </div>
              <div className="text-sm font-medium capitalize">{type}</div>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {stats.totalGenerations > 0 ? ((count / stats.totalGenerations) * 100).toFixed(1) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Trend */}
      {stats.generationsByDay.length > 0 && (
        <div className={`p-4 rounded-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <h3 className="font-medium mb-4">Activity Trend</h3>
          <div className="h-32 flex items-end gap-1">
            {stats.generationsByDay.slice(-14).map((day, index) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center group relative"
              >
                <div
                  className="w-full bg-blue-500 rounded-t transition-all duration-200 hover:bg-blue-400"
                  style={{
                    height: `${Math.max(4, (day.count / Math.max(...stats.generationsByDay.map(d => d.count))) * 100)}%`
                  }}
                ></div>
                <div className="text-xs mt-1 transform rotate-45 origin-left w-16">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {day.count} generations<br/>
                  {day.credits} credits
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorite Prompts & Top Endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Favorite Prompts */}
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <h3 className="font-medium mb-4">🌟 Favorite Prompts</h3>
          {stats.favoritePrompts.length > 0 ? (
            <div className="space-y-3">
              {stats.favoritePrompts.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {item.prompt}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {item.count}x
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No favorite prompts yet. Start generating to see patterns!
            </div>
          )}
        </div>

        {/* Top Endpoints */}
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <h3 className="font-medium mb-4">🚀 Top RunPod Endpoints</h3>
          {stats.topEndpoints.length > 0 ? (
            <div className="space-y-3">
              {stats.topEndpoints.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {item.endpoint}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {item.count}x
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No endpoint usage data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
