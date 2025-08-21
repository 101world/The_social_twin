import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  // Get user balance info using the RPC function
  const supabase = getSupabase();
  const { data, error } = await supabase
      .rpc('get_user_balance_info', { p_user_id: userId });

    if (error) {
      console.error('Balance fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
    }

    // Return the first row or default values if no balance exists
    const balanceInfo = data?.[0] || {
      balance_usd: 0.0000,
      balance_inr: 0.00,
      minimum_balance_usd: 5.0000,
      needs_topup: true,
      total_spent_this_month_usd: 0.0000,
      generations_this_month: 0
    };

    return NextResponse.json(balanceInfo);

  } catch (error) {
    console.error('Balance API error:', error);
    // Fail "softly" with defaults if env missing during build or misconfig
    return NextResponse.json({
      balance_usd: 0.0,
      balance_inr: 0.0,
      minimum_balance_usd: 5.0,
      needs_topup: true,
      total_spent_this_month_usd: 0.0,
      generations_this_month: 0,
      note: 'Balance endpoint fallback: configure Supabase envs for live data'
    });
  }
}
