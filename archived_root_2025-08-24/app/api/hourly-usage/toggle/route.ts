import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// PAUSE/RESUME HOURLY SESSION API
// POST /api/hourly-usage/toggle
// Body: { action: 'pause' | 'resume' }
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

    const body = await req.json();
    const { action } = body;

    if (!action || !['pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "pause" or "resume"' },
        { status: 400 }
      );
    }

    // Call Supabase RPC to toggle session
    const { data, error } = await supabase.rpc('toggle_hourly_session', {
      p_user_id: userId,
      p_action: action
    });

    if (error) {
      console.error('Error toggling hourly session:', error);
      return NextResponse.json(
        { error: 'Failed to toggle hourly session' },
        { status: 500 }
      );
    }

    // Check if toggle was successful
    if (!data.success) {
      return NextResponse.json(
        { error: data.error },
        { status: 400 }
      );
    }

    const actionMessages = {
      pause: 'Session paused successfully! No billing while paused.',
      resume: 'Session resumed successfully! Billing continues.'
    };

    return NextResponse.json({
      success: true,
      action: data.action,
      session_id: data.session_id,
      message: actionMessages[action as keyof typeof actionMessages],
      hourly_rate: '$15/hour',
      status: action === 'pause' ? 'paused' : 'active'
    });

  } catch (error) {
    console.error('Error in toggle hourly session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
