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
    console.log('Request Headers:', {
      'content-type': req.headers.get('content-type'),
      'user-agent': req.headers.get('user-agent'),
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'x-real-ip': req.headers.get('x-real-ip'),
      'x-mobile-request': req.headers.get('x-mobile-request'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    console.log('Request Body:', JSON.stringify(body, null, 2));
    
    // Mobile-specific debugging
    const isMobileRequest = req.headers.get('x-mobile-request') === 'true' || body.isMobile === true;
    if (isMobileRequest) {
      console.log('📱 MOBILE REQUEST DETECTED ON SERVER');
      console.log('📱 Mobile User Agent:', body.userAgent || req.headers.get('user-agent'));
      console.log('📱 Mobile Payload Size:', JSON.stringify(body).length, 'bytes');
    }
    
    const {
      prompt,
      mode,
      runpodUrl: runpodUrlRaw,
      provider,
      batch_size = 1,
      userId: bodyUserId,
      attachment,
      saveToLibrary = true, // Default to true to save in library
      ...otherParams
    } = body;

    const cfg = await getRunpodConfig().catch(()=>null);
    const runpodUrl = pickRunpodUrlFromConfig({ provided: (typeof runpodUrlRaw === 'string' ? runpodUrlRaw : undefined), mode, config: cfg });

    // Log URL resolution for debugging
    console.log('URL Resolution Debug:', {
      provided: runpodUrlRaw,
      mode,
      config: cfg,
      resolved_url: runpodUrl,
      env_fallback: process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL
    });

    // Log dropdown parameters
    console.log('Dropdown Parameters:', {
      lora: otherParams?.lora,
      lora_scale: otherParams?.lora_scale,
  lora_character: otherParams?.lora_character,
  lora_character_scale: otherParams?.lora_character_scale,
  lora_effect: otherParams?.lora_effect,
  lora_effect_scale: otherParams?.lora_effect_scale,
      aspect_ratio: otherParams?.aspect_ratio,
      guidance: otherParams?.guidance,
      batch_size: batch_size
    });

    if (!runpodUrl) {
      return NextResponse.json({ error: 'No RunPod URL configured for mode: ' + mode }, { status: 500 });
    }

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
      .from('media_generations')
      .insert([{
        user_id: userId,
        type: normType,
        prompt: prompt || null,
        status: 'pending',
        generation_params: {
          cost: totalCost,
          batch_size,
          runpod_url: runpodUrl,
          provider,
          duration_seconds: normType === 'video' && durationSecondsInput ? durationSecondsInput : null,
          saveToLibrary: saveToLibrary, // Store in generation_params instead
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
        // Add dropdown parameters
        lora: typeof otherParams?.lora === 'string' ? otherParams.lora : undefined,
        lora_scale: typeof otherParams?.lora_scale === 'number' ? otherParams.lora_scale : undefined,
  lora_character: typeof otherParams?.lora_character === 'string' ? otherParams.lora_character : undefined,
  lora_character_scale: typeof otherParams?.lora_character_scale === 'number' ? otherParams.lora_character_scale : undefined,
  lora_effect: typeof otherParams?.lora_effect === 'string' ? otherParams.lora_effect : undefined,
  lora_effect_scale: typeof otherParams?.lora_effect_scale === 'number' ? otherParams.lora_effect_scale : undefined,
        aspect_ratio: typeof otherParams?.aspect_ratio === 'string' ? otherParams.aspect_ratio : undefined,
        guidance: typeof otherParams?.guidance === 'number' ? otherParams.guidance : undefined,
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
  
  // Determine media type and URL
  const mediaType = aiVideo || firstVideo ? 'video' : (aiImage ? 'image' : null);
  const mediaUrl = resultUrl;

    await supabase
        .from('media_generations')
        .update({
          result_url: resultUrl,
          media_url: mediaUrl,
          media_type: mediaType,
          thumbnail_url: resultUrl,
          status: 'completed',
          completed_at: new Date().toISOString(),
          generation_params: {
            ...generationRecord.generation_params,
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
      const timeoutWarning = out.runpod?.timeout_warning ? {
        message: "Generation may have timed out - if no images were generated, please try again",
        elapsed_ms: out.runpod.elapsed_ms
      } : undefined;
      
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
        allowanceWarning,
        timeoutWarning
      });

    } catch (generationError) {
      console.error('Generation request failed:', generationError);

      // Update generation record with error
      await supabase
        .from('media_generations')
        .update({
          status: 'failed',
          error_message: generationError instanceof Error ? generationError.message : 'Unknown error',
          generation_params: {
            ...generationRecord.generation_params,
            error: generationError instanceof Error ? generationError.message : 'Unknown error',
            status: 'failed'
          }
        })
        .eq('id', generationRecord.id);

  return NextResponse.json({ 
    error: 'Generation request failed', 
    details: generationError instanceof Error ? generationError.message : 'Unknown error' 
  }, { status: 500 });
    }

  } catch (err) {
    console.error('Generate with tracking error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
