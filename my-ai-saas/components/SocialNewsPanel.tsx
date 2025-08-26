"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import Image from 'next/image';
import { Clock, ExternalLink, Search, List, LayoutGrid, Maximize2, Bookmark, Share2 } from 'lucide-react';

// ULTRA AGGRESSIVE GRAY BACKGROUND ENFORCEMENT
const forcedGrayStyle = `
  .news-panel-force-gray,
  .news-panel-force-gray *,
  .news-panel-force-gray > *,
  .news-panel-force-gray div,
  .news-panel-force-gray main,
  .news-panel-force-gray section,
  .news-panel-force-gray article,
  .news-panel-force-gray header,
  .news-panel-force-gray nav,
  .news-panel-force-gray aside,
  .news-panel-force-gray footer,
  .news-panel-force-gray span,
  .news-panel-force-gray p,
  .news-panel-force-gray h1,
  .news-panel-force-gray h2,
  .news-panel-force-gray h3,
  .news-panel-force-gray h4,
  .news-panel-force-gray h5,
  .news-panel-force-gray h6,
  .news-panel-force-gray ul,
  .news-panel-force-gray li,
  .news-panel-force-gray ol,
  .news-panel-force-gray .bg-white,
  .news-panel-force-gray .bg-gray-50,
  .news-panel-force-gray .bg-gray-100,
  [class*="bg-white"],
  [class*="bg-gray-50"] {
    background-color: #f9fafb !important;
    background: #f9fafb !important;
  }
  body, html {
    background-color: #f9fafb !important;
    background: #f9fafb !important;
  }
`;

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
  // Inline SVG placeholder for reliability (no network dependency)
  const w = small ? 160 : 300; const h = small ? 120 : 200;
  const text = encodeURIComponent((title || 'News').slice(0, 30));
  return `data:image/svg+xml;utf8,` + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
       <rect width='100%' height='100%' fill='#111'/>
       <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#fff' font-family='Times New Roman, serif' font-size='14'>${text}</text>
     </svg>`
  );
}

function ProgressiveImage({ src, alt, className, small }: { src?: string; alt?: string; className?: string; small?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  // Always use a guaranteed placeholder for the low layer (prevents blank when remote blocks query params)
  const low = thumbUrl(alt || 'News', small);
  const high = src || low;
  return (
  <div className={`relative overflow-hidden w-full h-full ${className || ''}`}>
      {/* low-res blurred fallback */}
      <img src={low} alt={alt} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-0 scale-105' : 'opacity-100 filter blur-sm'}`} />
  {/* high-res using Next/Image for better optimization */}
  <Image src={high} alt={alt || ''} fill sizes={small ? '160px' : '600px'} loading="lazy" onLoadingComplete={() => setLoaded(true)} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}

export default function SocialNewsPanel() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [query, setQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Record<string, { id: string; title: string; url?: string }>>({});
  const [toast, setToast] = useState<string | null>(null);
  const listRootRef = React.useRef<HTMLDivElement | null>(null);
  const [layoutMode, setLayoutMode] = useState<'grid'|'reader'>(() => {
    try {
      const v = localStorage.getItem('news_layout') as any;
      if (!v) return 'grid';
      // map legacy 'split' preference to 'grid' to avoid sidebar layout
      if (v === 'split') return 'grid';
      return v === 'reader' ? 'reader' : 'grid';
    } catch { return 'grid'; }
  });
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const touchStartX = React.useRef<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const bookmarksRef = React.useRef<HTMLDivElement | null>(null);
  const mainContentRef = React.useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);

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
        const mapped = list.map((a: any, i: number) => ({
          id: a.id || a.url || `n-${i}`,
          title: a.title || a.headline || 'Untitled',
          snippet: a.snippet || a.summary || a.description || '',
          published_at: a.published_at || a.publishDate || new Date().toISOString(),
          source_name: a.source_name || a.source || a.source?.name || '',
          url: a.url || a.source_url,
          image_url: a.image_url || a.imageUrl || a.image || undefined,
          category: a.category || 'General'
        }));
        setArticles(mapped);
        // Auto-select first article for quicker reading
        if (mounted && mapped.length > 0) {
          setSelectedIndex(0);
          setSelected(mapped[0]);
        }
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
    let list = articles;
    if (activeCategory && activeCategory !== 'All') {
      list = list.filter(a => (a.category || 'General') === activeCategory);
    }
    if (!query) return list;
    return list.filter(a => (a.title || '').toLowerCase().includes(query.toLowerCase()) || (a.source_name||'').toLowerCase().includes(query.toLowerCase()));
  }, [query, articles]);

  // Grid container ref to enable scrolling into view for selected items
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Determine a breaking headline (prefer category/title marker)
  const breaking = useMemo(() => {
    return filtered.find(a => /breaking/i.test((a.category || '') + ' ' + (a.title || '')) ) || null;
  }, [filtered]);

  // Items to render in the grid (exclude breaking if present)
  const gridItems = useMemo(() => filtered.filter(a => !breaking || a.id !== breaking.id), [filtered, breaking]);

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('news_bookmarks');
      if (raw) setBookmarks(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const toggleBookmark = (a: NewsArticle) => {
    setBookmarks(prev => {
      const copy = { ...prev };
      if (copy[a.id]) {
        delete copy[a.id];
        setToast('Removed bookmark');
      } else {
        copy[a.id] = { id: a.id, title: a.title, url: a.url };
        setToast('Bookmarked');
      }
      try { localStorage.setItem('news_bookmarks', JSON.stringify(copy)); } catch {}
      return copy;
    });
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => {
      const copy = { ...prev };
      if (copy[id]) delete copy[id];
      try { localStorage.setItem('news_bookmarks', JSON.stringify(copy)); } catch {}
      return copy;
    });
  };

  const shareArticle = async (a: NewsArticle) => {
    try {
      if (navigator.share && a.url) {
        await navigator.share({ title: a.title, url: a.url });
        setToast('Shared');
        return;
      }
      if (a.url) {
        await navigator.clipboard.writeText(a.url);
        setToast('Link copied');
      } else {
        setToast('No link to share');
      }
    } catch (e) {
      console.error('Share failed', e);
      setToast('Share failed');
    }
  };

  const readingTime = (a: NewsArticle) => {
    const text = (a.snippet || a.summary || a.content || a.title || '').trim();
    const words = text.split(/\s+/).filter(Boolean).length || 0;
    const mins = Math.max(1, Math.round(words / 200));
    return `${mins} min read`;
  };

  // Keyboard navigation for the headline list
  useEffect(() => {
    const el = listRootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement && el.contains(document.activeElement)) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(i => {
            const next = Math.min(filtered.length - 1, Math.max(0, i + 1));
            setSelected(filtered[next] || null);
            return next;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(i => {
            const prev = Math.max(0, Math.min(filtered.length - 1, i - 1));
            setSelected(filtered[prev] || null);
            return prev;
          });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const cur = filtered[selectedIndex];
          if (cur?.url) window.open(cur.url, '_blank');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, selectedIndex]);

  // Scroll selected card into view when selection changes (only for grid layout)
  useEffect(() => {
    if (layoutMode !== 'grid') return;
    if (selectedIndex < 0) return;
    const id = filtered[selectedIndex]?.id;
    if (!id) return;
    const el = document.getElementById(`news-card-${id}`);
    if (el && gridRef.current) {
      // Scroll the container so the element is visible and centered
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [selectedIndex, layoutMode, filtered]);

  // Persist layout preference
  useEffect(() => {
    try { localStorage.setItem('news_layout', layoutMode); } catch {}
  }, [layoutMode]);

  // Move selection by index safely across filtered list
  const safeSelectIndex = (idx: number) => {
    const bounded = Math.max(0, Math.min(filtered.length - 1, idx));
    setSelectedIndex(bounded);
    setSelected(filtered[bounded] || null);
  };

  // Reader navigation
  const readerPrev = () => safeSelectIndex((selectedIndex === -1 ? 0 : selectedIndex) - 1);
  const readerNext = () => safeSelectIndex((selectedIndex === -1 ? 0 : selectedIndex) + 1);

  // Touch/swipe handlers for reader mode (mobile)
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches?.[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    const end = e.changedTouches?.[0]?.clientX ?? null;
    if (start == null || end == null) return;
    const delta = end - start;
    const threshold = 60; // px
    if (delta > threshold) readerPrev();
    else if (delta < -threshold) readerNext();
    touchStartX.current = null;
  };

  // Modal keyboard handling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!showModal) return;
      if (e.key === 'Escape') setShowModal(false);
      if (e.key === 'ArrowRight') readerNext();
      if (e.key === 'ArrowLeft') readerPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal, selectedIndex, filtered]);

  // Focus trap & aria management for modals (article modal & bookmarks modal)
  useEffect(() => {
    const modalOpen = showModal || showBookmarks;
    const mainEl = mainContentRef.current;

    const lockBody = () => { try { document.body.style.overflow = 'hidden'; } catch {} };
    const unlockBody = () => { try { document.body.style.overflow = ''; } catch {} };

    if (modalOpen) {
      // save last focused element
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      // set aria-hidden on main content
      if (mainEl) mainEl.setAttribute('aria-hidden', 'true');
      lockBody();

  const container = showModal ? modalRef.current : bookmarksRef.current;
      if (container) {
        // focus first focusable
        const focusable = Array.from(container.querySelectorAll<HTMLElement>('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (focusable.length) focusable[0].focus();
  else container.focus();
      }

      // trap Tab key
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const container = showModal ? modalRef.current : bookmarksRef.current;
        if (!container) return;
        const focusable = Array.from(container.querySelectorAll<HTMLElement>('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      };
      window.addEventListener('keydown', onKey);

      return () => {
        window.removeEventListener('keydown', onKey);
        if (mainEl) mainEl.removeAttribute('aria-hidden');
        unlockBody();
        // restore focus
        try { lastFocusedRef.current?.focus(); } catch {}
      };
    }
    return undefined;
  }, [showModal, showBookmarks]);

  // Persist last-read article
  useEffect(() => {
    try {
      const id = localStorage.getItem('news_last_read');
      if (id && articles.length) {
        const found = articles.find(a => a.id === id);
        if (found) {
          setSelected(found);
          setSelectedIndex(articles.indexOf(found));
        }
      }
    } catch {}
  }, [articles]);

  useEffect(() => {
    try { if (selected) localStorage.setItem('news_last_read', selected.id); } catch {}
  }, [selected]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: forcedGrayStyle }} />
      <div ref={mainContentRef} className="h-full bg-gray-50 text-gray-900 flex flex-col news-panel-force-gray" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}} aria-live="polite">
      <div className="flex-shrink-0 p-4 border-b border-gray-800" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
        <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-4" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Times New Roman, serif' }}>ONE World News</h1>
            <p className="text-sm text-gray-400" style={{ fontFamily: 'Times New Roman, serif' }}>Clean reader — choose layout that fits your workflow</p>
          </div>
          <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-black border border-gray-800 rounded-lg p-1">
              <button aria-pressed={layoutMode==='grid'} title="Grid view" onClick={()=>setLayoutMode('grid')} className={`p-2 rounded ${layoutMode==='grid' ? 'bg-gray-900 ring-1 ring-gray-700' : 'hover:bg-gray-900'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button aria-pressed={layoutMode==='reader'} title="Immersive reader" onClick={()=>setLayoutMode('reader')} className={`p-2 rounded ${layoutMode==='reader' ? 'bg-gray-900 ring-1 ring-gray-700' : 'hover:bg-gray-900'}`}><Maximize2 className="w-4 h-4" /></button>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button title="Bookmarks" onClick={()=>{ setShowBookmarks(true); setToast(Object.keys(bookmarks).length ? `Bookmarks: ${Object.keys(bookmarks).length}` : 'No bookmarks'); }} className="px-3 py-1 rounded border border-gray-800 text-sm text-gray-300 hover:bg-gray-900 flex items-center gap-2"><Bookmark className="w-4 h-4"/> Bookmarks</button>
              <button title="Share selected" onClick={()=> selected && shareArticle(selected)} className="px-3 py-1 rounded border border-gray-800 text-sm text-gray-300 hover:bg-gray-900 flex items-center gap-2"><Share2 className="w-4 h-4"/> Share</button>
            </div>
          </div>
        </div>
      </div>
      {/* Category filters row */}
      <div className="flex-shrink-0 p-3 border-b border-gray-800" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
        <div className="max-w-[1100px] mx-auto flex gap-2 items-center overflow-x-auto" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
          {['All', ...Array.from(new Set(articles.map(a => a.category || 'General')))].map(cat => (
            <button key={cat} onClick={()=>setActiveCategory(cat)} className={`px-3 py-1 rounded-full text-sm ${activeCategory===cat ? 'bg-gray-800 text-white ring-1 ring-gray-700' : 'text-gray-300 border border-gray-800 hover:bg-gray-900'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

    {/* Main content (existing) */}

  <div className="flex-1 overflow-y-auto" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
        <div className="h-full max-w-[1200px] mx-auto flex flex-col gap-4 p-4" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
          {/* Grid is the primary layout now; legacy split/sidebar removed for a cleaner view */}

          {layoutMode === 'grid' && (
            <main className="w-full bg-gray-50 flex-1" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
              <div ref={gridRef} className="" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                {/* Breaking headline full width (no borders) */}
                {breaking && (
                  <article key={breaking.id} className="w-full mb-3 rounded-none overflow-hidden cursor-pointer bg-transparent" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                    <div className="relative w-full aspect-[3/1]" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                      <ProgressiveImage src={breaking.image_url} alt={breaking.title} className="w-full h-full" />
                    </div>
                    <div className="-mt-16 p-6" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                      <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Times New Roman, serif' }}>{breaking.title}</h2>
                      <div className="text-sm text-gray-700 mt-1">{breaking.source_name || breaking.source} • {readingTime(breaking)}</div>
                    </div>
                  </article>
                )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                  {gridItems.map((a, idx) => (
          <article id={`news-card-${a.id}`} key={a.id} onClick={() => { setSelected(a); setSelectedIndex(idx); setLayoutMode('reader'); }} className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 cursor-pointer" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                      <div className="relative aspect-square sm:aspect-[4/3]" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                        <ProgressiveImage src={a.image_url} alt={a.title} />
                      </div>
                      <div className="p-3" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                        <div className="text-lg font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Times New Roman, serif' }}>{a.title}</div>
                        <div className="text-xs text-gray-600 flex items-center justify-between"><span>{a.source_name || a.source}</span><span>{readingTime(a)}</span></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </main>
          )}

          {layoutMode === 'reader' && (
            <main className="w-full bg-gray-50 flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
              {!selected ? (
                <div className="flex items-center justify-center h-80 text-gray-400" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>No article selected.</div>
              ) : (
                <article className="max-w-4xl mx-auto p-6" style={{backgroundColor: '#f9fafb', background: '#f9fafb'}}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs text-gray-400">{selected.source_name || selected.source}  {new Date(selected.published_at).toLocaleString()}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleBookmark(selected)} className="p-2 rounded hover:bg-gray-900"><Bookmark className="w-4 h-4"/></button>
                      <button onClick={() => shareArticle(selected)} className="p-2 rounded hover:bg-gray-900"><Share2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>{selected.title}</h2>
                  <div className="mb-6">
                    <ProgressiveImage src={selected.image_url} alt={selected.title} />
                  </div>
                  <div className="prose prose-invert text-gray-200 mb-8" style={{ fontFamily: 'Georgia, Times, "Times New Roman", serif' }}>
                    <p>{selected.snippet || selected.summary || selected.content || 'No preview available.'}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={readerPrev} className="px-3 py-1 rounded border border-gray-800 text-sm text-gray-300 hover:bg-gray-900">Previous</button>
                      <button onClick={readerNext} className="px-3 py-1 rounded border border-gray-800 text-sm text-gray-300 hover:bg-gray-900">Next</button>
                    </div>
                    <div>
                      <a href={selected.url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border border-gray-300 text-sm bg-gray-100 text-gray-900">Open source</a>
                    </div>
                  </div>
                </article>
              )}
            </main>
          )}
        </div>
      </div>

      {/* Mobile bottom toolbar */}
  <div className="sm:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-black border border-gray-800 rounded-full px-2 py-1 flex items-center gap-2">
          <button onClick={()=>setLayoutMode('grid')} className={`p-2 rounded ${layoutMode==='grid' ? 'bg-gray-900' : ''}`} aria-label="Grid"><LayoutGrid className="w-5 h-5"/></button>
          <button onClick={()=>setLayoutMode('reader')} className={`p-2 rounded ${layoutMode==='reader' ? 'bg-gray-900' : ''}`} aria-label="Reader"><Maximize2 className="w-5 h-5"/></button>
          <button onClick={()=>setShowBookmarks(true)} className="p-2 rounded" aria-label="Bookmarks"><Bookmark className="w-5 h-5"/></button>
        </div>
      </div>

      {/* Bookmarks modal */}
      {showBookmarks && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={()=>setShowBookmarks(false)} />
          <div ref={bookmarksRef} tabIndex={-1} className="relative w-full sm:max-w-lg bg-black border border-gray-800 rounded-lg p-4 transform transition-all duration-200 scale-100 opacity-100">
            <div tabIndex={0} aria-hidden className="focus-sentinel-start" />
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Bookmarks</div>
              <div className="flex items-center gap-2">
                <button onClick={()=>{ setShowBookmarks(false); }} className="px-3 py-1 rounded border border-gray-800">Close</button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {Object.keys(bookmarks).length === 0 ? (
                <div className="text-gray-400">No bookmarks yet.</div>
              ) : (
                <ul className="space-y-2">
                  {Object.values(bookmarks).map(b => (
                    <li key={b.id} className="flex items-center justify-between gap-2 p-2 border border-gray-800 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">{b.title}</div>
                        <div className="text-xs text-gray-500 truncate">{b.url}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>{ window.open(b.url || '#', '_blank'); }} className="px-2 py-1 rounded border border-gray-800 text-sm">Open</button>
                        <button onClick={()=>removeBookmark(b.id)} className="px-2 py-1 rounded border border-gray-800 text-sm">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div tabIndex={0} aria-hidden className="focus-sentinel-end" />
          </div>
        </div>
      )}
      {/* Article modal viewer (opened from list or grid) */}
      {showModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={()=>setShowModal(false)} />
          <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} className="relative w-full max-w-4xl max-h-[90vh] overflow-auto bg-black border border-gray-800 rounded-lg p-6 transform transition-all duration-200 scale-100 opacity-100">
            <div tabIndex={0} aria-hidden className="focus-sentinel-start" />
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-400">{selected.source_name || selected.source} • {new Date(selected.published_at).toLocaleString()}</div>
                <h2 className="text-2xl font-bold mt-2" style={{ fontFamily: 'Times New Roman, serif' }}>{selected.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>{ toggleBookmark(selected); }} className="p-2 rounded hover:bg-gray-900"><Bookmark className="w-5 h-5"/></button>
                <button onClick={()=>{ shareArticle(selected); }} className="p-2 rounded hover:bg-gray-900"><Share2 className="w-5 h-5"/></button>
                <button onClick={()=>setShowModal(false)} className="px-3 py-1 rounded border border-gray-800">Close</button>
              </div>
            </div>
            <div className="mb-4">
              <div className="w-full h-64 overflow-hidden rounded mb-4"><ProgressiveImage src={selected.image_url} alt={selected.title} /></div>
              <div className="prose prose-invert text-gray-200" style={{ fontFamily: 'Georgia, Times, "Times New Roman", serif' }}>
                <p>{selected.snippet || selected.summary || selected.content || 'No preview available.'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <button onClick={() => { readerPrev(); }} className="px-3 py-1 rounded border border-gray-800 text-sm">Previous</button>
                <button onClick={() => { readerNext(); }} className="px-3 py-1 rounded border border-gray-800 text-sm">Next</button>
              </div>
              <div className="flex items-center gap-2">
                {selected.url && <a href={selected.url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border border-gray-300 text-sm bg-gray-100 text-gray-900">Open source</a>}
              </div>
            </div>
            <div tabIndex={0} aria-hidden className="focus-sentinel-end" />
          </div>
        </div>
      )}
      </div>
    </>
  );
}
