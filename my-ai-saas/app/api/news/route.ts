import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

// Initialize Supabase client with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to ensure the news_articles table exists
async function ensureTableExists() {
  try {
    // Try to create the table with all necessary columns
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS news_articles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          summary TEXT,
          url TEXT NOT NULL UNIQUE,
          image_url TEXT,
          video_url TEXT,
          youtube_url TEXT,
          category TEXT DEFAULT 'General',
          source TEXT,
          country_code TEXT,
          continent TEXT,
          published_at TIMESTAMPTZ DEFAULT NOW(),
          quality_score INTEGER DEFAULT 0,
          content_hash TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Backfill columns if they don't exist yet
        DO $$ BEGIN
          BEGIN
            ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS country_code TEXT;
          EXCEPTION WHEN others THEN NULL; END;
          BEGIN
            ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS continent TEXT;
          EXCEPTION WHEN others THEN NULL; END;
        END $$;
        
        CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category);
        CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_news_quality ON news_articles(quality_score DESC);
        CREATE INDEX IF NOT EXISTS idx_news_country ON news_articles(country_code);
        CREATE INDEX IF NOT EXISTS idx_news_continent ON news_articles(continent);
      `
    });
    
    if (error) {
      console.log('Table creation via RPC failed, trying direct approach');
      // Fallback: just test if we can query the table
      await supabase.from('news_articles').select('count', { count: 'exact', head: true });
    }
  } catch (error) {
    console.log('Table check/creation failed:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const mediaType = searchParams.get('media');
    const limit = parseInt(searchParams.get('limit') || '100');
  const countryParam = (searchParams.get('country') || '').trim();
  const continentParam = (searchParams.get('continent') || '').trim();
  const country = countryParam ? countryParam.toUpperCase() : '';
  const continent = normalizeContinent(continentParam);

  // Ensure table exists
    await ensureTableExists();

  let query = supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false })  // Most recent first (PRIMARY)
      .order('quality_score', { ascending: false }) // Then by quality
      .limit(limit);

    // Apply filters
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // Region filters
    if (country) {
      query = query.eq('country_code', country);
    } else if (continent) {
      query = query.eq('continent', continent);
    }

    // Filter by media type
    if (mediaType) {
      switch (mediaType) {
        case 'images':
          query = query.not('image_url', 'is', null);
          break;
        case 'videos':
          query = query.not('video_url', 'is', null);
          break;
        case 'youtube':
          query = query.not('youtube_url', 'is', null);
          break;
        case 'multimedia':
          query = query.or('image_url.not.is.null,video_url.not.is.null,youtube_url.not.is.null');
          break;
      }
    }

    // Query DB but do not fail the whole endpoint if DB is missing/misconfigured.
    let articles: any[] = [];
    let dbOk = true;
    try {
      const { data, error } = await query;
      if (error) {
        dbOk = false;
        console.warn('Supabase query error (will use RSS fallback):', error.message);
      } else {
        articles = data || [];
      }
    } catch (e) {
      dbOk = false;
      console.warn('Supabase query threw (will use RSS fallback):', (e as Error).message);
    }

  // If no fresh articles found, fall back to direct RSS so page is never empty
    let fallbackArticles: any[] = [];
    if (!articles || articles.length === 0) {
      try {
        const parser = new Parser();
        const feeds = getFeedsForRegion(country, continent);
        const results: any[] = [];
        for (const url of feeds) {
          const feed = await parser.parseURL(url);
          for (const entry of (feed.items || []).slice(0, 10)) {
            const image = extractImageFromEntry(entry);
            results.push({
              id: entry.id || entry.link || Math.random().toString(36).slice(2),
              title: entry.title || 'Untitled',
              snippet: (entry.contentSnippet || entry.content || '').slice(0, 300),
              summary: (entry.contentSnippet || entry.content || '').slice(0, 300),
              url: entry.link,
              image_url: image,
              video_url: null,
              youtube_url: null,
              category: 'General',
              source: feed.title || 'RSS',
              published_at: entry.isoDate || new Date().toISOString(),
              quality_score: 1
            });
            if (results.length >= 50) break;
          }
          if (results.length >= 50) break;
        }
        fallbackArticles = results;

        // Best-effort: persist fallback items into Supabase so DB remains the source of truth
        if (fallbackArticles.length) {
          try {
            const upsertPayload = fallbackArticles.map((a) => ({
              title: a.title,
              summary: a.summary,
              url: a.url,
              image_url: a.image_url,
              video_url: a.video_url,
              youtube_url: a.youtube_url,
              category: a.category,
              source: a.source,
              country_code: country || null,
              continent: continent || (country ? inferContinent(country) : null),
              published_at: a.published_at,
              quality_score: a.quality_score,
              content_hash: null
            }));
            await supabase
              .from('news_articles')
              .upsert(upsertPayload, { onConflict: 'url', ignoreDuplicates: true });
          } catch (uErr) {
            console.warn('Supabase upsert of fallback articles failed:', (uErr as Error).message);
          }
        }
      } catch (e) {
        console.warn('RSS fallback failed:', (e as Error).message);
      }
    }

  // Get total count
  let count: number | null = null;
    if (dbOk) {
      try {
        const res = await supabase
          .from('news_articles')
          .select('*', { count: 'exact', head: true });
        // @ts-ignore - supabase-js returns count on response object
        count = res.count ?? null;
      } catch (e) {
        console.warn('Supabase count failed:', (e as Error).message);
      }
    }

    // Get category statistics
    let categories: any[] | null = null;
    if (dbOk) {
      try {
        const res = await supabase
          .from('news_articles')
          .select('category');
        categories = res.data as any[] | null;
      } catch (e) {
        console.warn('Supabase categories failed:', (e as Error).message);
      }
    }

    // Process categories
  const categoryStats = (categories || [])?.reduce((acc: any[], article: any) => {
      const existing = acc.find(c => c.category === article.category);
      if (existing) {
        existing.article_count++;
      } else {
        acc.push({
          category: article.category,
          article_count: 1
        });
      }
      return acc;
  }, []) || [];

    // Determine staleness window (10 minutes) and auto-trigger scraper in background
    if (dbOk) {
      try {
        const latestRes = await supabase
          .from('news_articles')
          .select('updated_at, published_at')
          .order('updated_at', { ascending: false })
          .limit(1);
        const latest = latestRes.data && latestRes.data[0];
        const latestIso = latest?.updated_at || latest?.published_at;
        const latestTs = latestIso ? new Date(latestIso).getTime() : 0;
        const tenMinutes = 10 * 60 * 1000;
        const isStale = !latestTs || (Date.now() - latestTs) > tenMinutes;
        if (isStale) {
          // Fire-and-forget: let the scraper refresh data for everyone; don't block response
          fetch('/api/news/trigger', { cache: 'no-store' }).catch(() => {});
        }
      } catch (e) {
        console.warn('Staleness check failed:', (e as Error).message);
      }
    }

    const response = NextResponse.json({
      success: true,
      data: {
  articles: (articles && articles.length > 0) ? articles : fallbackArticles,
  total: (articles && articles.length > 0) ? (count ?? articles.length) : fallbackArticles.length,
        categories: categoryStats,
        filters: {
          category,
          search,
          mediaType,
          limit,
          country,
          continent
        },
        metadata: {
          total_articles: (articles && articles.length > 0) ? (count || 0) : fallbackArticles.length,
          with_images: (articles && articles.length > 0)
            ? (articles?.filter((a: any) => a.image_url).length || 0)
            : 0,
          with_videos: (articles && articles.length > 0)
            ? (articles?.filter((a: any) => a.video_url).length || 0)
            : 0,
          with_youtube: (articles && articles.length > 0)
            ? (articles?.filter((a: any) => a.youtube_url).length || 0)
            : 0,
          last_updated: new Date().toISOString()
        }
      }
    });

    // Shared cache semantics: allow CDN-level caching for 10 minutes
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=300');
    return response;

  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch news articles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helpers
function normalizeContinent(s: string | null | undefined): string {
  if (!s) return '';
  const raw = s.toString().trim().toLowerCase().replace(/_/g, '-');
  const map: Record<string, string> = {
    'africa': 'Africa',
    'asia': 'Asia',
    'europe': 'Europe',
    'north-america': 'North America',
    'south-america': 'South America',
    'oceania': 'Oceania',
    'australia': 'Oceania',
    'middle-east': 'Middle East',
    'middle east': 'Middle East'
  };
  if (map[raw]) return map[raw];
  // handle abbreviations
  if (['na', 'n. america'].includes(raw)) return 'North America';
  if (['sa', 's. america', 'latam', 'latin-america', 'latin america'].includes(raw)) return 'South America';
  if (['mea', 'middleeast'].includes(raw)) return 'Middle East';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function inferContinent(countryCode: string): string | null {
  const cc = countryCode.toUpperCase();
  const map: Record<string, string> = {
    US: 'North America', CA: 'North America', MX: 'North America',
    BR: 'South America', AR: 'South America', CL: 'South America', CO: 'South America', PE: 'South America',
    GB: 'Europe', IE: 'Europe', FR: 'Europe', DE: 'Europe', ES: 'Europe', IT: 'Europe', NL: 'Europe', SE: 'Europe', NO: 'Europe', FI: 'Europe', PL: 'Europe', PT: 'Europe', GR: 'Europe', RO: 'Europe', CZ: 'Europe', UA: 'Europe', RU: 'Europe', CH: 'Europe', AT: 'Europe', BE: 'Europe', DK: 'Europe', HU: 'Europe',
    CN: 'Asia', JP: 'Asia', KR: 'Asia', IN: 'Asia', SG: 'Asia', HK: 'Asia', MY: 'Asia', TH: 'Asia', VN: 'Asia', PH: 'Asia', ID: 'Asia', LK: 'Asia', BD: 'Asia', PK: 'Asia',
    AU: 'Oceania', NZ: 'Oceania',
    ZA: 'Africa', NG: 'Africa', KE: 'Africa', EG: 'Africa', MA: 'Africa', GH: 'Africa', ET: 'Africa', DZ: 'Africa', TN: 'Africa', CI: 'Africa', UG: 'Africa', TZ: 'Africa',
    AE: 'Middle East', SA: 'Middle East', IL: 'Middle East', IQ: 'Middle East', IR: 'Middle East', QA: 'Middle East', KW: 'Middle East', JO: 'Middle East', LB: 'Middle East', TR: 'Middle East'
  };
  return map[cc] || null;
}

function getFeedsForRegion(countryCode: string, continent?: string): string[] {
  const cc = (countryCode || '').toUpperCase();
  const cont = continent || (cc ? inferContinent(cc) || undefined : undefined);

  // Country-specific feeds (sample selection)
  const byCountry: Record<string, string[]> = {
    US: [
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'http://feeds.washingtonpost.com/rss/world',
      'http://rss.cnn.com/rss/cnn_world.rss',
      'https://apnews.com/hub/apf-intlnews?output=rss',
      'https://www.npr.org/rss/rss.php?id=1004',
      'https://feeds.reuters.com/reuters/worldNews',
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
      'https://www.theguardian.com/us-news/rss',
      'https://www.latimes.com/world/rss2.0.xml',
      'https://www.wsj.com/xml/rss/3_7085.xml'
    ],
    GB: [
      'http://feeds.bbci.co.uk/news/world/rss.xml',
      'https://www.theguardian.com/world/rss',
      'https://www.telegraph.co.uk/news/rss.xml',
      'https://www.independent.co.uk/news/uk/rss',
      'https://www.standard.co.uk/news/uk/rss',
      'https://news.sky.com/feeds/rss/home.xml',
      'https://www.ft.com/rss/home',
      'https://www.dailymail.co.uk/news/index.rss',
      'https://www.reuters.com/places/uk/uk-news/rss',
      'https://www.theguardian.com/uk/rss'
    ],
    IN: [
      'https://www.thehindu.com/news/international/feeder/default.rss',
      'https://feeds.feedburner.com/ndtvnews-world-news',
      'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
      'https://indianexpress.com/section/world/feed/',
      'https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml',
      'https://www.livemint.com/rss/world',
      'https://www.bbc.com/news/world/asia/india/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml'
    ],
    AU: [
      'https://www.abc.net.au/news/feed/45910/rss.xml',
      'https://www.smh.com.au/rss/feed.xml',
      'https://www.theaustralian.com.au/feed/',
      'https://www.theguardian.com/australia-news/rss',
      'https://www.news.com.au/content-feeds/latest-news-world/',
      'https://www.nzherald.co.nz/rss/',
      'https://www.rnz.co.nz/rss',
      'https://www.sbs.com.au/news/section/world/feed'
    ],
    JP: [
      'https://www.japantimes.co.jp/rss/introductory/feed/',
      'https://english.kyodonews.net/rss/news',
      'https://www3.nhk.or.jp/nhkworld/en/news/rss/',
      'https://www.nikkei.com/rss/ENGLISH.xml'
    ],
  };

  // Continent feeds (10-ish each)
  const byContinent: Record<string, string[]> = {
    'North America': [
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'http://rss.cnn.com/rss/cnn_world.rss',
      'https://apnews.com/hub/apf-intlnews?output=rss',
      'https://www.washingtonpost.com/world/?outputType=rss',
      'https://www.latimes.com/world/rss2.0.xml',
      'https://www.cbc.ca/cmlink/rss-world',
      'https://globalnews.ca/feed/',
      'https://www.theglobeandmail.com/world/rss/',
      'https://www.reuters.com/world/americas/rss',
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
    ],
    Europe: [
      'http://feeds.bbci.co.uk/news/world/europe/rss.xml',
      'https://www.dw.com/en/top-stories/europe/s-4536?maca=en-rss-en-eu-2091-rdf',
      'https://www.euronews.com/rss?level=theme&name=news',
      'https://www.theguardian.com/world/europe/rss',
      'https://apnews.com/hub/europe?output=rss',
      'https://www.politico.eu/feed/',
      'https://www.ft.com/rss/world/europe',
      'https://www.reuters.com/places/europe/rss',
      'https://www.independent.co.uk/news/world/europe/rss',
      'https://www.aljazeera.com/xml/rss/all.xml'
    ],
    Asia: [
      'https://www.scmp.com/rss/91/feed',
      'https://www.thehindu.com/news/international/feeder/default.rss',
      'https://www.japantimes.co.jp/rss/introductory/feed/',
      'https://www.straitstimes.com/news/world/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.nhk.or.jp/rss/news/cat0.xml',
      'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
      'https://www.koreatimes.co.kr/www/rss/nation.xml',
      'https://www.nikkei.com/rss/ENGLISH.xml',
      'https://www.reuters.com/places/asia/rss'
    ],
    Africa: [
      'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
      'https://www.bbc.com/news/world/africa/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.reuters.com/places/africa/rss',
      'https://www.dw.com/en/top-stories/africa/s-12756?maca=en-rss-en-africa-3496-rdf',
      'https://www.france24.com/en/africa/rss',
      'https://www.voanews.com/rss',
      'https://www.theguardian.com/world/africa/rss',
      'https://apnews.com/hub/africa?output=rss',
      'https://news.google.com/rss/search?q=site:allafrica.com+OR+site:bbc.co.uk+africa&hl=en-US&gl=US&ceid=US:en'
    ],
    'South America': [
      'https://apnews.com/hub/latin-america?output=rss',
      'https://www.reuters.com/places/latin-america/rss',
      'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
      'https://www.bbc.com/mundo/topics/c2dwq9v67pjt/index.xml',
      'https://www.buenosairesherald.com/feed',
      'https://www.theguardian.com/world/americas/rss',
      'https://www.latimes.com/world-nation/rss2.0.xml',
      'https://www.bbc.co.uk/news/world/latin_america/rss.xml',
      'https://news.google.com/rss/search?q=latin+america&hl=en-US&gl=US&ceid=US:en'
    ],
    Oceania: [
      'https://www.abc.net.au/news/feed/45910/rss.xml',
      'https://www.nzherald.co.nz/rss/',
      'https://www.smh.com.au/rss/feed.xml',
      'https://www.theguardian.com/world/oceania/rss',
      'https://www.rnz.co.nz/rss',
      'https://www.news.com.au/content-feeds/latest-news-world/',
      'https://apnews.com/hub/asia-pacific?output=rss',
      'https://www.reuters.com/world/asia-pacific/rss',
      'https://www.sbs.com.au/news/section/world/feed',
      'https://www.ft.com/rss/world/asia-pacific'
    ],
    'Middle East': [
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.reuters.com/places/middle-east/rss',
      'https://apnews.com/hub/middle-east?output=rss',
      'https://www.haaretz.com/cmlink/1.976594',
      'https://www.thenationalnews.com/rss/top-stories/',
      'https://www.bbc.com/news/world/middle_east/rss.xml',
      'https://www.alarabiya.net/.mrss/en.xml',
      'https://www.middleeasteye.net/rss'
    ]
  };

  if (cc && byCountry[cc]) return byCountry[cc];
  if (cont && byContinent[cont]) return byContinent[cont];

  // Default world mix
  return [
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://feeds.reuters.com/reuters/worldNews',
    'https://www.theguardian.com/world/rss',
    'https://apnews.com/hub/apf-intlnews?output=rss'
  ];
}

function extractImageFromEntry(entry: any): string | null {
  try {
    // 1) enclosure with image
    if (entry.enclosure && typeof entry.enclosure.url === 'string') {
      const t = (entry.enclosure.type || '').toLowerCase();
      if (!t || t.includes('image')) return entry.enclosure.url;
    }
    // 2) content HTML <img src="...">
    const html = (entry['content:encoded'] || entry.content || '') as string;
    if (html) {
      const m = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
      if (m && m[1]) return m[1];
    }
    // 3) media:thumbnail or media:content (if present in parsed object)
    const media = (entry as any).media || (entry as any)['media:content'] || (entry as any)['media:thumbnail'];
    if (media) {
      const url = (media.url || media[0]?.url || media[0]?.$?.url);
      if (typeof url === 'string') return url;
    }
  } catch {}
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articles } = body;

    if (!Array.isArray(articles)) {
      return NextResponse.json({
        success: false,
        error: 'Articles must be an array'
      }, { status: 400 });
    }

    // Ensure table exists before inserting
    await ensureTableExists();

    // Insert articles into Supabase with upsert to handle duplicates
    const { data, error } = await supabase
      .from('news_articles')
      .upsert(articles, { 
        onConflict: 'url',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        inserted: data?.length || 0,
        articles: data
      }
    });

  } catch (error) {
    console.error('News POST API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to insert news articles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
