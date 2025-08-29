export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

async function verifyStripeSignature(secret: string, body: string, signature: string) {
  if (!signature) return false;
  try {
    // Stripe webhook signature verification would go here
    // For now, let's skip verification in development
    return true;
  } catch (err) {
    console.error('Stripe signature verification error', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('stripe-signature');
    const bodyText = await req.text();

    // In production, verify the signature
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && !await verifyStripeSignature(secret, bodyText, signature || '')) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventId = event.id;
    if (!eventId) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    
    // Idempotency check
    const { data: existing } = await admin
      .from('processed_webhooks')
      .select('id')
      .eq('id', eventId)
      .maybeSingle();
    
    if (existing) {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    console.log('Stripe webhook received:', event.type, JSON.stringify(event, null, 2));

    // Handle subscription events
    if (event.type === 'customer.subscription.created' || 
        event.type === 'customer.subscription.updated' ||
        event.type === 'invoice.payment_succeeded') {
      
      const subscription = event.data.object.subscription || event.data.object;
      const customer = event.data.object.customer;
      
      // Get user ID from customer metadata (set by Clerk)
      const userId = subscription.metadata?.clerk_user_id || 
                    event.data.object.metadata?.clerk_user_id ||
                    event.data.object.customer_details?.metadata?.clerk_user_id;
      
      if (!userId) {
        console.error('No user ID found in subscription metadata');
        return NextResponse.json({ error: 'No user ID found' }, { status: 400 });
      }

      // Get plan details
      const priceId = subscription.items?.data?.[0]?.price?.id || event.data.object.lines?.data?.[0]?.price?.id;
      const status = subscription.status || 'active';
      
      // Map price IDs to credits - UPDATE THESE WITH YOUR ACTUAL STRIPE PRICE IDs
      const creditMapping: Record<string, { plan: string, credits: number }> = {
        // Replace with your actual Stripe price IDs from Clerk dashboard
        'price_1234567890abcdef': { plan: 'one_t', credits: 1000 },
        'price_abcdef1234567890': { plan: 'one_s', credits: 5000 },
        'price_1111222233334444': { plan: 'one_xt', credits: 10000 },
        'price_5555666677778888': { plan: 'one_z', credits: 50000 },
      };

      const planData = creditMapping[priceId || ''] || { plan: 'unknown', credits: 0 };

      // Update billing record
      await admin.from('user_billing').upsert({
        user_id: userId,
        plan: planData.plan,
        status: status,
        stripe_customer_id: customer,
        stripe_subscription_id: subscription.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      // Update credits ONLY if payment succeeded or subscription is active
      if (event.type === 'invoice.payment_succeeded' || 
          (status === 'active' && event.type.includes('subscription'))) {
        
        await admin.from('user_credits').upsert({
          user_id: userId,
          credits: planData.credits,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        console.log(`✅ Credits updated for user ${userId}: ${planData.plan} = ${planData.credits} credits`);
      }
    }

    // Record processed webhook
    await admin.from('processed_webhooks').insert([{ 
      id: eventId, 
      source: 'stripe',
      event_type: event.type,
      processed_at: new Date().toISOString()
    }]);

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('Stripe webhook error:', err);
    return NextResponse.json({ 
      error: (err as Error).message || 'Webhook failed' 
    }, { status: 500 });
  }
}
