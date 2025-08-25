export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSafeSupabaseClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const authState = await auth();
    const userId = authState.userId || null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const genId = body?.id;
    if (!genId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const token = await authState.getToken({ template: 'supabase' }).catch(()=>null) as string | undefined;
  const supabase = createSafeSupabaseClient(token);

    // Fetch generation row
    const { data: rows, error } = await supabase.from('media_generations').select('*').eq('id', genId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (rows.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // If already saved (result_url storage path exists), return
    if (typeof rows.result_url === 'string' && rows.result_url.startsWith('storage:')) {
      return NextResponse.json({ ok: true, message: 'Already saved', result_url: rows.result_url });
    }

    // Determine source URLs from generation_params.result_urls or rows.result_url
    const params = rows.generation_params || {};
    const sourceUrls = Array.isArray(params.result_urls) && params.result_urls.length ? params.result_urls : (Array.isArray(rows.urls) && rows.urls.length ? rows.urls : (rows.result_url ? [rows.result_url] : []));
    if (!sourceUrls.length) return NextResponse.json({ error: 'No source URLs available to save' }, { status: 400 });

    const bucket = rows.type === 'video' ? 'generated-videos' : 'generated-images';
    try { await (supabase as any).storage.createBucket(bucket, { public: false }).catch(()=>{}); } catch {}
    const delivered: string[] = [];
    for (const src of sourceUrls) {
      try {
        let contentType = 'application/octet-stream';
        let data: Uint8Array | null = null;
        if (typeof src === 'string' && src.startsWith('data:')) {
          const m = /data:(.*?);base64,(.*)$/i.exec(src as string);
          if (m) { contentType = m[1] || contentType; data = Buffer.from(m[2], 'base64'); }
        } else {
          const resp = await fetch(src as string);
          contentType = resp.headers.get('content-type') || contentType;
          data = new Uint8Array(await resp.arrayBuffer());
        }
        if (!data) continue;
        const ext = contentType.startsWith('image/') ? '.png' : contentType.startsWith('video/') ? '.mp4' : '';
        const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const path = `${userId}/${fileName}`;
        const up = await (supabase as any).storage.from(bucket).upload(path, data, { contentType, upsert: false });
        if (!up.error) delivered.push(`storage:${bucket}/${path}`);
      } catch (e) { console.warn('Save-to-library upload failed', e); }
    }

    if (!delivered.length) return NextResponse.json({ error: 'Failed to save media' }, { status: 500 });

    // Update generation row to point to storage path and mark saved
    const updates: any = { result_url: delivered[0], thumbnail_url: delivered[0], generation_params: { ...(params || {}), saved_to_library: true } };
    await supabase.from('media_generations').update(updates).eq('id', genId);

    return NextResponse.json({ ok: true, result_url: delivered[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
