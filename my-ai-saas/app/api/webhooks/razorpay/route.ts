import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const supabase = createSupabaseAdminClient();

    console.log('Razorpay webhook received:', event.event);

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity, supabase);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity, supabase);
        break;
      
      case 'subscription.created':
        await handleSubscriptionCreated(event.payload.subscription.entity, supabase);
        break;
      
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event.payload.subscription.entity, supabase);
        break;

      default:
        console.log('Unhandled Razorpay event:', event.event);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentCaptured(payment: any, supabase: any) {
  try {
    const { order_id, amount, currency, id: payment_id } = payment;
    const notes = payment.notes || {};
    const userId = notes.userId;

    if (!userId) {
      console.error('No userId found in payment notes');
      return;
    }

    // Record the payment
    await supabase.from('user_payments').insert({
      user_id: userId,
      payment_id,
      order_id,
      amount: amount / 100, // Convert back from paise to rupees
      currency,
      status: 'completed',
      provider: 'razorpay',
      metadata: payment,
      created_at: new Date().toISOString(),
    });

    // Update user credits based on plan
    const planId = notes.planId || 'default';
    const creditsToAdd = getCreditsForPlan(planId, amount / 100);

    if (creditsToAdd > 0) {
      // Get current credits
      const { data: currentUser } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();

      const currentCredits = currentUser?.credits || 0;
      const newCredits = currentCredits + creditsToAdd;

      // Update or insert credits
      await supabase
        .from('user_credits')
        .upsert({
          user_id: userId,
          credits: newCredits,
          updated_at: new Date().toISOString(),
        });

      console.log(`Added ${creditsToAdd} credits to user ${userId}. New total: ${newCredits}`);
    }

  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
}

async function handlePaymentFailed(payment: any, supabase: any) {
  try {
    const { order_id, id: payment_id } = payment;
    const notes = payment.notes || {};
    const userId = notes.userId;

    if (!userId) return;

    await supabase.from('user_payments').insert({
      user_id: userId,
      payment_id,
      order_id,
      amount: payment.amount / 100,
      currency: payment.currency,
      status: 'failed',
      provider: 'razorpay',
      metadata: payment,
      created_at: new Date().toISOString(),
    });

    console.log(`Payment failed for user ${userId}, order ${order_id}`);

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleSubscriptionCreated(subscription: any, supabase: any) {
  // Handle subscription creation if needed
  console.log('Subscription created:', subscription.id);
}

async function handleSubscriptionCancelled(subscription: any, supabase: any) {
  // Handle subscription cancellation if needed
  console.log('Subscription cancelled:', subscription.id);
}

function getCreditsForPlan(planId: string, amount: number): number {
  // Define your credit plans here
  const plans: Record<string, number> = {
    'basic': 100,      // ₹99 = 100 credits
    'pro': 500,        // ₹499 = 500 credits  
    'premium': 1200,   // ₹999 = 1200 credits
    'default': Math.floor(amount), // Fallback: 1 credit per rupee
  };

  return plans[planId] || plans['default'];
}
