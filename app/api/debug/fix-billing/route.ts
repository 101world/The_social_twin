import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    
    // Force update billing data for current user
    const { error: billingError } = await admin
      .from('user_billing')
      .upsert({
        user_id: userId,
        plan: 'one z',
        status: 'active',
        clerk_subscription_id: 'manual_override',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (billingError) {
      console.error('Billing update error:', billingError)
      return Response.json({ error: billingError.message }, { status: 500 })
    }

    // Update credits to One Z level
    const { error: creditsError } = await admin
      .from('user_credits')
      .upsert({
        user_id: userId,
        credits: 1666,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (creditsError) {
      console.error('Credits update error:', creditsError)
      return Response.json({ error: creditsError.message }, { status: 500 })
    }

    return Response.json({ 
      success: true, 
      message: 'Updated billing to One Z plan with 1666 credits',
      userId 
    })

  } catch (error) {
    console.error('Fix billing error:', error)
    return Response.json({ error: 'Failed to fix billing' }, { status: 500 })
  }
}
