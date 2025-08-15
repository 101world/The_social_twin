import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

type FeedItem = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: string;
};

export async function GET(req: NextRequest) {
  try {
    const authState = auth();
    let userId = authState.userId as string | null;
    if (!userId) {
      const hdr = req.headers.get('x-user-id');
      if (hdr && typeof hdr === 'string') userId = hdr;
    }
    const getToken = (authState as any)?.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || '200'), 500);
    const before = searchParams.get('before'); // ISO string; only return items strictly older than this
    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient(jwt || undefined);

    // Fetch recent chat messages (descending for efficiency)
    let msgQuery = supabase
      .from('chat_messages')
      .select('id,role,content,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) {
      msgQuery = msgQuery.lt('created_at', before);
    }
    const { data: msgDesc, error: msgErr } = await msgQuery;
    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    // Fetch recent media generations (descending)
    let mediaQuery = supabase
      .from('media_generations')
      .select('id,type,prompt,result_url,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) {
      mediaQuery = mediaQuery.lt('created_at', before);
    }
    const { data: mediaDesc, error: mediaErr } = await mediaQuery;
    if (mediaErr) return NextResponse.json({ error: mediaErr.message }, { status: 500 });

    // Create signed URLs for storage-backed media
    async function resolveMediaUrl(raw: string | null): Promise<string | undefined> {
      if (!raw) return undefined;
      if (!raw.startsWith('storage:')) return raw || undefined;
      try {
        const parts = raw.replace('storage:', '').split('/');
        const bucket = parts.shift() as string;
        const path = parts.join('/');
        const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
        if (!signed.error) return signed.data.signedUrl;
      } catch {}
      return undefined;
    }

    // Map to unified feed items
    const msgItems: FeedItem[] = (msgDesc || []).map((m) => ({
      id: m.id,
      role: (m.role as FeedItem['role']) || 'assistant',
      content: m.content || '',
      createdAt: m.created_at as string,
    }));

    const mediaItems: FeedItem[] = await Promise.all((mediaDesc || []).map(async (it) => {
      const isVideo = it.type === 'video';
      const resolved = await resolveMediaUrl(it.result_url as string | null);
      return {
        id: it.id,
        role: 'assistant',
        content: isVideo ? (it.prompt ? `Generated video: ${it.prompt}` : 'Generated video') : (it.prompt ? `Generated image: ${it.prompt}` : 'Generated image'),
        imageUrl: isVideo ? undefined : resolved,
        videoUrl: isVideo ? resolved : undefined,
        createdAt: it.created_at as string,
      } as FeedItem;
    }));

    // Merge, sort ascending by time, and cap to limit
    const merged = [...msgItems, ...mediaItems]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const sliced = merged.slice(Math.max(0, merged.length - limit));
    const nextCursor = sliced.length ? sliced[0].createdAt : null; // earliest timestamp for loading older

    return NextResponse.json({ items: sliced, nextCursor });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}


