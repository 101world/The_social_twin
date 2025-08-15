import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient, createSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { folderId: string } }) {
  try {
    const a = auth();
    let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const folderId = params.folderId;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient();
    const { data, error } = await supabase
      .from('media_folder_items')
      .select('id,media_id,media_url,type,prompt,created_at')
      .eq('user_id', userId)
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Map result_url if media_id provided and media_url is null
    const items = [] as any[];
    for (const it of data || []) {
      let url = it.media_url as string | null;
      if (!url && it.media_id) {
        try {
          const { data: mg } = await supabase
            .from('media_generations')
            .select('result_url')
            .eq('id', it.media_id)
            .maybeSingle();
          url = (mg as any)?.result_url || null;
        } catch {}
      }
      items.push({ ...it, url });
    }
    return NextResponse.json({ items });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: { folderId: string } }) {
  try {
    const a = auth();
    let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const folderId = params.folderId;
    const body = await req.json();
    const item = {
      user_id: userId,
      folder_id: folderId,
      media_id: body?.media_id || null,
      media_url: body?.media_url || null,
      type: body?.type || null,
      prompt: body?.prompt || null,
    } as any;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient();
    const { error } = await supabase.from('media_folder_items').insert(item);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 }); }
}


