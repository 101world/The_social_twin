import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId, credits, plan, action } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const results: any = { userId, action: action || 'fix' };

    if (action === 'check') {
      // Just check the user's current status
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: billingData, error: billingError } = await supabase
        .from('user_billing')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      results.currentState = {
        credits: { data: creditsData, error: creditsError?.message },
        billing: { data: billingData, error: billingError?.message }
      };

      return NextResponse.json(results);
    }

    // Fix the user's credits and billing
    const targetCredits = credits || 1666;
    const targetPlan = plan || 'one z';

    // 1. Fix user_credits
    const { data: creditsResult, error: creditsError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        credits: targetCredits,
        updated_at: new Date().toISOString(),
        last_daily_topup_at: new Date().toISOString()
      })
      .select()
      .single();

    results.creditsUpdate = {
      success: !creditsError,
      error: creditsError?.message,
      data: creditsResult
    };

    // 2. Fix user_billing  
    const { data: billingResult, error: billingError } = await supabase
      .from('user_billing')
      .upsert({
        user_id: userId,
        plan: targetPlan,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    results.billingUpdate = {
      success: !billingError,
      error: billingError?.message,
      data: billingResult
    };

    // 3. Try the daily grant RPC to ensure it works
    try {
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('grant_daily_credits_if_needed', {
          p_user_id: userId,
          p_amount: targetCredits === 1666 ? 1666 : 50
        });

      results.dailyGrantTest = {
        success: !rpcError,
        error: rpcError?.message,
        data: rpcResult
      };
    } catch (e) {
      results.dailyGrantTest = {
        success: false,
        error: `RPC function error: ${(e as Error).message}`
      };
    }

    return NextResponse.json(results);

  } catch (error) {
    return NextResponse.json({ 
      error: 'Fix operation failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}
