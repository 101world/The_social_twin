import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Razorpay from 'razorpay';

// Initialize Razorpay only if credentials are available
let razorpay: Razorpay | null = null;

if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string,
    key_secret: process.env.RAZORPAY_KEY_SECRET as string,
  });
} else {
  console.warn('Razorpay configuration missing: NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not set');
}

export async function POST(request: NextRequest) {
  try {
    // Check if Razorpay is configured
    if (!razorpay) {
      return NextResponse.json({ 
        error: 'Payment system not configured. Please contact support.' 
      }, { status: 503 });
    }

    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await request.json();

    if (!amount || amount < 5) {
      return NextResponse.json({ error: 'Minimum amount is $5' }, { status: 400 });
    }

    // Convert USD -> INR for Razorpay order (Razorpay test accounts typically use INR)
    const CONVERSION_RATE = 83; // 1 USD ≈ ₹83 (static for test)
    const amountInr = Math.max(5, Number(amount)) * CONVERSION_RATE;
    const currency = 'INR' as const;

    // Create Razorpay order for balance top-up (INR paise)
    // Razorpay requires receipt length <= 40
    const compactReceipt = `bt_${Date.now().toString(36)}_${(userId || '').slice(-4)}_${Math.random().toString(36).slice(2,6)}`.slice(0, 40);

    const options = {
      amount: Math.round(amountInr * 100), // paise
      currency,
      receipt: compactReceipt,
      notes: {
        user_id: userId,
        type: 'balance_topup',
        amount_usd: amount.toString(),
        amount_inr: amountInr.toFixed(2),
      },
    } as const;

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      user_id: userId
    });

  } catch (error: any) {
    const details = (error?.error && (error.error.description || error.error.reason)) || error?.message || String(error);
    console.error('Balance payment creation error:', details);
    return NextResponse.json({
      error: details || 'Failed to create payment',
    }, { status: 500 });
  }
}
