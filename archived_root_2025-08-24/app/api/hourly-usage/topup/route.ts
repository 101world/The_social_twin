import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

export const runtime = 'nodejs';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, key);
}

function getRazorpay() {
  // Prefer NEXT_PUBLIC_RAZORPAY_KEY_ID for consistency across app
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Razorpay configuration missing (key_id/key_secret)');
  }
  return new Razorpay({ key_id, key_secret });
}

// ============================================
// CREATE HOURLY BALANCE TOP-UP ORDER
// POST /api/hourly-usage/topup
// Body: { amount: 100 | 200 | 500 }
// ============================================
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { amount } = body;

    // Validate top-up amount (minimum $100)
    const validAmounts = [100, 200, 500];
    if (!validAmounts.includes(amount)) {
      return NextResponse.json(
        { 
          error: 'Invalid top-up amount',
          valid_amounts: ['$100', '$200', '$500'],
          note: 'Minimum top-up is $100 for hourly usage'
        },
        { status: 400 }
      );
    }

    // Convert USD to INR (using rate 83)
    const amountINR = amount * 83;

    // Create Razorpay order for top-up (lazy init to avoid build-time errors)
    const rp = getRazorpay();
    const compactReceipt = `ht_${Date.now().toString(36)}_${(userId || '').slice(-4)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`.slice(0, 40);
    const razorpayOrder = await rp.orders.create({
      amount: Math.round(amountINR * 100), // Amount in paise
      currency: 'INR',
      receipt: compactReceipt, // <= 40 chars
      notes: {
        user_id: userId,
        topup_amount_usd: amount.toString(),
        topup_amount_inr: amountINR.toString(),
        product: 'hourly_usage_balance' // This tells webhook it's hourly balance
      }
    });

    // Record pending transaction
  const supabase = getSupabase();
  const { error: insertError } = await supabase
      .from('hourly_topup_transactions')
      .insert({
        user_id: userId,
        amount_usd: amount,
        amount_inr: amountINR,
        razorpay_order_id: razorpayOrder.id,
        status: 'pending',
        metadata: {
          razorpay_order: razorpayOrder,
          created_via: 'api'
        }
      });

    if (insertError) {
      console.error('Error recording transaction:', insertError);
      return NextResponse.json(
        { error: 'Failed to record transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order_id: razorpayOrder.id,
      amount_usd: amount,
      amount_inr: amountINR,
      currency: 'INR',
  razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      message: `Top-up order created for $${amount} (₹${amountINR.toLocaleString('en-IN')})`,
      features_unlocked: [
        'Unlimited AI generations at $15/hour',
        'Pause/Resume anytime',
        'Premium model access',
        'No daily limits'
      ]
    });

  } catch (error) {
    console.error('Error creating top-up order:', error);
    return NextResponse.json(
      { error: 'Failed to create top-up order' },
      { status: 500 }
    );
  }
}

// ============================================
// GET BALANCE AND TOP-UP HISTORY
// GET /api/hourly-usage/topup
// ============================================
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get current balance and transaction history
    const supabase = getSupabase();
    const [balanceResult, transactionsResult] = await Promise.all([
      supabase
        .from('hourly_account_balance')
        .select('*')
        .eq('user_id', userId)
        .single(),
      
      supabase
        .from('hourly_topup_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    const balance = balanceResult.data || { 
      balance_usd: 0, 
      balance_inr: 0,
      total_spent_usd: 0,
      total_spent_inr: 0 
    };

    const transactions = transactionsResult.data || [];

    return NextResponse.json({
      balance: {
        current_usd: balance.balance_usd,
        current_inr: balance.balance_inr,
        total_spent_usd: balance.total_spent_usd,
        total_spent_inr: balance.total_spent_inr,
        last_topup: balance.last_topup_at
      },
      can_start_session: balance.balance_usd >= 15,
      minimum_required: '$15.00 (₹1,245)',
      topup_options: [
        { amount_usd: 100, amount_inr: 8300, hours: '6.7 hours' },
        { amount_usd: 200, amount_inr: 16600, hours: '13.3 hours' },
        { amount_usd: 500, amount_inr: 41500, hours: '33.3 hours' }
      ],
      recent_transactions: transactions.map(t => ({
        id: t.id,
        amount_usd: t.amount_usd,
        amount_inr: t.amount_inr,
        status: t.status,
        created_at: t.created_at
      }))
    });

  } catch (error) {
    console.error('Error getting balance info:', error);
    return NextResponse.json(
      { error: 'Failed to get balance information' },
      { status: 500 }
    );
  }
}
