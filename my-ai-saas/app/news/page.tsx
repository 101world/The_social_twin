'use client';

import { useState, useEffect } from 'react';
import { Search, X, Clock } from 'lucide-react';

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

// Shared helpers
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const toOptimized = (url: string, w?: number, h?: number, q = 75) => {
  if (!url) return url;
  if (url.startsWith('data:')) return url;
  try {
    const u = new URL(url);
    return `/api/optimize-image?url=${encodeURIComponent(u.toString())}${w ? `&w=${w}` : ''}${h ? `&h=${h}` : ''}&q=${q}`;
  } catch {
    return url;
  }
};

const getImageUrl = (article: NewsArticle, w: number, h: number) => {
  // First try the article's image_url
  if (article.image_url && article.image_url.trim()) {
    // Check if it's a valid URL
    try {
      new URL(article.image_url);
      return toOptimized(article.image_url, w, h, 78);
    } catch {
      // Invalid URL, continue to fallback
    }
  }
  
  // Fallback to a more reliable placeholder service
  const colors = ['6366f1', '8b5cf6', 'ec4899', 'f43f5e', 'f97316', 'eab308', '22c55e', '06b6d4'];
  const color = colors[article.title.length % colors.length];
  const text = encodeURIComponent(article.title.slice(0, 20));
  
  // Use a more reliable placeholder service
  return `https://via.placeholder.com/${w}x${h}/${color}/ffffff?text=${text}`;
};

// Big headline card (Breaking News style)
const BigNewsCard = ({ article, onOpen }: { article: NewsArticle; onOpen: (a: NewsArticle) => void }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // 25% smaller
  const src = getImageUrl(article, 900, 506);
  return (
    <article
      className="group bg-black border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all cursor-pointer"
      onClick={() => onOpen(article)}
    >
  <div className="relative aspect-[16/9] bg-gray-900">
        {!imageError ? (
          <>
            <img
              src={src}
              alt={article.title}
              className={`w-full h-full object-cover group-hover:scale-[1.02] transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-center p-4">
              <div className="w-16 h-16 mx-auto mb-2 bg-gray-700 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-xs text-gray-400">Image unavailable</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>
      <div className="p-5">
        <h2 className="text-2xl font-bold text-white leading-tight mb-3 line-clamp-3 group-hover:text-gray-300" style={{ fontFamily: 'Times New Roman, serif' }}>
          {article.title}
        </h2>
        {(article.snippet || article.summary) && (
          <p className="text-gray-300 text-sm leading-relaxed mb-3 line-clamp-2">
            {article.snippet || article.summary}
          </p>
        )}
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="font-medium text-gray-200">{article.source_name || article.source || 'Source'}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(article.published_at)}</span>
          {article.category && article.category !== 'General' && (
            <>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700 text-xs">
                {article.category}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

// Compact grid card (image + title only)
const SmallNewsCard = ({ article, onOpen }: { article: NewsArticle; onOpen: (a: NewsArticle) => void }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // 25% smaller thumbnail
  const src = getImageUrl(article, 450, 300);
  return (
    <article
      className="bg-black border border-gray-800 rounded-lg overflow-hidden hover:border-gray-600 transition-colors cursor-pointer"
      onClick={() => onOpen(article)}
    >
  <div className="aspect-[4/3] bg-gray-900">
        {!imageError ? (
          <>
            <img
              src={src}
              alt={article.title}
              className={`w-full h-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-center p-2">
              <div className="w-8 h-8 mx-auto mb-1 bg-gray-700 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] text-gray-400">No image</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold leading-snug line-clamp-2 mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>
          {article.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="text-gray-200 font-medium">{article.source_name || article.source || 'Source'}</span>
          <span>{formatDate(article.published_at).split(',')[0]}</span>
        </div>
      </div>
    </article>
  );
};

// In-app modal showing everything we scraped
const ArticleModal = ({ article, onClose, related }: { article: NewsArticle | null; onClose: () => void; related: NewsArticle[] }) => {
  if (!article) return null;
  // 25% smaller modal hero image
  const img = getImageUrl(article, 960, 540);
  const body = article.content || article.summary || article.snippet || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#0b0b0b] border border-gray-800 rounded-xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded bg-black/50 border border-gray-800 text-gray-300 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={img}
          alt={article.title}
          className="w-full h-56 object-cover rounded-t-xl"
          loading="eager"
          decoding="async"
        />
        <div className="p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">{article.title}</h1>
          <div className="text-sm text-gray-400 mb-4 flex items-center gap-2">
            <span className="font-medium text-gray-300">{article.source_name || article.source || 'Source'}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(article.published_at)}</span>
            {article.category && (
              <>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700 text-[11px]">
                  {article.category}
                </span>
              </>
            )}
              {/* external link moved to a subtle control in the header area; modal remains primary */}
          </div>

          {/* Everything we scraped: show all available text fields */}
          {body && (
            <div className="prose prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-gray-200 leading-relaxed">{body}</p>
            </div>
          )}
          {!body && (
            <p className="text-gray-400">No full text available. We only have the headline and metadata for this story.</p>
          )}

          {/* Related items (same topic heuristic) */}
          {related.length > 0 && (
            <div className="mt-8">
              <h4 className="text-lg font-semibold text-white mb-3">More on this topic</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {related.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex gap-3 items-start p-2 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors">
                    <div className="w-24 h-16 bg-gray-900 rounded flex-shrink-0 overflow-hidden">
                      <img
                        src={getImageUrl(r, 240, 150)}
                        alt={r.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getImageUrl(r, 240, 150);
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white line-clamp-2">{r.title}</div>
                      <div className="text-xs text-gray-400 mt-1">{r.source_name || r.source || 'Source'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchNews();
    
    // Start auto-refresh
    if (autoRefreshEnabled) {
      startAutoRefresh();
    }
    
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (autoRefreshEnabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    
    return () => stopAutoRefresh();
  }, [autoRefreshEnabled]);

  const startAutoRefresh = () => {
    stopAutoRefresh(); // Clear any existing interval
    const interval = setInterval(() => {
      fetchNews(true); // Silent refresh
    }, 30000); // Refresh every 30 seconds
    setAutoRefreshInterval(interval);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
    }
  };

  const fetchNews = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      // Try to get articles with images first
      const response = await fetch('/api/news?limit=60&media=images&category=all', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        let list = Array.isArray(data?.data?.articles) ? data.data.articles : [];
        
        // If we don't have enough articles with images, get more without the filter
        if (list.length < 20) {
          const fallbackResponse = await fetch('/api/news?limit=40', { cache: 'no-store' });
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const fallbackList = Array.isArray(fallbackData?.data?.articles) ? fallbackData.data.articles : [];
            // Combine and deduplicate by ID
            const combined = [...list, ...fallbackList];
            const seen = new Set();
            list = combined.filter(article => {
              if (seen.has(article.id || article.url)) return false;
              seen.add(article.id || article.url);
              return true;
            });
          }
        }
        
        if (list.length > 0) {
          const sorted = list.sort((a: NewsArticle, b: NewsArticle) =>
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          );
          setArticles(sorted);
          setLastUpdated(new Date().toISOString());
          return;
        }
      }
      await loadDailyBriefFallback();
    } catch (error) {
      console.error('Error fetching news:', error);
      await loadDailyBriefFallback();
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadDailyBriefFallback = async () => {
    try {
      const res = await fetch('/api/news/daily-brief', { cache: 'no-store' });
      if (!res.ok) throw new Error('daily-brief failed');
      const brief = await res.json();
      const mapped: NewsArticle[] = (brief?.articles || []).map((a: any, i: number) => ({
        id: a.id || a.url || `brief-${i}`,
        title: a.title || 'Untitled',
        content: a.snippet || a.summary || '',
        snippet: a.snippet || a.summary || '',
        summary: a.snippet || a.summary || '',
        published_at: a.publishDate || new Date().toISOString(),
        source_name: a.source || 'Daily Brief',
        source: a.source || 'Daily Brief',
        source_url: a.url,
        url: a.url,
        category: a.category || 'General',
        quality_score: 0,
        image_url: a.imageUrl || undefined,
      }));
      setArticles(mapped);
    } catch (e) {
      const now = new Date().toISOString();
      setArticles([
        { id: 'local-1', title: 'Stay tuned: Live news feed warming up', published_at: now, category: 'System', quality_score: 0 },
        { id: 'local-2', title: 'Tip: Check back in a moment for fresh headlines', published_at: now, category: 'System', quality_score: 0 },
      ] as NewsArticle[]);
    }
  };

  const searchResults = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (article.content && article.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (article.snippet && article.snippet.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="text-center pt-20">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" style={{ fontFamily: 'Times New Roman, serif' }}>
            ONE World News
          </h1>
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse"></div>
              <div className="w-4 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              <span className="ml-4 text-gray-300 font-medium text-lg" style={{ fontFamily: 'Times New Roman, serif' }}>
                Loading latest global news...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Slice for layout: 2 big, 1 big, 3 small, 1 big, 3 small
  const big1 = articles.slice(0, 2);
  const big2 = articles.slice(2, 3);
  const small1 = articles.slice(3, 6);
  const big3 = articles.slice(6, 7);
  const small2 = articles.slice(7, 10);

  // Related for modal (simple heuristic: share a keyword with active title)
  const related = activeArticle
    ? articles.filter(a => a.id !== activeArticle.id && a.title.split(/\s+/).some(w => w.length > 4 && activeArticle.title.toLowerCase().includes(w.toLowerCase())))
    : [];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>
            ONE World News
          </h1>
          <p className="text-xl text-gray-300 mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>
            Breaking News • Global Coverage • Real-time Updates
          </p>
          <div className="w-24 h-0.5 bg-gradient-to-r from-gray-500 to-gray-300 mx-auto"></div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-10 pr-4 py-3 text-sm bg-black border border-gray-800 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 outline-none text-white placeholder-gray-400"
            />
            {/* Controls: Refresh + Last updated + Auto-refresh toggle */}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={async () => {
                  try {
                    setRefreshing(true);
                    // Ask server to refresh in background, then reload feed
                    await fetch('/api/news/trigger', { cache: 'no-store' }).catch(() => {});
                    await fetchNews();
                  } finally {
                    setRefreshing(false);
                  }
                }}
                className={`px-3 py-1.5 text-xs rounded-lg border border-orange-600 text-orange-400 hover:bg-orange-600/10 transition-colors ${refreshing ? 'opacity-70 cursor-wait' : ''}`}
                disabled={refreshing}
                aria-busy={refreshing}
                aria-label="Refresh news"
                title="Refresh news"
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              
              {/* Auto-refresh toggle */}
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  autoRefreshEnabled 
                    ? 'border-green-600 text-green-400 hover:bg-green-600/10' 
                    : 'border-gray-600 text-gray-400 hover:bg-gray-600/10'
                }`}
                title={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              >
                {autoRefreshEnabled ? '🔄 Auto' : '⏸️ Manual'}
              </button>
              
              {lastUpdated && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
                  Updated {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </div>
            {isSearchOpen && searchQuery && (
              <div className="absolute z-40 mt-2 w-full bg-black border border-gray-800 rounded-lg shadow max-h-72 overflow-y-auto">
                {searchResults.slice(0, 6).map(article => (
                  <button
                    key={article.id}
                    onClick={() => { setActiveArticle(article); setIsSearchOpen(false); }}
                    className="w-full text-left p-3 hover:bg-gray-900 border-b border-gray-800 last:border-b-0"
                  >
                    <div className="text-sm text-white line-clamp-2">{article.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{article.source_name || article.source}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Layout */}
        <section className="space-y-8" onClick={() => setIsSearchOpen(false)}>
          {/* Breaking News - 2 posts */}
          <div>
            <h2 className="text-3xl font-bold text-white mb-6" style={{ fontFamily: 'Times New Roman, serif' }}>
              🚨 Breaking News
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {big1.map((a) => (
                <BigNewsCard key={a.id} article={a} onOpen={setActiveArticle} />
              ))}
            </div>
          </div>

          {/* Then one big post (same style) */}
          {big2.length > 0 && (
            <div>
              <BigNewsCard article={big2[0]} onOpen={setActiveArticle} />
            </div>
          )}

          {/* Then 3 posts images + title only */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {small1.map((a) => (
                <SmallNewsCard key={a.id} article={a} onOpen={setActiveArticle} />
              ))}
            </div>
          </div>

          {/* Then one big post */}
          {big3.length > 0 && (
            <div>
              <BigNewsCard article={big3[0]} onOpen={setActiveArticle} />
            </div>
          )}

          {/* Then 3 posts */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {small2.map((a) => (
                <SmallNewsCard key={a.id} article={a} onOpen={setActiveArticle} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Article Modal with full scraped content */}
      <ArticleModal article={activeArticle} onClose={() => setActiveArticle(null)} related={related} />
    </div>
  );
}
