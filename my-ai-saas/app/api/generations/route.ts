export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const a = await auth();
    const userId = a.userId as string | null;
    const getToken = a.getToken;
    let jwt: string | null = null;
    try { jwt = getToken ? await getToken({ template: 'supabase' }) : null; } catch {}
    // Dev fallback without auth or admin key
    if (process.env.NODE_ENV !== 'production' && !userId && !jwt && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ items: [] });
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = jwt ? createSupabaseClient(jwt) : createSupabaseAdminClient();
    const q = req.nextUrl.searchParams;
    const limit = Number(q.get('limit') || '50');
    const page = Number(q.get('page') || '0');

    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    console.error('GET /api/generations error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const a = await auth();
    const userId = a.userId as string | null;
    const getToken = a.getToken;
    let jwt: string | null = null;
    try { jwt = getToken ? await getToken({ template: 'supabase' }) : null; } catch {}
    // Dev fallback: accept writes but no-op locally when not authenticated and no admin key
    if (process.env.NODE_ENV !== 'production' && !userId && !jwt && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const body = (await req.json().catch(() => ({}))) as any;
      return NextResponse.json({ item: { id: 'dev', user_id: 'dev', created_at: new Date().toISOString(), ...body } });
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
    const body = (await req.json()) as Record<string, unknown>;
    const type = String(body.type || '');
    const prompt = body.prompt ? String(body.prompt) : null;
    const result_url = body.result_url ? String(body.result_url) : null;
    const content = body.content ? String(body.content) : null;
    const metadata = body.metadata ?? null;

    if (!type || !['text', 'image', 'video'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const supabase = jwt ? createSupabaseClient(jwt) : createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('generations')
      .insert([
        { user_id: userId, type, prompt, result_url, content, metadata },
      ])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('POST /api/generations error', err);
    return NextResponse.json({ error: (err as Error).message || 'Internal server error' }, { status: 500 });
  }
}
