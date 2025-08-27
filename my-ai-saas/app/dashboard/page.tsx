"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  CreditCardIcon,
  SparklesIcon,
  PhotoIcon,
  FolderIcon,
  UserGroupIcon,
  UserIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CogIcon,
  ArrowPathIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import Link from "next/link";

type ActivityItem = {
  id: string;
  type: 'generation' | 'project' | 'subscription';
  title: string;
  description: string;
  timestamp: string;
  status?: 'success' | 'pending' | 'error';
};

type AnalyticsData = {
  totalGenerations: number;
  totalProjects: number;
  creditsUsed: number;
  creditsRemaining: number;
  memberSince: string;
  recentActivity: ActivityItem[];
  usageStats: {
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  topCategories: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
};

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadDashboardData();
    } else if (isLoaded && !user) {
      setLoading(false);
    }
  }, [user?.id, isLoaded]);

  const loadDashboardData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Load all dashboard data in parallel
      const [projectsRes, mediaRes, creditsRes] = await Promise.allSettled([
        fetch('/api/social-twin/projects', {
          headers: { 'X-User-Id': user.id }
        }),
        fetch("/api/social-twin/history?limit=20", {
          headers: { "X-User-Id": user.id }
        }),
        fetch('/api/users/credits')
      ]);

      // Process projects
      let projects = [];
      if (projectsRes.status === 'fulfilled' && projectsRes.value.ok) {
        const projectsData = await projectsRes.value.json();
        projects = Array.isArray(projectsData.projects) ? projectsData.projects : [];
      }

      // Process media/generations
      let media = [];
      if (mediaRes.status === 'fulfilled' && mediaRes.value.ok) {
        const mediaData = await mediaRes.value.json();
        media = Array.isArray(mediaData.items) ? mediaData.items : [];
      }

      // Process credits
      let creditsData = { credits: 0, oneMaxBalance: null, isOneMaxUser: false };
      if (creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
        creditsData = await creditsRes.value.json();
      }

      // Generate recent activity
      const recentActivity: ActivityItem[] = [];

      // Add recent generations
      media.slice(0, 3).forEach((item: any, index: number) => {
        recentActivity.push({
          id: `gen-${item?.id || index}`,
          type: 'generation',
          title: 'AI Generation Created',
          description: item?.prompt ? item.prompt.substring(0, 50) + '...' : 'New content generated',
          timestamp: item?.created_at || item?.createdAt || new Date().toISOString(),
          status: 'success'
        });
      });

      // Add recent projects
      projects.slice(0, 2).forEach((project: any, index: number) => {
        recentActivity.push({
          id: `proj-${project?.id || index}`,
          type: 'project',
          title: 'Project Updated',
          description: project?.title || 'Untitled Project',
          timestamp: project?.updated_at || project?.created_at || new Date().toISOString(),
          status: 'success'
        });
      });

      // Sort activity by timestamp
      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Calculate usage stats (mock data for now)
      const thisMonth = media.length;
      const lastMonth = Math.floor(media.length * 0.7); // Mock data
      const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

      // Top categories (mock data based on available data)
      const topCategories = [
        { name: 'AI Generations', count: media.length, percentage: 65 },
        { name: 'Projects', count: projects.length, percentage: 35 }
      ];

      const analyticsData: AnalyticsData = {
        totalGenerations: media.length,
        totalProjects: projects.length,
        creditsUsed: creditsData.credits || 0,
        creditsRemaining: creditsData.oneMaxBalance ? 0 : Math.max(0, 1000 - (creditsData.credits || 0)), // Mock remaining
        memberSince: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently',
        recentActivity: recentActivity.slice(0, 8),
        usageStats: {
          thisMonth,
          lastMonth,
          growth
        },
        topCategories
      };

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatActivityMessage = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'generation':
        return 'Generated new AI content';
      case 'project':
        return 'Updated project';
      case 'subscription':
        return 'Subscription updated';
      default:
        return activity.title;
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'generation':
        return PhotoIcon;
      case 'project':
        return FolderIcon;
      case 'subscription':
        return CreditCardIcon;
      default:
        return SparklesIcon;
    }
  };

  const getStatusColor = (status?: ActivityItem['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // Show loading while Clerk is loading
  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your dashboard...</p>
          </div>
        </div>
      </main>
    );
  }

  // Show sign in prompt if not authenticated
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Please Sign In</h1>
            <p className="text-gray-400 mb-6">You need to be signed in to view your dashboard.</p>
            <Link
              href="/sign-in"
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your analytics...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-red-400 mb-4">Error Loading Dashboard</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={loadDashboardData}
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!analytics) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">No Data Available</h1>
            <p className="text-gray-400 mb-6">Start creating content to see your analytics here.</p>
            <Link
              href="/social-twin"
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Start Creating
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
      <div className="mx-auto max-w-7xl p-6">
        {/* Header */}
        <section className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Analytics Dashboard
              </h1>
              <p className="text-gray-400 mt-2">Welcome back, {user.fullName || user.username || "Creator"}! Here's your creative journey at a glance.</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-neutral-800/50 hover:bg-neutral-700/50 text-white px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </section>

        {/* Key Metrics Cards */}
        <section className="mb-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 rounded-2xl p-6 border border-cyan-500/20 hover:border-cyan-400/40 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <PhotoIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-cyan-300 font-medium">AI Generations</p>
                  <p className="text-2xl font-bold text-cyan-400">{analytics.totalGenerations}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-cyan-300/70">Total creations</p>
                <ArrowTrendingUpIcon className="w-4 h-4 text-cyan-400" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20 hover:border-purple-400/40 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <FolderIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-purple-300 font-medium">Projects</p>
                  <p className="text-2xl font-bold text-purple-400">{analytics.totalProjects}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-purple-300/70">Active workspaces</p>
                <EyeIcon className="w-4 h-4 text-purple-400" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/20 hover:border-green-400/40 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <CreditCardIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-300 font-medium">Credits Used</p>
                  <p className="text-2xl font-bold text-green-400">{analytics.creditsUsed}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-300/70">{analytics.creditsRemaining} remaining</p>
                <HeartIcon className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Usage Analytics & Top Categories */}
        <section className="mb-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Usage Trends */}
            <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-700/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Usage Trends</h3>
                <ChartBarIcon className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl">
                  <div>
                    <p className="text-white font-medium">This Month</p>
                    <p className="text-gray-400 text-sm">AI Generations</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-cyan-400">{analytics.usageStats.thisMonth}</p>
                    <p className={`text-sm ${analytics.usageStats.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {analytics.usageStats.growth >= 0 ? '+' : ''}{analytics.usageStats.growth.toFixed(1)}% from last month
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Last Month</p>
                    <p className="text-gray-400 text-sm">AI Generations</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-400">{analytics.usageStats.lastMonth}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Member Since</p>
                    <p className="text-gray-400 text-sm">Account created</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-teal-400">{analytics.memberSince}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Categories */}
            <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-700/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Content Categories</h3>
                <ShareIcon className="w-6 h-6 text-teal-400" />
              </div>
              <div className="space-y-4">
                {analytics.topCategories.map((category, index) => (
                  <div key={category.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium">{category.name}</p>
                      <p className="text-gray-400 text-sm">{category.count} items</p>
                    </div>
                    <div className="w-full bg-neutral-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${category.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-700/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Recent Activity</h3>
              <ClockIcon className="w-6 h-6 text-cyan-400" />
            </div>

            <div className="space-y-4">
              {analytics.recentActivity.length > 0 ? (
                analytics.recentActivity.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-center gap-4 p-4 bg-neutral-800/50 rounded-xl hover:bg-neutral-700/50 transition-all">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        activity.type === 'generation' ? 'bg-cyan-500/20' :
                        activity.type === 'project' ? 'bg-purple-500/20' :
                        'bg-green-500/20'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          activity.type === 'generation' ? 'text-cyan-400' :
                          activity.type === 'project' ? 'text-purple-400' :
                          'text-green-400'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{formatActivityMessage(activity)}</p>
                        <p className="text-gray-400 text-sm">{activity.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                        <p className={`text-xs ${getStatusColor(activity.status)}`}>
                          {activity.status || 'completed'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <ClockIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No recent activity</p>
                  <p className="text-sm text-gray-500 mb-6">Start creating content to see your activity here.</p>
                  <Link
                    href="/social-twin"
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-6 py-3 rounded-xl font-medium transition-all"
                  >
                    Start Creating
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}


