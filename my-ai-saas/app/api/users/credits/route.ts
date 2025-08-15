import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(_req: NextRequest) {
  try {
    const { userId, getToken } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jwt = await getToken({ template: 'supabase' });
    if (!jwt) return NextResponse.json({ error: 'No Supabase token' }, { status: 401 });

    const supabase = createSupabaseClient(jwt);

    // Daily free top-up for Free users (no Stripe): 50 credits once per day
    await supabase.rpc('grant_daily_credits_if_needed', {
      p_user_id: userId,
      p_amount: 50,
    });

    const { data, error } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ credits: data?.credits ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jwt = await getToken({ template: 'supabase' });
    if (!jwt) return NextResponse.json({ error: 'No Supabase token' }, { status: 401 });

    const { action, amount } = await req.json();
    if (!action || !['add', 'deduct'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (!amount || typeof amount !== 'number' || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

    const supabase = createSupabaseClient(jwt);
    if (action === 'add') {
      const { data, error } = await supabase.rpc('add_credits_simple', { p_user_id: userId, p_amount: amount });
      if (error) return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
      return NextResponse.json({ success: true, new_balance: data as number });
    }

    const { data, error } = await supabase.rpc('deduct_credits_simple', { p_user_id: userId, p_amount: amount });
    if (error) return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    if (data === null) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    return NextResponse.json({ success: true, new_balance: data as number });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


