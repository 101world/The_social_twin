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

      case 'subscription.charged':
        await handleSubscriptionCharged(event.payload.subscription.entity, supabase);
        break;

      case 'subscription.activated':
        await handleSubscriptionActivated(event.payload.subscription.entity, supabase);
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
    const userId = notes.userId || notes.user_id;
    const product = notes.product;
    const paymentType = notes.type;

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

    // Handle ONE MAX balance top-up
    if (paymentType === 'balance_topup') {
      const topupAmountUSD = parseFloat(notes.amount_usd || '0');
      
      if (topupAmountUSD > 0) {
        console.log(`Processing ONE MAX balance top-up: $${topupAmountUSD} for user ${userId}`);
        
        // Add balance using RPC function
        const { data: balanceResult, error: balanceError } = await supabase.rpc('add_balance', {
          p_user_id: userId,
          p_amount_usd: topupAmountUSD
        });

        if (balanceError) {
          console.error('Error adding ONE MAX balance:', balanceError);
          throw balanceError;
        }

        console.log(`✅ ONE MAX balance top-up successful:`, {
          user_id: userId,
          amount_usd: topupAmountUSD,
          new_balance: balanceResult?.[0]?.new_balance_usd,
          payment_id: payment_id
        });
        
        return; // Exit early for balance top-up payments
      }
    }

    // Handle hourly balance top-up (legacy)
    if (product === 'hourly_usage_balance') {
      const topupAmountUSD = parseFloat(notes.topup_amount_usd || '0');
      
      if (topupAmountUSD > 0) {
        console.log(`Processing hourly balance top-up: $${topupAmountUSD} for user ${userId}`);
        
        // Update transaction status to completed
        await supabase
          .from('hourly_topup_transactions')
          .update({
            razorpay_payment_id: payment_id,
            status: 'completed',
            metadata: {
              payment_captured: payment,
              processed_at: new Date().toISOString()
            }
          })
          .eq('razorpay_order_id', order_id);

        // Add balance using RPC function
        const { data: balanceResult, error: balanceError } = await supabase.rpc('add_hourly_balance', {
          p_user_id: userId,
          p_amount_usd: topupAmountUSD,
          p_payment_id: payment_id
        });

        if (balanceError) {
          console.error('Error adding hourly balance:', balanceError);
          throw balanceError;
        }

        console.log(`✅ Hourly balance top-up successful:`, {
          user_id: userId,
          amount_usd: topupAmountUSD,
          new_balance: balanceResult.new_balance_usd,
          payment_id: payment_id
        });
        
        return; // Exit early for hourly payments
      }
    }

    // Handle regular credit-based payments
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
    const userId = notes.userId || notes.user_id;
    const product = notes.product;
    const paymentType = notes.type;

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

    // Handle ONE MAX balance top-up failure
    if (paymentType === 'balance_topup') {
      console.log('ONE MAX balance payment failed:', order_id);
      // No additional action needed for direct payments
    }

    // Handle hourly balance top-up failure (legacy)
    if (product === 'hourly_usage_balance') {
      console.log('Hourly balance payment failed:', order_id);

      // Update transaction status to failed
      await supabase
        .from('hourly_topup_transactions')
        .update({
          status: 'failed',
          metadata: {
            payment_failed: payment,
            failed_at: new Date().toISOString()
          }
        })
        .eq('razorpay_order_id', order_id);
    }

    console.log(`Payment failed for user ${userId}, order ${order_id}`);

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleSubscriptionCreated(subscription: any, supabase: any) {
  console.log('Subscription created:', subscription.id);
  try {
    const { notes } = subscription;
    const userId = notes?.userId;

    if (!userId) {
      console.error('No userId found in subscription notes');
      return;
    }

    // Update billing status to created
    await supabase.from('user_billing').upsert({
      user_id: userId,
      plan: notes?.planId || 'unknown',
      status: 'created',
      razorpay_subscription_id: subscription.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    console.log(`Subscription created for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

async function handleSubscriptionActivated(subscription: any, supabase: any) {
  console.log('Subscription activated:', subscription.id);
  try {
    const { notes } = subscription;
    const userId = notes?.userId;
    const planId = notes?.planId;
    const credits = parseInt(notes?.credits || '0');

    if (!userId) {
      console.error('No userId found in subscription notes');
      return;
    }

    // Update billing status to active
    await supabase.from('user_billing').upsert({
      user_id: userId,
      plan: planId,
      status: 'active',
      razorpay_subscription_id: subscription.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    // Grant initial monthly credits
    if (credits > 0) {
      await supabase.rpc('set_monthly_credits', {
        p_user_id: userId,
        p_credits: credits
      });
      console.log(`Granted ${credits} initial credits to user ${userId}`);
    }

    console.log(`Subscription activated for user ${userId} with plan ${planId}`);
  } catch (error) {
    console.error('Error handling subscription activated:', error);
  }
}

async function handleSubscriptionCharged(subscription: any, supabase: any) {
  console.log('Monthly subscription charged:', subscription.id);
  try {
    const { notes } = subscription;
    const userId = notes?.userId;
    const planId = notes?.planId;
    const credits = parseInt(notes?.credits || '0');

    if (!userId) {
      console.error('No userId found in subscription notes');
      return;
    }

    // Record the payment
    await supabase.from('user_payments').insert({
      user_id: userId,
      subscription_id: subscription.id,
      amount: (subscription.amount || 0) / 100, // Convert from paise to rupees
      currency: 'INR',
      status: 'completed',
      provider: 'razorpay',
      plan_id: planId,
      credits_added: credits,
      metadata: subscription,
      created_at: new Date().toISOString()
    });

    // Grant monthly credits (replace existing, don't add)
    if (credits > 0) {
      await supabase.rpc('set_monthly_credits', {
        p_user_id: userId,
        p_credits: credits
      });
      console.log(`Monthly renewal: Granted ${credits} credits to user ${userId} for plan ${planId}`);
    }

    // Update next billing date
    const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('user_billing').update({
      next_billing_at: nextBilling,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);

    console.log(`Monthly billing completed for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription charged:', error);
  }
}

async function handleSubscriptionCancelled(subscription: any, supabase: any) {
  console.log('Subscription cancelled:', subscription.id);
  try {
    const { notes } = subscription;
    const userId = notes?.userId;

    if (!userId) {
      console.error('No userId found in subscription notes');
      return;
    }

    // Update billing status to cancelled
    await supabase.from('user_billing').update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);

    console.log(`Subscription cancelled for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription cancelled:', error);
  }
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
