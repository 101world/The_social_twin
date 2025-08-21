import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// RAZORPAY WEBHOOK FOR HOURLY BALANCE TOP-UPS
// POST /api/webhooks/razorpay-hourly
// ============================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      console.error('Missing Razorpay signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.error('Invalid Razorpay signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;

    console.log('Hourly balance webhook received:', eventType);

    // Handle payment success for hourly balance top-up
    if (eventType === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amountPaise = payment.amount;
      
      // Get order details to extract user info
      const notes = payment.notes || {};
      const userId = notes.user_id;
      const topupAmountUSD = parseFloat(notes.topup_amount_usd || '0');
      
      if (!userId || !topupAmountUSD) {
        console.error('Missing user_id or topup_amount_usd in payment notes');
        return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
      }

      console.log(`Processing hourly balance top-up: $${topupAmountUSD} for user ${userId}`);

      try {
        // Update transaction status to completed
        const { error: updateError } = await supabase
          .from('hourly_topup_transactions')
          .update({
            razorpay_payment_id: paymentId,
            status: 'completed',
            metadata: {
              payment_captured: payment,
              processed_at: new Date().toISOString()
            }
          })
          .eq('razorpay_order_id', orderId);

        if (updateError) {
          console.error('Error updating transaction:', updateError);
          throw updateError;
        }

        // Add balance using RPC function
        const { data: balanceResult, error: balanceError } = await supabase.rpc('add_hourly_balance', {
          p_user_id: userId,
          p_amount_usd: topupAmountUSD,
          p_payment_id: paymentId
        });

        if (balanceError) {
          console.error('Error adding hourly balance:', balanceError);
          throw balanceError;
        }

        if (!balanceResult.success) {
          console.error('Failed to add balance:', balanceResult);
          throw new Error('Balance addition failed');
        }

        console.log(`✅ Hourly balance top-up successful:`, {
          user_id: userId,
          amount_usd: topupAmountUSD,
          new_balance: balanceResult.new_balance_usd,
          payment_id: paymentId
        });

        return NextResponse.json({ 
          success: true,
          message: 'Balance top-up processed successfully',
          balance_added: topupAmountUSD,
          new_balance: balanceResult.new_balance_usd
        });

      } catch (error) {
        console.error('Error processing hourly balance top-up:', error);
        
        // Mark transaction as failed
        await supabase
          .from('hourly_topup_transactions')
          .update({
            status: 'failed',
            metadata: {
              error: error instanceof Error ? error.message : 'Unknown error',
              failed_at: new Date().toISOString()
            }
          })
          .eq('razorpay_order_id', orderId);

        return NextResponse.json({ 
          error: 'Failed to process balance top-up' 
        }, { status: 500 });
      }
    }

    // Handle payment failed
    if (eventType === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      
      console.log('Hourly balance payment failed:', orderId);

      // Update transaction status to failed
      await supabase
        .from('hourly_topup_transactions')
        .update({
          status: 'failed',
          metadata: {
            payment_failed: payment,
            failed_at: new Date().toISOString()
          }
        })
        .eq('razorpay_order_id', orderId);

      return NextResponse.json({ 
        success: true,
        message: 'Payment failure recorded'
      });
    }

    // For other events, just acknowledge
    console.log(`Unhandled hourly webhook event: ${eventType}`);
    return NextResponse.json({ 
      success: true,
      message: 'Webhook received'
    });

  } catch (error) {
    console.error('Error processing hourly balance webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
