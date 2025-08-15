import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const url = String(body?.url ?? process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL ?? '');
    const payload = body?.payload ?? {};
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    const key = process.env.RUNPOD_API_KEY;
    const res = await fetch(url.replace(/\/$/, '') + '/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(key ? { 'x-api-key': key } : {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: unknown = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    return NextResponse.json({ status: res.status, data });
  } catch (err) {
    console.error('runpod dev POST error', err);
    return NextResponse.json({ error: (err as Error).message ?? 'error' }, { status: 500 });
  }
}





