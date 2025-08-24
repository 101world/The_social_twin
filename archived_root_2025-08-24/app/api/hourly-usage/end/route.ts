import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// END HOURLY SESSION API
// POST /api/hourly-usage/end
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

    // Call Supabase RPC to end hourly session
    const { data, error } = await supabase.rpc('end_hourly_session', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error ending hourly session:', error);
      return NextResponse.json(
        { error: 'Failed to end hourly session' },
        { status: 500 }
      );
    }

    // Check if session end was successful
    if (!data.success) {
      return NextResponse.json(
        { error: data.error },
        { status: 400 }
      );
    }

    const sessionDurationMinutes = Math.round(data.session_duration * 60);
    const sessionDurationHours = data.session_duration.toFixed(2);

    return NextResponse.json({
      success: true,
      session_id: data.session_id,
      message: 'Hourly session ended successfully!',
      session_summary: {
        total_cost: `$${data.total_cost_usd}`,
        duration_hours: sessionDurationHours,
        duration_minutes: sessionDurationMinutes,
        balance_remaining: `$${data.balance_remaining}`,
        hourly_rate: '$15/hour'
      }
    });

  } catch (error) {
    console.error('Error in end hourly session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET CURRENT SESSION STATUS
// GET /api/hourly-usage/end
// ============================================
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get current active session and balance
    const [sessionResult, balanceResult] = await Promise.all([
      supabase
        .from('hourly_usage_sessions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('hourly_account_balance')
        .select('*')
        .eq('user_id', userId)
        .single()
    ]);

    const hasActiveSession = !sessionResult.error && sessionResult.data;
    const balance = balanceResult.data || { balance_usd: 0, balance_inr: 0 };

    if (hasActiveSession) {
      const session = sessionResult.data;
      const sessionDuration = (new Date().getTime() - new Date(session.session_start).getTime()) / (1000 * 60 * 60);
      
      return NextResponse.json({
        has_active_session: true,
        session: {
          id: session.id,
          status: session.status,
          start_time: session.session_start,
          duration_hours: sessionDuration.toFixed(2),
          hours_charged: session.hours_charged,
          cost_so_far: `$${session.total_cost_usd}`,
          generations_count: session.generations_count
        },
        balance: {
          usd: balance.balance_usd,
          inr: balance.balance_inr
        }
      });
    }

    return NextResponse.json({
      has_active_session: false,
      balance: {
        usd: balance.balance_usd,
        inr: balance.balance_inr
      },
      minimum_balance_required: '$15.00 (₹1,245)'
    });

  } catch (error) {
    console.error('Error getting session status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
