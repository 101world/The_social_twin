import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get Clerk user data
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    }).then(r => r.json());

    const email = clerkUser?.email_addresses?.[0]?.email_address;
    let stripeData = null;

    // Check Stripe if available
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        // Dynamic import to avoid build errors when stripe is not installed
        const stripe = await import('stripe').then(mod => new mod.default(process.env.STRIPE_SECRET_KEY!));
        
        // Search for customer by Clerk user ID
        let customers: any[] = [];
        try {
          const customerSearch = await stripe.customers.search({
            query: `metadata['clerk_user_id']:'${userId}'`
          });
          customers = customerSearch.data;
        } catch (e) {}

        // If not found, try by email
        if (customers.length === 0 && email) {
          try {
            const customerSearch = await stripe.customers.search({
              query: `email:'${email}'`
            });
            customers = customerSearch.data;
          } catch (e) {}
        }

        if (customers.length > 0) {
          const customer = customers[0];
          
          // Get all subscriptions (active and inactive)
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 10
          });

          stripeData = {
            customer: {
              id: customer.id,
              email: customer.email,
              metadata: customer.metadata
            },
            subscriptions: subscriptions.data.map((sub: any) => ({
              id: sub.id,
              status: sub.status,
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              items: sub.items.data.map((item: any) => ({
                price: {
                  id: item.price.id,
                  nickname: item.price.nickname,
                  unit_amount: item.price.unit_amount,
                  currency: item.price.currency,
                  recurring: item.price.recurring
                },
                product: item.price.product
              }))
            }))
          };
        }
      } catch (stripeError: any) {
        stripeData = { error: stripeError?.message || 'Unknown Stripe error' };
      }
    }

    return Response.json({ 
      userId,
      clerkUser: {
        id: clerkUser.id,
        email_addresses: clerkUser.email_addresses,
        first_name: clerkUser.first_name,
        last_name: clerkUser.last_name,
        public_metadata: clerkUser.public_metadata,
        private_metadata: clerkUser.private_metadata,
        external_accounts: clerkUser.external_accounts
      },
      stripe: stripeData
    })

  } catch (error) {
    console.error('Debug subscription error:', error)
    return Response.json({ error: 'Failed to debug subscription' }, { status: 500 })
  }
}
