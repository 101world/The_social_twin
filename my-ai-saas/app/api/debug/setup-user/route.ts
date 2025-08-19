import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId, credits, plan } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    
    // Insert/update user credits
    const { data: creditsData, error: creditsError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        credits: credits || 1666,
        updated_at: new Date().toISOString(),
        last_daily_topup_at: new Date().toISOString()
      })
      .select()
      .single();

    if (creditsError) {
      return NextResponse.json({ error: 'Failed to update credits', details: creditsError }, { status: 500 });
    }

    // Insert/update user billing
    const { data: billingData, error: billingError } = await supabase
      .from('user_billing')
      .upsert({
        user_id: userId,
        plan: plan || 'one z',
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (billingError) {
      return NextResponse.json({ error: 'Failed to update billing', details: billingError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      credits: creditsData,
      billing: billingData
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: error }, { status: 500 });
  }
}
