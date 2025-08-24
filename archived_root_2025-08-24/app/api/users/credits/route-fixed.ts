export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdminClient();

    // Ensure user_credits row exists (but don't auto-grant)
    await supabase
      .from('user_credits')
      .upsert({ user_id: userId, credits: 0 }, { onConflict: 'user_id' });

    // Get user's billing plan
    let { data: planRow } = await supabase
      .from('user_billing')
      .select('plan, status')
      .eq('user_id', userId)
      .maybeSingle();

    // If no billing data exists, set to inactive (no free plan)
    if (!planRow) {
      await supabase.from('user_billing').upsert({
        user_id: userId,
        plan: null,
        status: 'inactive',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      planRow = { plan: null, status: 'inactive' };
    }

    const plan = (planRow?.plan || '').toLowerCase();
    const status = (planRow?.status || '').toLowerCase();
    const isActive = status === 'active' || status === 'trialing';

    // Plan credit amounts (for display only, no auto-granting)
    const PLAN_CREDITS: Record<string, number> = {
      'one t': 10000,    // $19 plan - 10k credits
      'one z': 50000,    // $79 plan - 50k credits 
      'one pro': 100000, // $149 plan - 100k credits
    };
    
    const planCredits = isActive && plan in PLAN_CREDITS ? PLAN_CREDITS[plan] : 0;

    // Get current credits (NO AUTO-GRANTING)
    let { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits, updated_at')
      .eq('user_id', userId)
      .single();

    if (creditsError) {
      console.error('Error fetching user credits:', creditsError);
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    // Get billing info
    const { data: userBilling } = await supabase
      .from('user_billing')
      .select('plan, status, next_billing_at')
      .eq('user_id', userId)
      .maybeSingle();

    return NextResponse.json({
      credits: userCredits?.credits || 0,
      created_at: userCredits?.updated_at || new Date().toISOString(),
      subscription_active: isActive,
      subscription_plan: userBilling?.plan || null,
      next_billing_at: userBilling?.next_billing_at || null,
      plan_credits: planCredits, // What the plan includes (for display)
    });
  } catch (e: any) {
    console.error('GET /api/users/credits error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, amount } = await req.json();
    if (!action || !['add', 'deduct'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (action === 'add') {
      const { data, error } = await supabase.rpc('add_credits_simple', { 
        p_user_id: userId, 
        p_amount: amount 
      });
      if (error) return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
      return NextResponse.json({ success: true, new_balance: data as number });
    }

    const { data, error } = await supabase.rpc('deduct_credits_simple', { 
      p_user_id: userId, 
      p_amount: amount 
    });
    if (error) return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    if (data === null) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    return NextResponse.json({ success: true, new_balance: data as number });

  } catch (e: any) {
    console.error('POST /api/users/credits error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
