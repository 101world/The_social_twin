export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

// Debug-only: Add credits to the currently signed-in user.
// Usage: GET /api/debug/topup?amount=100
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawAmount = searchParams.get('amount');
  const amount = Math.max(1, Math.min(100000, Number(rawAmount) || 50));

  const supabase = createSupabaseAdminClient();

  try {
    // Ensure row exists
    await supabase.from('user_credits').upsert({ user_id: userId, credits: 0 }, { onConflict: 'user_id' });

    const { data, error } = await supabase.rpc('add_credits_simple', {
      p_user_id: userId,
      p_amount: amount,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, added: amount, new_balance: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
