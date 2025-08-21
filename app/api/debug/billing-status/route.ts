import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    
    // Get billing data
    const { data: billing, error: billingError } = await admin
      .from('user_billing')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Get credits data
    const { data: credits, error: creditsError } = await admin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single()

    return Response.json({ 
      userId,
      billing: billing || null,
      billingError: billingError?.message || null,
      credits: credits || null,
      creditsError: creditsError?.message || null
    })

  } catch (error) {
    console.error('Debug error:', error)
    return Response.json({ error: 'Failed to get debug info' }, { status: 500 })
  }
}
