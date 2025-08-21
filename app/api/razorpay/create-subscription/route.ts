import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import Razorpay from 'razorpay';

// USD to INR conversion plans with EXACT SPECIFICATIONS (1 USD = 83 INR approx)
// Updated to match new billing system: One T: 200 images/12 videos, One Z: 700 images/55 videos, One Pro: 1500 images/120 videos
const SUBSCRIPTION_PLANS = {
  'one_t': {
    name: 'One T Plan',
    usd_price: 19,
    inr_price: 1577, // $19 × 83
    credits: 1120, // 200 images × 5 credits + 12 videos × 10 credits = 1000 + 120 = 1120
    description: '1,120 AI credits monthly (200 images, 12 videos)',
    image_time: 30, // seconds per image
    video_time: 450, // seconds per video
    max_images: 200, // EXACT: 200 images per month
    max_videos: 12, // EXACT: 12 videos per month
    features: [
      '1,120 monthly credits',
      '200 images per month',
      '12 videos per month',
      '30s per image generation',
      '450s per video generation',
      'Standard AI models',
      'Email support'
    ]
  },
  'one_z': {
    name: 'One Z Plan', 
    usd_price: 79,
    inr_price: 6551, // $79 × 83
    credits: 4050, // 700 images × 5 credits + 55 videos × 10 credits = 3500 + 550 = 4050
    description: '4,050 AI credits monthly (700 images, 55 videos)',
    image_time: 30, // seconds per image
    video_time: 450, // seconds per video
    max_images: 700, // EXACT: 700 images per month
    max_videos: 55, // EXACT: 55 videos per month
    features: [
      '4,050 monthly credits',
      '700 images per month',
      '55 videos per month',
      '30s per image generation',
      '450s per video generation',
      'Premium AI models',
      'Priority support',
      'Advanced features'
    ]
  },
  'one_pro': {
    name: 'One Pro Plan',
    usd_price: 149, 
    inr_price: 12367, // $149 × 83
    credits: 8700, // 1500 images × 5 credits + 120 videos × 10 credits = 7500 + 1200 = 8700
    description: '8,700 AI credits monthly (1,500 images, 120 videos)',
    image_time: 30, // seconds per image
    video_time: 450, // seconds per video
    max_images: 1500, // EXACT: 1500 images per month
    max_videos: 120, // EXACT: 120 videos per month
    features: [
      '8,700 monthly credits',
      '1,500 images per month',
      '120 videos per month',
      '30s per image generation',
      '450s per video generation',
      'Premium AI models',
      'Priority support',
      'Advanced features',
      'API access',
      'White-label options'
    ]
  }
} as const;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = await req.json();

    if (!planId || !SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    if (!process.env.RAZORPAY_KEY_SECRET || !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      return NextResponse.json({ error: 'Razorpay configuration missing' }, { status: 500 });
    }

    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    const supabase = createSupabaseAdminClient();

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('user_billing')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSubscription) {
      return NextResponse.json({
        error: 'You already have an active subscription. Please cancel your current subscription before upgrading.'
      }, { status: 400 });
    }

    // Create Razorpay plan (create new plan each time to avoid conflicts)
    const razorpayPlanId = `plan_${planId}_${Date.now()}`;
    
    const razorpayPlan = await razorpay.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: plan.name,
        amount: plan.inr_price * 100, // Convert to paise
        currency: 'INR',
        description: plan.description
      }
    });

    console.log('Created Razorpay plan:', razorpayPlan.id);

    // Create subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlan.id,
      customer_notify: 1,
      quantity: 1,
      total_count: 1200, // 100 years (effectively unlimited)
      notes: {
        userId: userId,
        planId: planId,
        credits: plan.credits.toString(),
        plan_name: plan.name
      }
    });

    console.log('Created Razorpay subscription:', subscription.id);

    // Record subscription in database (pending state)
    await supabase.from('user_billing').upsert({
      user_id: userId,
      plan: planId,
      status: 'pending',
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: razorpayPlan.id,
      amount: plan.inr_price,
      currency: 'INR',
      next_billing_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan_id: razorpayPlan.id,
        amount: plan.inr_price,
        currency: 'INR',
        status: subscription.status,
        razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      },
      plan: {
        name: plan.name,
        credits: plan.credits,
        price_usd: plan.usd_price,
        price_inr: plan.inr_price,
        description: plan.description
      }
    });

  } catch (error: any) {
    console.error('Subscription creation error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to create subscription'
    }, { status: 500 });
  }
}

// GET endpoint to retrieve available plans
export async function GET() {
  return NextResponse.json({
    plans: SUBSCRIPTION_PLANS,
    currency: 'INR',
    conversion_rate: '1 USD = 83 INR (approx)',
    note: 'Prices are converted from USD to INR for Indian customers'
  });
}
