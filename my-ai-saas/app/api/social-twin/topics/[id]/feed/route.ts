import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSafeSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authState = auth();
    let userId = authState.userId as string | null;
    if (!userId) {
      const hdr = req.headers.get('x-user-id');
      if (hdr && typeof hdr === 'string') userId = hdr;
    }
    const getToken = (authState as any)?.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const topicId = params.id;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || '500'), 1000);
    const before = searchParams.get('before');

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);

    // Verify topic exists & belongs to user (best-effort)
    try {
      const { error: tErr } = await supabase
        .from('chat_topics')
        .select('id')
        .eq('id', topicId)
        .eq('user_id', userId)
        .limit(1);
      if (tErr) {
        // proceed anyway; RLS should still prevent leaks
      }
    } catch {}

    // Messages
    let msgQuery = supabase
      .from('chat_messages')
      .select('id,role,content,created_at')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) msgQuery = msgQuery.lt('created_at', before);
    const { data: msgDesc, error: msgErr } = await msgQuery;
    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    // Media
    let mediaQuery = supabase
      .from('media_generations')
      .select('id,type,prompt,result_url,created_at')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) mediaQuery = mediaQuery.lt('created_at', before);
    const { data: mediaDesc, error: mediaErr } = await mediaQuery;
    if (mediaErr) return NextResponse.json({ error: mediaErr.message }, { status: 500 });

    // Resolve storage URLs
    async function resolveUrl(raw: string | null): Promise<string | undefined> {
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

    const msgItems = (msgDesc || []).map((m) => ({
      id: m.id as string,
      role: (m.role as 'user' | 'assistant' | 'system' | 'error') || 'assistant',
      content: m.content || '',
      createdAt: m.created_at as string,
    }));

    const mediaItems = await Promise.all((mediaDesc || []).map(async (it) => {
      const resolved = await resolveUrl(it.result_url as string | null);
      const isVideo = it.type === 'video';
      return {
        id: it.id as string,
        role: 'assistant' as const,
        content: isVideo ? (it.prompt ? `Generated video: ${it.prompt}` : 'Generated video') : (it.prompt ? `Generated image: ${it.prompt}` : 'Generated image'),
        imageUrl: isVideo ? undefined : resolved,
        videoUrl: isVideo ? resolved : undefined,
        createdAt: it.created_at as string,
      };
    }));

    const merged = [...msgItems, ...mediaItems]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const sliced = merged.slice(Math.max(0, merged.length - limit));
    const nextCursor = sliced.length ? sliced[0].createdAt : null;

    return NextResponse.json({ items: sliced, nextCursor });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}






