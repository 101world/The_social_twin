import { NextRequest, NextResponse } from 'next/server';

// Proxy to the existing scraper endpoints to make manual testing easy
export async function GET(req: NextRequest) {
  try {
    // Prefer the dedicated scraper route if present
    const endpoints = [
      '/api/news/scrape',
      '/api/cron/scrape-news?manual=true'
    ];
    const results: any[] = [];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { cache: 'no-store' });
        const json = await res.json().catch(() => ({ success: false, error: 'invalid json' }));
        results.push({ endpoint: ep, status: res.status, ok: res.ok, body: json });
        if (res.ok && json?.success) {
          return NextResponse.json({
            success: true,
            triggered: ep,
            result: json
          });
        }
      } catch (e) {
        results.push({ endpoint: ep, error: (e as Error).message });
      }
    }
    return NextResponse.json({ success: false, error: 'No scraper endpoint succeeded', attempts: results }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
