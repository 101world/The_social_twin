import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check what Clerk knows about this user
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    }).then(r => r.json());

    let stripeInfo = null;
    
    // Check Stripe for this user
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const email = clerkUser?.email_addresses?.[0]?.email_address;
        
        // Search for customer by email
        let customers = [];
        if (email) {
          const customerSearch = await stripe.customers.search({
            query: `email:'${email}'`
          });
          customers = customerSearch.data;
        }

        if (customers.length > 0) {
          const customer = customers[0];
          
          // Get all subscriptions for this customer
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 10
          });

          stripeInfo = {
            customer_id: customer.id,
            customer_email: customer.email,
            subscriptions: subscriptions.data.map(sub => ({
              id: sub.id,
              status: sub.status,
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              items: sub.items.data.map(item => ({
                price_id: item.price.id,
                price_nickname: item.price.nickname,
                product: item.price.product,
                amount: item.price.unit_amount,
                currency: item.price.currency,
                interval: item.price.recurring?.interval
              }))
            }))
          };
        }
      } catch (stripeError) {
        stripeInfo = { error: stripeError.message };
      }
    }

    return NextResponse.json({
      user_id: userId,
      clerk_data: {
        email: clerkUser?.email_addresses?.[0]?.email_address,
        public_metadata: clerkUser?.public_metadata,
        private_metadata: clerkUser?.private_metadata,
        unsafe_metadata: clerkUser?.unsafe_metadata,
        created_at: clerkUser?.created_at,
        updated_at: clerkUser?.updated_at
      },
      stripe_data: stripeInfo,
      environment: {
        has_stripe_key: !!process.env.STRIPE_SECRET_KEY,
        has_clerk_key: !!process.env.CLERK_SECRET_KEY
      }
    });

  } catch (error) {
    console.error('Subscription check error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
