export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

const ADMIN_CODE = '9820571837';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const accessCode = url.searchParams.get('code');

    if (!accessCode || accessCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    // Get user growth metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total users
    const { count: totalUsers } = await supabase
      .from('media_generations')
      .select('*', { count: 'exact', head: true });

    // Active users (generated content in last 7 days)
    const { data: recentGenerations } = await supabase
      .from('media_generations')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());

    const activeUsers = new Set(recentGenerations?.map(g => g.user_id) || []).size;

    // Daily generation count for the last 30 days
    const { data: dailyStats } = await supabase
      .from('media_generations')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    // Group by day
    const dailyCounts: { [key: string]: number } = {};
    dailyStats?.forEach(gen => {
      const date = new Date(gen.created_at).toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    // Calculate growth rate
    const last7Days = Object.entries(dailyCounts)
      .slice(-7)
      .reduce((sum, [, count]) => sum + count, 0);
    const previous7Days = Object.entries(dailyCounts)
      .slice(-14, -7)
      .reduce((sum, [, count]) => sum + count, 0);

    const growthRate = previous7Days > 0 ? ((last7Days - previous7Days) / previous7Days) * 100 : 0;

    // Get current RunPod configurations
    const { data: runpodConfigs } = await supabase
      .from('runpod_config')
      .select('*')
      .eq('is_active', true);

    // Calculate scaling recommendations
    const avgDailyGenerations = last7Days / 7;
    const recommendedPods = Math.max(1, Math.ceil(avgDailyGenerations / 100)); // Assume 100 generations per pod per day capacity

    const analytics = {
      userMetrics: {
        totalUsers: totalUsers || 0,
        activeUsers,
        growthRate: Math.round(growthRate * 100) / 100,
        trend: growthRate > 10 ? 'growing' : growthRate > -10 ? 'stable' : 'declining'
      },
      generationMetrics: {
        last7Days,
        previous7Days,
        avgDailyGenerations: Math.round(avgDailyGenerations),
        dailyBreakdown: Object.entries(dailyCounts).map(([date, count]) => ({
          date,
          count
        }))
      },
      scaling: {
        currentPods: runpodConfigs?.length || 0,
        recommendedPods,
        needsScaling: recommendedPods > (runpodConfigs?.length || 0),
        scalingUrgency: recommendedPods > (runpodConfigs?.length || 0) * 1.5 ? 'high' : 'medium'
      },
      systemHealth: {
        runpodConfigs: runpodConfigs?.length || 0,
        lastUpdated: new Date().toISOString()
      }
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('GET /api/admin/analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
