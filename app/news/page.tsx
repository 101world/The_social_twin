'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Calendar, User, Play, Image as ImageIcon } from 'lucide-react';

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
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<NewsArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchDailyBrief();
  }, []);

  const fetchDailyBrief = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/news/daily-brief');
      const data = await response.json();
      setDailyBrief(data);
      setSearchResults(data.articles || []);
    } catch (error) {
      console.error('Error fetching daily brief:', error);
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
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedCategory !== 'All') params.append('category', selectedCategory);

      const response = await fetch(`/api/news/search?${params}`);
      const data = await response.json();
      setSearchResults(data.articles || []);
    } catch (error) {
      console.error('Error searching articles:', error);
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

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return videoId ? `https://www.youtube.com/embed/${videoId[1]}` : null;
  };

  const getVimeoEmbedUrl = (url: string) => {
    const videoId = url.match(/vimeo\.com\/(\d+)/);
    return videoId ? `https://player.vimeo.com/video/${videoId[1]}` : null;
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
            <Skeleton className="h-12 w-64 bg-gray-800" />
            <Skeleton className="h-8 w-full max-w-md bg-gray-800" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="bg-gray-800 border-gray-700">
                  <Skeleton className="h-48 w-full bg-gray-700" />
                  <CardHeader>
                    <Skeleton className="h-6 w-full bg-gray-700" />
                    <Skeleton className="h-4 w-3/4 bg-gray-700" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full bg-gray-700" />
                    <Skeleton className="h-4 w-2/3 bg-gray-700" />
                  </CardContent>
                </Card>
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
                <Calendar className="w-4 h-4" />
                {dailyBrief.date}
              </span>
              <span>{dailyBrief.total_articles} articles</span>
              <span>{dailyBrief.sources.length} sources</span>
              {dailyBrief.multimedia_count && (
                <>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />
                    {dailyBrief.multimedia_count.with_images} with images
                  </span>
                  <span className="flex items-center gap-1">
                    <Play className="w-4 h-4" />
                    {dailyBrief.multimedia_count.with_videos} with videos
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search articles, topics, or authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              className="md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
            <Button 
              onClick={clearSearch} 
              variant="outline"
              className="md:w-auto border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Clear
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {['All', ...(dailyBrief?.categories || [])].map((category) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                className={selectedCategory === category 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {searchResults.map((article) => (
            <Card key={article.id} className="flex flex-col h-full hover:shadow-xl transition-shadow bg-gray-800 border-gray-700">
              {/* Media Content */}
              {article.video_url && (
                <div className="relative h-48 bg-gray-800">
                  {article.video_platform === 'youtube' && getYouTubeEmbedUrl(article.video_url) && (
                    <iframe
                      src={getYouTubeEmbedUrl(article.video_url)}
                      className="w-full h-full rounded-t-lg"
                      frameBorder="0"
                      allowFullScreen
                      title={article.title}
                    />
                  )}
                  {article.video_platform === 'vimeo' && getVimeoEmbedUrl(article.video_url) && (
                    <iframe
                      src={getVimeoEmbedUrl(article.video_url)}
                      className="w-full h-full rounded-t-lg"
                      frameBorder="0"
                      allowFullScreen
                      title={article.title}
                    />
                  )}
                  {!article.video_platform && article.video_thumbnail && (
                    <div className="relative w-full h-full">
                      <img
                        src={article.video_thumbnail}
                        alt={article.title}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-t-lg">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-red-900 text-red-200 border-red-800">
                      <Play className="w-3 h-3 mr-1" />
                      Video
                    </Badge>
                  </div>
                </div>
              )}

              {!article.video_url && article.image_url && (
                <div className="relative h-48 bg-gray-800">
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-full object-cover rounded-t-lg"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/400x200?text=Image+Not+Available';
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-blue-900 text-blue-200 border-blue-800">
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Photo
                    </Badge>
                  </div>
                </div>
              )}

              <CardHeader className="flex-1">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                    {article.category}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {article.source}
                  </span>
                </div>
                <CardTitle className="text-lg leading-tight line-clamp-2 text-white">
                  {article.title}
                </CardTitle>
                <CardDescription className="line-clamp-3 text-gray-300">
                  {article.snippet}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Tags */}
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {article.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-gray-700 text-gray-300 border-gray-600">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Article Meta */}
                <div className="flex flex-col gap-2 text-sm text-gray-400 mb-4">
                  {article.author && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{article.author}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(article.publish_date)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => window.open(article.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Read More
                  </Button>
                  {article.video_url && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                      onClick={() => window.open(article.video_url, '_blank')}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {searchResults.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">
              No articles found matching your criteria.
            </p>
            <Button onClick={clearSearch} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
              Show All Articles
            </Button>
          </div>
        )}

        {/* Last Updated */}
        {dailyBrief && (
          <div className="text-center mt-12 text-sm text-gray-400">
            Last updated: {formatDate(dailyBrief.last_updated)}
          </div>
        )}
      </div>
    </div>
  );
}
