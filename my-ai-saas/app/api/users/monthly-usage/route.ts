export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(_req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let jwt: string | null = null;
    try { 
      jwt = await getToken({ template: 'supabase' }); 
    } catch { 
      jwt = null; 
    }

    const supabase = jwt ? createSupabaseClient(jwt) : createSupabaseAdminClient();

    // Get current month start and end
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Count image and video generations for current month
    const { data: imageCount, error: imageError } = await supabase
      .from('media_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'image')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    const { data: videoCount, error: videoError } = await supabase
      .from('media_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'video')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    if (imageError || videoError) {
      console.error('Usage fetch error:', imageError || videoError);
      return NextResponse.json({ 
        usage: { images: 0, videos: 0 },
        period: { start: monthStart, end: monthEnd },
        error: 'Failed to fetch usage data'
      });
    }

    // Get user's plan for limit checking
    const { data: billingData } = await supabase
      .from('user_billing')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle();

    const plan = billingData?.plan?.toLowerCase().replace(' ', '_') || '';
    
    // Plan limits
    const PLAN_LIMITS = {
      'one_t': { maxImages: 200, maxVideos: 12 },
      'one_z': { maxImages: 700, maxVideos: 55 },
      'one_pro': { maxImages: 1500, maxVideos: 120 }
    };

    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || null;

    return NextResponse.json({
      usage: {
        images: Number(imageCount) || 0,
        videos: Number(videoCount) || 0
      },
      limits: planLimits,
      plan: billingData?.plan || 'none',
      period: {
        start: monthStart,
        end: monthEnd,
        month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
      },
      remaining: planLimits ? {
        images: Math.max(0, planLimits.maxImages - (Number(imageCount) || 0)),
        videos: Math.max(0, planLimits.maxVideos - (Number(videoCount) || 0))
      } : null
    });

  } catch (error: any) {
    console.error('Monthly usage API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      usage: { images: 0, videos: 0 }
    }, { status: 500 });
  }
}
