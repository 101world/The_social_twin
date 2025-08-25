import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSafeSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
  const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const title: string = body?.title || 'Untitled Project';
    const data = body?.data ?? {};
    const thumbnailUrl: string | undefined = body?.thumbnailUrl;

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);
    const { data: row, error } = await supabase.from('projects').insert({ user_id: userId, title, data, thumbnail_url: thumbnailUrl }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: row?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
  const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);
    const { data, error } = await supabase.from('projects').select('id,title,thumbnail_url,created_at,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // If no thumbnail, try infer from latest folder item with the same title (fallback heuristic)
    const projects = [] as any[];
    for (const p of data || []) {
      if (p.thumbnail_url) {
        // Resolve storage: URLs to signed URLs for frontend
        if (typeof p.thumbnail_url === 'string' && p.thumbnail_url.startsWith('storage:')) {
          try {
            const parts = p.thumbnail_url.replace('storage:', '').split('/');
            const bucket = parts.shift() as string;
            const path = parts.join('/');
            const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
            if (!signed.error) {
              projects.push({ ...p, thumbnail_url: signed.data.signedUrl });
              continue;
            }
          } catch {}
        }
        projects.push(p);
        continue;
      }
      try {
        const { data: f } = await supabase.from('media_folders').select('id').eq('user_id', userId).eq('name', p.title).maybeSingle();
        if (f?.id) {
          const { data: it } = await supabase.from('media_folder_items').select('media_url,media_id').eq('user_id', userId).eq('folder_id', f.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
          let thumb = it?.media_url || null;
          if (!thumb && it?.media_id) {
            const { data: mg } = await supabase.from('media_generations').select('result_url').eq('id', it.media_id).maybeSingle();
            thumb = (mg as any)?.result_url || null;
          }
          projects.push({ ...p, thumbnail_url: thumb });
          continue;
        }
      } catch {}
      projects.push(p);
    }
    return NextResponse.json({ projects });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id: string = body?.id;
    const data = body?.data;
    const title: string | undefined = body?.title;
    const thumbnailUrl: string | undefined = body?.thumbnailUrl;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createSafeSupabaseClient();
    const { error } = await supabase.from('projects').update({
      ...(title ? { title } : {}),
      ...(data ? { data } : {}),
      ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('user_id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}


