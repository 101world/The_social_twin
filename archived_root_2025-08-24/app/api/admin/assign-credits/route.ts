import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated (you might want to add admin check here)
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, credits, reason = 'Manual assignment' } = body;

    if (!targetUserId || typeof credits !== 'number') {
      return NextResponse.json({ 
        error: 'Missing targetUserId or invalid credits amount' 
      }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Update user credits
    const { error } = await admin
      .from('user_credits')
      .upsert({
        user_id: targetUserId,
        credits: credits,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error updating credits:', error);
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
    }

    // Log the manual assignment (optional, table might not exist)
    try {
      await admin.from('credit_transactions').insert([{
        user_id: targetUserId,
        amount: credits,
        type: 'manual_assignment',
        reason: reason,
        assigned_by: userId,
        created_at: new Date().toISOString()
      }]);
    } catch (err) {
      // Credit transactions table might not exist, that's ok
      console.log('Credit transactions table not found:', err);
    }

    console.log(`✅ Manual credit assignment: ${credits} credits to user ${targetUserId} by ${userId}`);

    return NextResponse.json({ 
      success: true, 
      message: `Assigned ${credits} credits to user ${targetUserId}` 
    });

  } catch (err) {
    console.error('Manual credit assignment error:', err);
    return NextResponse.json({ 
      error: (err as Error).message || 'Failed to assign credits' 
    }, { status: 500 });
  }
}
