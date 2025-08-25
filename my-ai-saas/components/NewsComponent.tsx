 'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, ExternalLink, Clock, Filter, Globe, Rocket, Heart, DollarSign, Palette, Leaf, Loader2, Play, Send } from 'lucide-react';

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

// Build a resilient image URL (placeholder if missing) like the standalone News page
function getCardImageUrl(article: NewsArticle, size: 'small' | 'medium' | 'large' = 'medium') {
  if (article.image_url) return article.image_url;
  const fallbackColors = ['ff6b6b', '4ecdc4', '45b7d1', 'f39c12', '9b59b6', 'e74c3c'];
  const colorIndex = article.title.length % fallbackColors.length;
  const color = fallbackColors[colorIndex];
  const maxLen = size === 'small' ? 30 : size === 'large' ? 60 : 40;
  const encodedTitle = encodeURIComponent(article.title.slice(0, maxLen) || 'News');
  if (size === 'large') return `https://via.placeholder.com/640x360/${color}/ffffff?text=${encodedTitle}`;
  if (size === 'small') return `https://via.placeholder.com/120x80/${color}/ffffff?text=${encodedTitle}`;
  return `https://via.placeholder.com/400x225/${color}/ffffff?text=${encodedTitle}`;
}

// Modern news card with mobile-optimized smaller thumbnails and high quality images
const ModernNewsCard = ({ article, layout = "default" }: { article: NewsArticle; layout?: "default" | "large" | "compact" }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTrend = () => {
    console.log('Trending:', article.title);
  };

  const openSource = () => {
    const url = article.source_url || article.url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const sourceName = article.source_name || article.source || 'Unknown Source';

  if (layout === "large") {
    return (
      <div className="group bg-black border border-gray-800 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-orange-500 relative">
        <div className="aspect-[16/9] md:aspect-[16/9] h-48 md:h-64 overflow-hidden bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
          <img 
            src={getCardImageUrl(article, 'large')} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-100 contrast-110 saturate-110"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://picsum.photos/640/360?random=${article.id || Math.random()}`;
            }}
          />
          {/* Subtle top gradient like Perplexity Discover */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
        </div>
        
        <div className="p-4 md:p-6">
          <h2 className="font-bold text-white text-lg md:text-xl leading-tight mb-3 group-hover:text-orange-400 transition-colors">
            {article.title}
          </h2>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="font-semibold text-gray-200">{sourceName}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(article.published_at)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleTrend}
                className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-orange-100 text-orange-600 rounded-full text-xs font-semibold hover:bg-orange-200 transition-colors"
              >
                <TrendingUp className="w-3 h-3" />
                <span className="hidden md:inline">Trend</span>
              </button>
              <button 
                onClick={openSource}
                className="p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-black border border-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-orange-500">
      <div className="flex gap-3 md:gap-4 p-3 md:p-4">
        <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
          <img 
            src={getCardImageUrl(article, 'small')} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter brightness-100 contrast-110 saturate-110"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://picsum.photos/120/80?random=${article.id || Math.random()}`;
            }}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm md:text-base leading-tight mb-2 line-clamp-2 group-hover:text-orange-400 transition-colors">
            {article.title}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-medium text-gray-300">{sourceName}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(article.published_at)}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handleTrend}
                className="p-1.5 text-orange-500 hover:bg-orange-500/10 rounded-full transition-colors"
                title="Trend this"
              >
                <TrendingUp className="w-3 h-3" />
              </button>
              <button 
                onClick={openSource}
                className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
                title="View source"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HeadlinesSection = ({ title, articles, layout = "default" }: { title: string; articles: NewsArticle[]; layout?: "default" | "hero" | "two-col" | "three-col" }) => {
  if (articles.length === 0) return null;

  const getGridClass = () => {
    switch (layout) {
      case "hero": return "grid-cols-1";
      case "two-col": return "grid-cols-1 md:grid-cols-2";
      case "three-col": return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      default: return "grid-cols-1";
    }
  };

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
        <div className="h-px bg-gray-800 flex-1"></div>
      </div>
      
      <div className={`grid ${getGridClass()} gap-3 md:gap-4`}>
        {articles.map(article => (
          <ModernNewsCard 
            key={article.id} 
            article={article} 
            layout={layout === "hero" ? "large" : "default"}
          />
        ))}
      </div>
    </div>
  );
};

// Horizontal scrolling strip for full-width layout
const HorizontalStrip = ({ title, articles, large = false }: { title: string; articles: NewsArticle[]; large?: boolean }) => {
  if (!articles.length) return null;
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent pb-2">
        <div className="flex gap-3 md:gap-4">
          {articles.map(a => (
            <div key={a.id} className={large ? 'min-w-[360px] max-w-[360px]' : 'min-w-[300px] max-w-[300px]'}>
              <ModernNewsCard article={a} layout={large ? 'large' : 'default'} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function NewsComponent({ simpleMode, mode = 'auto' }: { simpleMode?: boolean; mode?: 'auto' | 'vertical' | 'horizontal' }) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [detectedSimple, setDetectedSimple] = useState<boolean>(false);
  const [continent, setContinent] = useState<string>('');
  const [country, setCountry] = useState<string>('');

  // Load real news from API
  useEffect(() => {
  const loadNews = async () => {
      try {
        setLoading(true);
    const qs = new URLSearchParams();
    qs.set('limit', '50');
  // Prefer image-rich articles to match UI sections that require thumbnails
  qs.set('media', 'images');
    if (country) {
      qs.set('country', country);
    } else if (continent) {
      qs.set('continent', continent);
    }
    const response = await fetch(`/api/news?${qs.toString()}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data?.data?.articles) ? data.data.articles : [];
          if (list.length) {
            setArticles(list.slice(0, 30));
          } else {
            // Fallback: daily brief
            const briefRes = await fetch('/api/news/daily-brief', { cache: 'no-store' });
            if (briefRes.ok) {
              const brief = await briefRes.json();
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
            } else {
              setArticles([]);
            }
          }
        } else {
          console.error('Failed to fetch news');
          setArticles([]);
        }
      } catch (error) {
        console.error('Error loading news:', error);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

  loadNews();
  }, [country, continent]);

  // Detect simple mode (docked) if not provided
  useEffect(() => {
    if (typeof simpleMode === 'boolean') {
      setDetectedSimple(simpleMode);
      return;
    }
    if (mode !== 'auto') {
      setDetectedSimple(mode === 'vertical');
      return;
    }
    const check = () => {
      try {
        const sm = (window as any)?.__getSimpleMode?.() || false;
        setDetectedSimple(!!sm);
      } catch {}
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [simpleMode, mode]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return articles.filter(article => 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.source_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, articles]);

  if (loading) {
    return (
      <div className="h-full bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading latest news...</p>
        </div>
      </div>
    );
  }

  // Branch by layout: horizontal for full-width, vertical for docked (simple)
  const renderHorizontal = mode === 'horizontal' ? true : mode === 'vertical' ? false : !detectedSimple;

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="h-full flex flex-col">
        {/* Filters */}
  <div className="flex-shrink-0 p-3 md:p-5">
          {/* Country Dropdown - centered */}
          <div className="max-w-2xl mx-auto mb-2">
            <div className="flex items-center justify-center">
              <select
                value={continent}
                onChange={(e) => { setContinent(e.target.value); setCountry(''); }}
                className="mr-2 px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm"
                aria-label="Select continent"
              >
                <option value="">Continent</option>
                <option value="africa">Africa</option>
                <option value="asia">Asia</option>
                <option value="europe">Europe</option>
                <option value="north-america">North America</option>
                <option value="south-america">South America</option>
                <option value="oceania">Oceania</option>
              </select>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm"
                aria-label="Select country"
              >
                <option value="">Country</option>
                {continent === 'africa' && (
                  <>
                    <option value="ZA">South Africa</option>
                    <option value="NG">Nigeria</option>
                    <option value="KE">Kenya</option>
                    <option value="EG">Egypt</option>
                    <option value="GH">Ghana</option>
                    <option value="MA">Morocco</option>
                    <option value="TZ">Tanzania</option>
                    <option value="UG">Uganda</option>
                    <option value="DZ">Algeria</option>
                    <option value="ET">Ethiopia</option>
                  </>
                )}
                {continent === 'asia' && (
                  <>
                    <option value="IN">India</option>
                    <option value="CN">China</option>
                    <option value="JP">Japan</option>
                    <option value="KR">South Korea</option>
                    <option value="ID">Indonesia</option>
                    <option value="PH">Philippines</option>
                    <option value="TH">Thailand</option>
                    <option value="MY">Malaysia</option>
                    <option value="PK">Pakistan</option>
                    <option value="VN">Vietnam</option>
                  </>
                )}
                {continent === 'europe' && (
                  <>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="IT">Italy</option>
                    <option value="ES">Spain</option>
                    <option value="NL">Netherlands</option>
                    <option value="SE">Sweden</option>
                    <option value="NO">Norway</option>
                    <option value="PL">Poland</option>
                    <option value="RU">Russia</option>
                  </>
                )}
                {continent === 'north-america' && (
                  <>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                    <option value="GT">Guatemala</option>
                    <option value="CU">Cuba</option>
                    <option value="HT">Haiti</option>
                    <option value="DO">Dominican Republic</option>
                    <option value="HN">Honduras</option>
                    <option value="NI">Nicaragua</option>
                    <option value="CR">Costa Rica</option>
                  </>
                )}
                {continent === 'south-america' && (
                  <>
                    <option value="BR">Brazil</option>
                    <option value="AR">Argentina</option>
                    <option value="CO">Colombia</option>
                    <option value="CL">Chile</option>
                    <option value="PE">Peru</option>
                    <option value="VE">Venezuela</option>
                    <option value="EC">Ecuador</option>
                    <option value="UY">Uruguay</option>
                    <option value="PY">Paraguay</option>
                    <option value="BO">Bolivia</option>
                  </>
                )}
                {continent === 'oceania' && (
                  <>
                    <option value="AU">Australia</option>
                    <option value="NZ">New Zealand</option>
                    <option value="FJ">Fiji</option>
                    <option value="PG">Papua New Guinea</option>
                    <option value="WS">Samoa</option>
                    <option value="TO">Tonga</option>
                    <option value="VU">Vanuatu</option>
                    <option value="SB">Solomon Islands</option>
                    <option value="FM">Micronesia</option>
                    <option value="KI">Kiribati</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              placeholder="Search breaking news... Powered by 101World"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base bg-black border border-gray-800 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 text-white placeholder-gray-400"
            />
          </div>
          {isSearchOpen && searchQuery && (
            <div className="relative max-w-2xl mx-auto mt-1">
              <div className="absolute w-full bg-black border border-gray-800 rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Search Results ({searchResults.length})</h3>
                </div>
                {searchResults.slice(0, 5).map(article => (
                  <div key={article.id} className="p-4 hover:bg-gray-900 cursor-pointer border-b border-gray-800 last:border-b-0">
                    <h4 className="font-medium text-white text-sm mb-1 line-clamp-2">{article.title}</h4>
                    <p className="text-xs text-gray-400">{article.source_name || article.source} • {new Date(article.published_at).toLocaleDateString()}</p>
                  </div>
                ))}
                <div className="p-3 text-center border-t border-gray-800">
                  <span className="text-xs text-gray-500">Powered by 101World</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
  <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-4" onClick={() => setIsSearchOpen(false)}>
          {renderHorizontal ? (
            <>
              <HorizontalStrip title="Breaking News" articles={articles.slice(0, 6)} large />
              <HorizontalStrip title="World" articles={articles.filter(a => a.title.toLowerCase().includes('world') || a.category?.toLowerCase().includes('world')).slice(0, 10)} />
              <HorizontalStrip title="Technology" articles={articles.filter(a => a.title.toLowerCase().includes('tech') || a.title.toLowerCase().includes('ai') || a.category?.toLowerCase().includes('tech')).slice(0, 10)} />
              <HorizontalStrip title="Business" articles={articles.filter(a => a.title.toLowerCase().includes('business') || a.title.toLowerCase().includes('market') || a.category?.toLowerCase().includes('business')).slice(0, 10)} />
              <HorizontalStrip title="Latest" articles={articles.slice(6, 20)} />
            </>
          ) : (
            <>
  <HeadlinesSection title="Breaking News" articles={articles.slice(0, 1)} layout="hero" />
  <HeadlinesSection title="Top Stories" articles={articles.slice(1, 3)} layout="two-col" />
  <HeadlinesSection title="World" articles={articles.filter(a => (a.title.toLowerCase().includes('world') || a.category?.toLowerCase().includes('world'))).slice(0, 6)} layout="three-col" />
  <HeadlinesSection title="Technology" articles={articles.filter(a => (a.title.toLowerCase().includes('tech') || a.title.toLowerCase().includes('ai') || a.category?.toLowerCase().includes('tech'))).slice(0, 4)} layout="two-col" />
  <HeadlinesSection title="Business" articles={articles.filter(a => (a.title.toLowerCase().includes('business') || a.title.toLowerCase().includes('market') || a.category?.toLowerCase().includes('business'))).slice(0, 6)} layout="three-col" />
  <HeadlinesSection title="Latest Updates" articles={articles.slice(6, 12)} layout="two-col" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
