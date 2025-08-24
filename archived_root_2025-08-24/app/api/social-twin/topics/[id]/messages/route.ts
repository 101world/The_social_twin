import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient, createSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const a = auth();
    let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const topicId = params.id;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id,role,content,created_at')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}






