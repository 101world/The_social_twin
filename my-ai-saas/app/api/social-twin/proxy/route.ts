import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) return new NextResponse('Missing url', { status: 400 });
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' } });
    if (!r.ok) return new NextResponse('Upstream error', { status: r.status });
    const contentType = r.headers.get('content-type') || 'application/octet-stream';
    const body = await r.arrayBuffer();
    return new NextResponse(body, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    return new NextResponse('Proxy error', { status: 500 });
  }
}






