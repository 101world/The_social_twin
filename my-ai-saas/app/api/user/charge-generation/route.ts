import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { generation_type, generation_id } = await request.json();

    if (!generation_type || !['image', 'video', 'text'].includes(generation_type)) {
      return NextResponse.json({ error: 'Invalid generation type' }, { status: 400 });
    }

    // Charge for generation using the RPC function
    const { data, error } = await supabase
      .rpc('charge_for_generation', { 
        p_user_id: userId,
        p_generation_type: generation_type,
        p_generation_id: generation_id || null
      });

    if (error) {
      console.error('Generation charge error:', error);
      return NextResponse.json({ error: 'Failed to charge for generation' }, { status: 500 });
    }

    const result = data?.[0];
    
    if (!result?.success) {
      return NextResponse.json({ 
        error: result?.error_message || 'Insufficient balance',
        success: false,
        balance: result?.new_balance_usd || 0,
        cost: result?.cost_charged_usd || 0
      }, { status: 402 }); // Payment Required
    }

    return NextResponse.json({
      success: true,
      new_balance_usd: result.new_balance_usd,
      cost_charged_usd: result.cost_charged_usd,
      message: `Successfully charged $${result.cost_charged_usd} for ${generation_type} generation`
    });

  } catch (error) {
    console.error('Charge generation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
