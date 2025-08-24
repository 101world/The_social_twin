import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const authState = await auth();
    const userId = authState.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    
    // Check if user already claimed free credits
    const { data: existingClaim } = await supabase
      .from('free_credit_claims')
      .select('id, created_at')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({
      hasClaimed: !!existingClaim,
      claimedAt: existingClaim?.created_at || null
    });

  } catch (error: any) {
    console.error('Check claim status error:', error);
    return NextResponse.json({ 
      error: 'Failed to check claim status', 
      details: error.message 
    }, { status: 500 });
  }
}
