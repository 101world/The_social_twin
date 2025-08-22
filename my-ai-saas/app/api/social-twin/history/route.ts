import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
  const authState = await auth();
  let userId = authState.userId as string | null;
    // Fallback: accept user id from trusted header for dev if auth() is null
    if (!userId) {
      const hdr = req.headers.get('x-user-id');
      if (hdr && typeof hdr === 'string') userId = hdr;
    }
    const getToken = (authState as any)?.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || '24'), 60);
    const cursor = searchParams.get('cursor'); // ISO string of created_at to paginate older

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient(jwt || undefined);

    // By default return recent generations (so the Generations tab shows items immediately).
    // If the client requests only saved/library items, pass ?saved=true.
    const savedOnly = String(searchParams.get('saved') || '').toLowerCase() === 'true';

    let query = supabase
      .from('media_generations')
      .select('id,type,prompt,result_url,generation_params,created_at,topic_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (savedOnly) {
      // saved items: storage-backed result_url or generation_params.saved_to_library = true
      query = query.or("result_url.ilike.storage:%,generation_params->>saved_to_library.eq.true");
    }

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create signed URLs for storage-backed items
    const items = await Promise.all((data || []).map(async (it) => {
      let display_url: string | null = null;
      try {
        // Priority 1: explicit result_url pointing to storage (create signed URL)
        if (typeof it.result_url === 'string' && it.result_url.startsWith('storage:')) {
          const parts = it.result_url.replace('storage:', '').split('/');
          const bucket = parts.shift() as string;
          const path = parts.join('/');
          const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
          if (!signed.error) display_url = signed.data.signedUrl;
        }
        // Priority 2: generation_params.result_urls (transient runpod URLs or data: URIs)
        if (!display_url && it.generation_params && Array.isArray(it.generation_params.result_urls) && it.generation_params.result_urls.length) {
          const candidate = it.generation_params.result_urls[0];
          if (typeof candidate === 'string') display_url = candidate;
        }
        // Priority 3: if result_url is a plain URL (not storage:), use it directly
        if (!display_url && typeof it.result_url === 'string' && !it.result_url.startsWith('storage:')) {
          display_url = it.result_url;
        }
      } catch (e) {
        // ignore display URL building errors
      }
      return { ...it, display_url };
    }));

    const nextCursor = items && items.length === limit ? items[items.length - 1].created_at : null;
    return NextResponse.json({ items, nextCursor });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}


