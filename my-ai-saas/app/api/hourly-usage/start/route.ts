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

// ============================================
// START HOURLY SESSION API
// POST /api/hourly-usage/start
// ============================================
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

  // Call Supabase RPC to start hourly session
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('start_hourly_session', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error starting hourly session:', error);
      return NextResponse.json(
        { error: 'Failed to start hourly session' },
        { status: 500 }
      );
    }

    // Check if session start was successful
    if (!data.success) {
      return NextResponse.json(
        { 
          error: data.error,
          current_balance: data.current_balance,
          required_balance: data.required_balance
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hourly session started successfully!',
      session_id: data.session_id,
      hourly_rate: '$15/hour',
      balance_before: data.balance_before,
      balance_after: data.balance_after,
      first_hour_charged: true,
      features: [
        'Unlimited AI generations',
        'Premium model access',
        'No daily limits',
        'Pause/Resume anytime'
      ]
    });

  } catch (error) {
    console.error('Error in start hourly session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
