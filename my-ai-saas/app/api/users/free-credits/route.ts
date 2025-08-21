import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const authState = await auth();
    const userId = authState.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    
    // Check if user already claimed free credits (one-time only)
    const { data: existingClaim } = await supabase
      .from('free_credit_claims')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingClaim) {
      return NextResponse.json({ 
        error: 'You have already claimed your free credits. This is a one-time offer.' 
      }, { status: 400 });
    }

    // Get current credits
    const { data: currentCredits } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    const newCreditAmount = (currentCredits?.credits || 0) + 1000;

    // Update or insert credits
    const { error: creditError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        credits: newCreditAmount,
        updated_at: new Date().toISOString(),
      });

    if (creditError) {
      console.error('Error updating credits:', creditError);
      return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
    }

    // Record the claim
    await supabase
      .from('free_credit_claims')
      .insert({
        user_id: userId,
        credits_added: 1000,
        created_at: new Date().toISOString()
      });

    // Log the transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'free_claim',
        amount: 1000,
        description: 'One-time free credit claim',
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      credits_added: 1000,
      new_balance: newCreditAmount,
      message: '🎉 1000 free credits added to your account!'
    });

  } catch (error: any) {
    console.error('Free credits error:', error);
    return NextResponse.json({ 
      error: 'Failed to process free credits', 
      details: error.message 
    }, { status: 500 });
  }
}
