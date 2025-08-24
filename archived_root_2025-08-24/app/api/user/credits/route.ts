import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient();

    // Get user credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits, updated_at')
      .eq('user_id', userId)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      throw creditsError;
    }

    // Get payment history
    const { data: payments, error: paymentsError } = await supabase
      .from('user_payments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    return NextResponse.json({
      credits: userCredits?.credits || 0,
      lastUpdated: userCredits?.updated_at || null,
      recentPayments: payments || [],
    });

  } catch (error: any) {
    console.error('Error fetching user info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user info' },
      { status: 500 }
    );
  }
}
