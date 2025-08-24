import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      planId 
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Razorpay configuration missing' }, { status: 500 });
    }

    // Verify payment signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Payment is verified, now update the database
    const supabase = createSupabaseAdminClient();

    // Check if payment already processed
    const { data: existingPayment } = await supabase
      .from('user_payments')
      .select('*')
      .eq('payment_id', razorpay_payment_id)
      .single();

    if (existingPayment) {
      return NextResponse.json({ 
        success: true, 
        message: 'Payment already processed',
        creditsAdded: 0 
      });
    }

    // Record the payment
    await supabase.from('user_payments').insert({
      user_id: userId,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      status: 'completed',
      provider: 'razorpay',
      metadata: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planId,
        verified_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    // Add credits based on plan
    const creditsToAdd = getCreditsForPlan(planId);
    
    if (creditsToAdd > 0) {
      // Get current credits
      const { data: currentUser } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();

      const currentCredits = currentUser?.credits || 0;
      const newCredits = currentCredits + creditsToAdd;

      // Update credits
      await supabase
        .from('user_credits')
        .upsert({
          user_id: userId,
          credits: newCredits,
          updated_at: new Date().toISOString(),
        });

      return NextResponse.json({
        success: true,
        message: 'Payment verified successfully',
        creditsAdded: creditsToAdd,
        totalCredits: newCredits,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      creditsAdded: 0,
    });

  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}

function getCreditsForPlan(planId: string): number {
  const plans: Record<string, number> = {
    'basic': 100,      // ₹99 = 100 credits
    'pro': 500,        // ₹499 = 500 credits  
    'premium': 1200,   // ₹999 = 1200 credits
  };

  return plans[planId] || 0;
}
