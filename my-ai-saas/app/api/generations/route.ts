export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { userId, getToken } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const jwt = await getToken({ template: 'supabase' });
    if (!jwt) return NextResponse.json({ error: 'No Supabase token' }, { status: 401 });

    const supabase = createSupabaseClient(jwt);
    const q = req.nextUrl.searchParams;
    const limit = Number(q.get('limit') || 50);
    const page = Number(q.get('page') || 0);

    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const jwt = await getToken({ template: 'supabase' });
    if (!jwt) return NextResponse.json({ error: 'No Supabase token' }, { status: 401 });

    const body = await req.json();
    const { type, prompt, result_url, content, metadata } = body || {};
    if (!type || !['text', 'image', 'video'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    const supabase = createSupabaseClient(jwt);
    const { data, error } = await supabase
      .from('generations')
      .insert([{ user_id: userId, type, prompt: prompt || null, result_url: result_url || null, content: content || null, metadata: metadata || null }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
