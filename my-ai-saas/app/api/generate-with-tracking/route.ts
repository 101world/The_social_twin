export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';
import { runSocialTwinGeneration } from '@/lib/runpod-socialtwin';
import { getRunpodConfig, pickRunpodUrlFromConfig } from '@/lib/supabase';

const CREDIT_COSTS = {
  text: 1,
  image: 5,
  video: 10,
  'image-modify': 3,
};

export async function POST(req: NextRequest) {
  try {
    const authRes = await auth();
    const userId = authRes.userId;
    const getToken = authRes.getToken;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  // We use the admin client (service role) to avoid RLS token issues during server-side generation tracking.
  // Clerk auth still required for user identity; admin key stays server-side only.

  const body = await req.json();
    
    // Log the complete request for debugging
    console.log('=== GENERATION REQUEST DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User ID:', userId);
    console.log('Request Body:', JSON.stringify(body, null, 2));
    console.log('Request Headers:', {
      'content-type': req.headers.get('content-type'),
      'user-agent': req.headers.get('user-agent'),
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'x-real-ip': req.headers.get('x-real-ip'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    
    const {
      prompt,
      mode,
      runpodUrl: runpodUrlRaw,
      provider,
      batch_size = 1,
      userId: bodyUserId,
      attachment,
      ...otherParams
    } = body;

    const cfg = await getRunpodConfig().catch(()=>null);
    const runpodUrl = pickRunpodUrlFromConfig({ provided: (typeof runpodUrlRaw === 'string' ? runpodUrlRaw : undefined), mode, config: cfg }) || '';

    // Validate mode and calculate costs
    if (!mode || !['text', 'image', 'image-modify', 'video'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid generation mode' }, { status: 400 });
    }

    const baseCost = CREDIT_COSTS[mode as keyof typeof CREDIT_COSTS] || CREDIT_COSTS.text;
    const totalCost = baseCost * (batch_size || 1);

  const supabase = createSupabaseAdminClient();

    // Normalize type for allowances (image-modify counts as image)
    const normType = (mode === 'image-modify' ? 'image' : mode) as 'text' | 'image' | 'video';

    // Optional: check per-type allowances (soft by default; enforce if env set)
    let allowanceWarning: any = null;
    try {
      const { data: allowances } = await supabase.rpc('get_user_allowances', { p_user_id: userId });
      const a = Array.isArray(allowances) ? allowances.find((x: any) => x.type === normType) : null;
      if (a) {
        const predictCount = (a.used_daily_count || 0) + (normType !== 'video' ? (batch_size || 1) : 0);
        const reqDurationSec = typeof (body.durationSeconds ?? otherParams.durationSeconds) === 'number' ? Number(body.durationSeconds ?? otherParams.durationSeconds) : 0;
        const predictMinutes = (a.used_daily_minutes || 0) + Math.ceil((normType === 'video' ? reqDurationSec : 0) / 60);
        const overDailyCount = a.allowed_daily_count > 0 && predictCount > a.allowed_daily_count;
        const overDailyMinutes = a.allowed_daily_minutes > 0 && predictMinutes > a.allowed_daily_minutes;
        const shouldEnforce = process.env.ENFORCE_ALLOWANCES === 'true';
        if (overDailyCount || overDailyMinutes) {
          allowanceWarning = { reason: 'daily', overDailyCount, overDailyMinutes, allowance: a, predictCount, predictMinutes };
          if (shouldEnforce) {
            return NextResponse.json({ error: 'Allowance exceeded', details: allowanceWarning }, { status: 429 });
          }
        }
        // Monthly check (soft)
        const predictMonthlyCount = (a.used_monthly_count || 0) + (normType !== 'video' ? (batch_size || 1) : 0);
        const predictMonthlyMinutes = (a.used_monthly_minutes || 0) + Math.ceil((normType === 'video' ? reqDurationSec : 0) / 60);
        const overMonthlyCount = a.allowed_monthly_count > 0 && predictMonthlyCount > a.allowed_monthly_count;
        const overMonthlyMinutes = a.allowed_monthly_minutes > 0 && predictMonthlyMinutes > a.allowed_monthly_minutes;
        if (overMonthlyCount || overMonthlyMinutes) {
          allowanceWarning = { ...(allowanceWarning || {}), reason: 'monthly', overMonthlyCount, overMonthlyMinutes, allowance: a, predictMonthlyCount, predictMonthlyMinutes };
          if (process.env.ENFORCE_ALLOWANCES === 'true') {
            return NextResponse.json({ error: 'Allowance exceeded', details: allowanceWarning }, { status: 429 });
          }
        }
      }
    } catch (e) {
      // If RPC missing or fails, continue without blocking
      console.warn('Allowance check skipped:', (e as any)?.message || e);
    }

    // Check if user has sufficient credits for this generation
    // Check available credits from user_credits table
    const { data: creditData, error: creditError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Credit check error:', creditError);
      // Continue with generation if credit check fails (graceful degradation)
    }

  const availableCredits = (creditData as any)?.credits || 0;
    
    // Soft-block policy: warn but allow generation if credits are low
    const canAfford = availableCredits >= totalCost;
    
    if (!canAfford) {
      // For now, we'll still allow the generation but warn the user
      console.warn(`User ${userId} generating with insufficient credits: ${availableCredits} < ${totalCost}`);
    }

    // Pre-insert generation record to track the attempt
    // Try to infer duration seconds from inputs for video
    const durationSecondsInput = typeof (body.durationSeconds ?? otherParams.durationSeconds) === 'number'
      ? Number(body.durationSeconds ?? otherParams.durationSeconds)
      : undefined;

    const { data: generationRecord, error: insertError } = await supabase
      .from('generations')
      .insert([{
        user_id: userId,
        type: normType,
        prompt: prompt || null,
        duration_seconds: normType === 'video' && durationSecondsInput ? durationSecondsInput : null,
        metadata: {
          cost: totalCost,
          batch_size,
          runpod_url: runpodUrl,
          provider,
          ...otherParams
        }
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create generation record:', insertError);
      return NextResponse.json({ error: 'Failed to create generation record' }, { status: 500 });
    }

    // Now perform the generation directly (no internal HTTP), then update records
    try {
      const apiKey = process.env.RUNPOD_API_KEY || undefined;
      const out = await runSocialTwinGeneration({
        mode: mode as any,
        prompt,
        negative: typeof otherParams?.negative === 'string' ? otherParams.negative : undefined,
        width: typeof otherParams?.width === 'number' ? otherParams.width : undefined,
        height: typeof otherParams?.height === 'number' ? otherParams.height : undefined,
        batch_size,
        steps: typeof otherParams?.steps === 'number' ? otherParams.steps : undefined,
        cfg: typeof otherParams?.cfg === 'number' ? otherParams.cfg : undefined,
        seed: typeof otherParams?.seed === 'number' ? otherParams.seed : undefined,
        imageUrl: typeof (body as any)?.imageUrl === 'string' ? (body as any).imageUrl : undefined,
        attachment,
        runpodUrl,
        apiKey,
        userId,
        ckpt_name: typeof (otherParams as any)?.ckpt_name === 'string' ? (otherParams as any).ckpt_name : undefined,
      });

      const urls: string[] = out.urls || [];
      const batchImages: string[] = out.images || [];
      const batchVideos: string[] = out.videos || [];
      const aiImage: string | undefined = urls.find(u => !/\.(mp4|webm)(\?|$)/i.test(u));
      const aiVideo: string | undefined = urls.find(u => /\.(mp4|webm)(\?|$)/i.test(u));
      const firstVideo = (batchVideos && batchVideos.length ? batchVideos[0] : undefined);

      // Update generation record with successful result
  const resultUrl = aiImage || aiVideo || firstVideo || null;
  const content = null;
  const respDurationSec = undefined;

    await supabase
        .from('generations')
        .update({
          result_url: resultUrl,
          content,
          metadata: {
            ...generationRecord.metadata,
            status: 'completed',
            batch_results: {
              images: batchImages,
              videos: batchVideos,
              urls
            }
      },
      duration_seconds: normType === 'video' ? ((generationRecord as any)?.duration_seconds || respDurationSec || null) : null
        })
        .eq('id', generationRecord.id);

      // Deduct credits if generation was successful
      let didDeduct = false;
      let newBalance: number | null = null;
      if (canAfford) {
        const { data: bal, error: deductError } = await supabase.rpc('deduct_credits_simple', {
          p_user_id: userId,
          p_amount: totalCost
        });

        if (deductError) {
          console.error('Failed to deduct credits:', deductError);
        } else if (typeof bal === 'number') {
          didDeduct = true;
          newBalance = bal;
        }
      }

      // Return the successful generation result with credit info
      return NextResponse.json({
  ok: true,
  urls,
  images: batchImages,
  videos: batchVideos,
        creditInfo: {
          cost: totalCost,
          didDeduct,
          remainingCredits: didDeduct ? (newBalance as number) : availableCredits,
          generationId: generationRecord.id
        },
        allowanceWarning
      });

    } catch (generationError) {
      console.error('Generation request failed:', generationError);

      // Update generation record with error
      await supabase
        .from('generations')
        .update({
          metadata: {
            ...generationRecord.metadata,
            error: generationError instanceof Error ? generationError.message : 'Unknown error',
            status: 'failed'
          }
        })
        .eq('id', generationRecord.id);

  return NextResponse.json({ error: 'Generation request failed', details: generationError instanceof Error ? generationError.message : 'Unknown error' }, { status: 500 });
    }

  } catch (err) {
    console.error('Generate with tracking error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
