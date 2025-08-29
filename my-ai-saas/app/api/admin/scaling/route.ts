export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = userId === process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
                    process.env.ADMIN_USER_IDS?.split(',').includes(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    // Get all RunPod configurations
    const { data: runpodConfigs } = await supabase
      .from('runpod_config')
      .select('*')
      .eq('is_active', true);

    // Health check each RunPod endpoint
    const healthChecks = await Promise.all(
      (runpodConfigs || []).map(async (config) => {
        const startTime = Date.now();
        let responseTime = 0;
        let isHealthy = false;
        let error = null;

        try {
          const response = await fetch(config.url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(10000)
          });
          responseTime = Date.now() - startTime;
          isHealthy = response.ok;
        } catch (err: any) {
          responseTime = Date.now() - startTime;
          error = err.message;
        }

        return {
          id: config.id,
          mode: config.mode,
          url: config.url,
          isHealthy,
          responseTime,
          error,
          lastChecked: new Date().toISOString()
        };
      })
    );

    // Get recent generation stats for load balancing
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentGenerations } = await supabase
      .from('media_generations')
      .select('runpod_url, created_at')
      .gte('created_at', lastHour.toISOString());

    // Calculate load per endpoint
    const loadStats: { [url: string]: number } = {};
    recentGenerations?.forEach(gen => {
      if (gen.runpod_url) {
        loadStats[gen.runpod_url] = (loadStats[gen.runpod_url] || 0) + 1;
      }
    });

    // Generate scaling recommendations
    const unhealthyPods = healthChecks.filter(h => !h.isHealthy);
    const avgResponseTime = healthChecks.reduce((sum, h) => sum + h.responseTime, 0) / healthChecks.length;
    const overloadedPods = healthChecks.filter(h => loadStats[h.url] > 50); // More than 50 requests per hour

    const recommendations = [];

    if (unhealthyPods.length > 0) {
      recommendations.push({
        type: 'critical',
        message: `${unhealthyPods.length} RunPod endpoint(s) are unhealthy and need immediate attention`,
        action: 'Replace or restart unhealthy pods',
        affected: unhealthyPods.map(p => p.mode)
      });
    }

    if (avgResponseTime > 3000) {
      recommendations.push({
        type: 'warning',
        message: `Average response time (${Math.round(avgResponseTime)}ms) is high`,
        action: 'Consider adding more pods or upgrading instances',
        affected: []
      });
    }

    if (overloadedPods.length > 0) {
      recommendations.push({
        type: 'info',
        message: `${overloadedPods.length} pod(s) are handling high load`,
        action: 'Consider load balancing or adding more pods',
        affected: overloadedPods.map(p => p.mode)
      });
    }

    // Auto-scaling suggestion
    const totalLoad = Object.values(loadStats).reduce((sum, load) => sum + load, 0);
    const optimalPods = Math.max(1, Math.ceil(totalLoad / 30)); // Target 30 requests per hour per pod
    const currentPods = runpodConfigs?.length || 0;

    if (optimalPods > currentPods) {
      recommendations.push({
        type: 'suggestion',
        message: `Based on current load, consider adding ${optimalPods - currentPods} more pod(s)`,
        action: 'Add new RunPod instances to handle increased demand',
        affected: []
      });
    }

    const scaling = {
      healthChecks,
      loadStats,
      recommendations,
      summary: {
        totalPods: currentPods,
        healthyPods: healthChecks.filter(h => h.isHealthy).length,
        unhealthyPods: unhealthyPods.length,
        avgResponseTime: Math.round(avgResponseTime),
        totalLoad,
        optimalPods
      }
    };

    return NextResponse.json(scaling);
  } catch (error) {
    console.error('GET /api/admin/scaling error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = userId === process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
                    process.env.ADMIN_USER_IDS?.split(',').includes(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, podUrl, newPodUrl } = body;

    const supabase = createSupabaseAdminClient();

    if (action === 'replace_unhealthy') {
      // Find unhealthy pod and replace it
      const { data: unhealthyPods } = await supabase
        .from('runpod_config')
        .select('*')
        .eq('is_active', true);

      for (const pod of unhealthyPods || []) {
        try {
          await fetch(pod.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        } catch {
          // Pod is unhealthy, replace it
          if (newPodUrl) {
            await supabase
              .from('runpod_config')
              .update({
                url: newPodUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', pod.id);
            break;
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Scaling action completed' });
  } catch (error) {
    console.error('POST /api/admin/scaling error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
