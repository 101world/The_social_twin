import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// Simple allow-list to reduce SSRF risk; adjust as needed
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const w = parseInt(searchParams.get('w') || '0', 10) || undefined;
    const h = parseInt(searchParams.get('h') || '0', 10) || undefined;
    const q = Math.min(Math.max(parseInt(searchParams.get('q') || '75', 10) || 75, 30), 95);
    const fitParam = (searchParams.get('fit') || 'cover') as keyof sharp.FitEnum;

    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return NextResponse.json({ error: 'Protocol not allowed' }, { status: 400 });
    }

    const upstream = await fetch(parsed.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream fetch failed' }, { status: upstream.status });
    }
    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // Content negotiation: prefer AVIF, then WebP; fallback JPEG/PNG
    const accept = req.headers.get('accept') || '';
    const prefersAvif = accept.includes('image/avif');
    const prefersWebp = accept.includes('image/webp');

  const img = sharp(buf);
    if (w || h) img.resize({ width: w, height: h, fit: fitParam, withoutEnlargement: true });

    try {
      if (prefersAvif) {
  const out = await img.avif({ quality: q }).toBuffer();
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: 'image/avif' });
    return new Response(blob, {
          status: 200,
          headers: {
      'Content-Type': 'image/avif',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
          }
        });
      }
      if (prefersWebp) {
  const out = await img.webp({ quality: q }).toBuffer();
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: 'image/webp' });
    return new Response(blob, {
          status: 200,
          headers: {
      'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
          }
        });
      }
      // Fallback: keep original format best-effort
      const meta = await img.metadata();
  const out = await img.toBuffer();
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  const ct = meta.format ? `image/${meta.format}` : 'application/octet-stream';
  const blob = new Blob([ab], { type: ct });
  return new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
        }
      });
    } catch (e) {
      // If transform fails, return original bytes
    const blob = new Blob([buf], { type: upstream.headers.get('content-type') || 'application/octet-stream' });
    return new Response(blob, {
        status: 200,
        headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
        }
      });
    }
  } catch (err) {
    console.error('optimize-image error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
