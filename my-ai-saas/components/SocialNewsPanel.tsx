"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Clock, ExternalLink, Search } from 'lucide-react';

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
  category?: string;
  image_url?: string;
}

function thumbUrl(aOrTitle: NewsArticle | string | undefined, small = false) {
  const title = typeof aOrTitle === 'string' ? aOrTitle : (aOrTitle ? aOrTitle.title : 'News');
  const image = typeof aOrTitle !== 'string' && aOrTitle ? aOrTitle.image_url : undefined;
  if (image) return image;
  if (small) return `https://via.placeholder.com/160x120/222/fff?text=${encodeURIComponent((title||'News').slice(0,30))}`;
  return `https://via.placeholder.com/300x200/222/fff?text=${encodeURIComponent((title||'News').slice(0,30))}`;
}

function ProgressiveImage({ src, alt, className, small }: { src?: string; alt?: string; className?: string; small?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const low = src ? `${src}?w=${small ? 160 : 300}&q=30` : thumbUrl(alt || 'News', small);
  const high = src || low;
  return (
    <div className={`relative overflow-hidden ${className || ''}`}>
      {/* low-res blurred */}
      <img src={low} alt={alt} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-0 scale-105' : 'opacity-100 filter blur-sm'}`} />
      {/* high-res */}
      <img src={high} alt={alt} loading="lazy" onLoad={() => setLoaded(true)} className={`relative w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}

export default function SocialNewsPanel() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const qs = new URLSearchParams();
        qs.set('limit','50');
        qs.set('media','images');
        const res = await fetch(`/api/news?${qs.toString()}`, { cache: 'no-store' });
        if (!res.ok) return setArticles([]);
        const data = await res.json();
        const list = Array.isArray(data?.data?.articles) ? data.data.articles : (data?.data || []).slice ? data.data : [];
        if (!mounted) return;
        setArticles(list.map((a: any, i: number) => ({
          id: a.id || a.url || `n-${i}`,
          title: a.title || a.headline || 'Untitled',
          snippet: a.snippet || a.summary || a.description || '',
          published_at: a.published_at || a.publishDate || new Date().toISOString(),
          source_name: a.source_name || a.source || a.source?.name || '',
          url: a.url || a.source_url,
          image_url: a.image_url || a.imageUrl || a.image || undefined,
          category: a.category || 'General'
        })));
      } catch (e) {
        console.error('SocialNewsPanel load error', e);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!query) return articles;
    return articles.filter(a => (a.title || '').toLowerCase().includes(query.toLowerCase()) || (a.source_name||'').toLowerCase().includes(query.toLowerCase()));
  }, [query, articles]);

  return (
    <div className="h-full bg-black text-white flex flex-col">
      <div className="flex-shrink-0 p-4 border-b border-gray-800">
        <div className="max-w-[1100px] mx-auto">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Times New Roman, serif' }}>ONE World News</h1>
          <p className="text-sm text-gray-400" style={{ fontFamily: 'Times New Roman, serif' }}>Compact reader — headlines on the left, detailed view on the right</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-[1200px] mx-auto flex flex-col md:flex-row gap-4 p-4">
          {/* Left column: search + headlines */}
          <aside className="w-full md:w-1/3 h-full flex flex-col gap-3">
            <div>
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search headlines" className="w-full pl-9 pr-3 py-2 text-sm bg-black border border-gray-800 rounded-lg outline-none text-white placeholder-gray-500" />
              </label>
            </div>

            <div className="overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              {loading ? (
                <div className="text-gray-400 py-8">Loading headlines…</div>
              ) : filtered.length === 0 ? (
                <div className="text-gray-400 py-8">No articles found.</div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map(a => (
                    <li key={a.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-900 cursor-pointer" onClick={() => setSelected(a)}>
                      <div className="w-20 h-14 rounded overflow-hidden flex-shrink-0">
                        <ProgressiveImage src={a.image_url} alt={a.title} small />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ fontFamily: 'Times New Roman, serif' }}>{a.title}</div>
                        <div className="text-[12px] text-gray-500 mt-1 truncate">{a.source_name || a.source} • {new Date(a.published_at).toLocaleDateString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Right column: article pane */}
          <main className="w-full md:w-2/3 bg-black border border-gray-800 rounded-lg p-4 flex flex-col" style={{ minHeight: 360 }}>
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
                <div className="text-xl font-semibold mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>Select a headline</div>
                <div className="text-sm max-w-[520px]">Choose an item from the list to read a clean, distraction-free preview. Use the search box to quickly filter headlines.</div>
              </div>
            ) : (
              <article className="flex-1 flex flex-col gap-4">
                <div className="w-full h-56 md:h-72 overflow-hidden rounded">
                  <ProgressiveImage src={selected.image_url} alt={selected.title} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'Times New Roman, serif' }}>{selected.title}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                    <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(selected.published_at).toLocaleString()}</div>
                    <div>•</div>
                    <div>{selected.source_name || selected.source}</div>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none text-gray-200" style={{ fontFamily: 'Georgia, Times, "Times New Roman", serif' }}>
                  <p>{selected.snippet || selected.summary || selected.content || 'No preview available. Open source to read the full article.'}</p>
                </div>

                <div className="mt-auto flex items-center gap-2">
                  {selected.url && (
                    <a href={selected.url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border border-gray-700 text-sm bg-white text-black">Open source</a>
                  )}
                  <button onClick={() => window.open(selected.url || '#', '_blank')} className="px-3 py-1 rounded border border-gray-700 text-sm text-gray-300 hover:bg-gray-900">Open in new tab</button>
                </div>
              </article>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
