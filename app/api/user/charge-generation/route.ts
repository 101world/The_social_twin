import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, key);
}

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
  const supabase = getSupabase();
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
    // Graceful fallback if env missing during build
    return NextResponse.json({
      error: 'Service temporarily unavailable',
      note: 'Configure Supabase env vars to enable charges'
    }, { status: 500 });
  }
}
