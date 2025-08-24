import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient, createSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient();
    const { data, error } = await supabase.from('media_folders').select('id,name,created_at').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const folders = [] as any[];
    for (const f of data || []) {
      let thumb: string | null = null;
      try {
        const { data: item } = await supabase
          .from('media_folder_items')
          .select('media_url,media_id')
          .eq('user_id', userId)
          .eq('folder_id', f.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        thumb = item?.media_url || null;
        if (!thumb && item?.media_id) {
          const { data: mg } = await supabase.from('media_generations').select('result_url').eq('id', item.media_id).maybeSingle();
          thumb = (mg as any)?.result_url || null;
        }
      } catch {}
      folders.push({ ...f, thumbnail_url: thumb });
    }
    return NextResponse.json({ folders });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const name: string = (body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient();
    const { data, error } = await supabase.from('media_folders').insert({ user_id: userId, name }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 }); }
}


