import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase'

async function detectUserSubscription(userId: string) {
  try {
    // Method 1: Check Clerk user metadata
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    }).then(r => r.json());

    const metadata = clerkUser?.public_metadata || clerkUser?.private_metadata || {};
    if (metadata.subscription || metadata.plan) {
      return { plan: metadata.subscription || metadata.plan, status: 'active' };
    }

    // Method 2: Check Razorpay for active subscriptions (when implemented)
    // For now, we'll use plan detection from user metadata or database
    // TODO: Add Razorpay subscription detection here

    // Method 3: Default plan detection (you can customize this)
    // For now, check if user email contains certain domains or patterns
    const email = clerkUser?.email_addresses?.[0]?.email_address || '';
    
    // You can add your own logic here, for example:
    // - Check if email is in a list of premium users
    // - Check if user was created after a certain date (trial users)
    // - Default to a specific plan for testing
    
    return { plan: 'one z', status: 'active' }; // Default for testing
    
  } catch (error) {
    console.error('Subscription detection failed:', error);
    return { plan: 'free', status: 'active' };
  }
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    
    // Detect user's actual subscription
    const subscription = await detectUserSubscription(userId);
    
    // Update billing data
    const { error: billingError } = await admin
      .from('user_billing')
      .upsert({
        user_id: userId,
        plan: subscription.plan,
        status: subscription.status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (billingError) {
      console.error('Billing update error:', billingError)
      return Response.json({ error: billingError.message }, { status: 500 })
    }

    // Updated monthly credit allocations to match new billing system
    const monthlyGrants: Record<string, number> = {
      'free': 0, 'one_t': 1120, 'one_z': 4050, 'one_pro': 8700
    };
    const credits = monthlyGrants[subscription.plan.toLowerCase()] ?? 0;
    
    const { error: creditsError } = await admin
      .from('user_credits')
      .upsert({
        user_id: userId,
        credits: credits,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (creditsError) {
      console.error('Credits update error:', creditsError)
      return Response.json({ error: creditsError.message }, { status: 500 })
    }

    return Response.json({ 
      success: true, 
  message: `Detected and set plan: ${subscription.plan} (${credits} monthly credits)`,
      plan: subscription.plan,
      status: subscription.status,
      credits: credits
    })

  } catch (error) {
    console.error('Auto-setup error:', error)
    return Response.json({ error: 'Failed to auto-setup billing' }, { status: 500 })
  }
}
