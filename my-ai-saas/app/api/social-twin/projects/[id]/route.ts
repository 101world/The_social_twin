import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSafeSupabaseClient } from '@/lib/supabase';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
  const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
  const params = (typeof (ctx as any).params?.then === 'function') ? await (ctx as any).params : (ctx as any).params;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);
    const { data, error } = await supabase
      .from('projects')
      .select('id,title,data,thumbnail_url,created_at,updated_at')
      .eq('id', params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Resolve any storage references in saved item URLs for convenience (best-effort)
    try {
      if (data?.data && typeof data.data === 'object' && Array.isArray((data as any).data.items)) {
        const items = (data as any).data.items as any[];
        for (const it of items) {
          if (typeof it?.url === 'string' && it.url.startsWith('storage:')) {
            const parts = it.url.replace('storage:', '').split('/');
            const bucket = parts.shift() as string;
            const path = parts.join('/');
            const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
            if (!signed.error) it.url = signed.data.signedUrl;
          }
        }
      }
    } catch {}
    return NextResponse.json({ project: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}


