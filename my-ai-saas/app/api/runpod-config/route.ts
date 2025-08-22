import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

function checkToken(req: NextRequest): boolean {
  const token = req.headers.get('x-config-token') || req.headers.get('x-admin-token');
  const expected = process.env.RUNPOD_CONFIG_TOKEN;
  return Boolean(expected && token && token === expected);
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('runpod_config').select('*').eq('scope', 'global').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, config: data || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const updates: any = {};
    for (const k of ['image_url', 'image_modify_url', 'text_url', 'video_url']) {
      if (typeof body[k] === 'string') updates[k] = body[k];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('runpod_config')
      .upsert({ scope: 'global', ...updates }, { onConflict: 'scope' })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, config: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update config' }, { status: 500 });
  }
}
