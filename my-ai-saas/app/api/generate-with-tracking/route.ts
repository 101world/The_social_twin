export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

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

    const DEFAULT_IMAGE_RUNPOD = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || 'https://64e5p2jm3e5r3k-3001.proxy.runpod.net/';
    const runpodUrl = (typeof runpodUrlRaw === 'string' && runpodUrlRaw) ? runpodUrlRaw : DEFAULT_IMAGE_RUNPOD;

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

    // Now make the actual generation request to the existing social-twin/generate endpoint
    try {
      const generatePayload = {
        prompt,
        mode,
  runpodUrl,
        provider,
        batch_size,
        userId,
        attachment,
        ...otherParams
      };
      
      // Resolve correct origin (Vercel can differ between req.nextUrl.origin and public URL)
      const inferredOrigin = (() => {
        try {
          const u = new URL(req.url);
          return `${u.protocol}//${u.host}`;
        } catch { /* ignore */ }
        return req.nextUrl.origin;
      })();
      const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
      const baseOrigin = vercelOrigin || inferredOrigin || req.nextUrl.origin;
      const internalGenerateUrl = `${baseOrigin}/api/social-twin/generate`;

      console.log('=== OUTGOING REQUEST TO SOCIAL-TWIN/GENERATE ===');
      console.log('Resolved Origin:', baseOrigin);
      console.log('URL:', internalGenerateUrl);
      console.log('Headers:', {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      });
      console.log('Payload:', JSON.stringify(generatePayload, null, 2));
      const generateResponse = await fetch(internalGenerateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify(generatePayload),
      });

      console.log('=== RESPONSE FROM SOCIAL-TWIN/GENERATE ===');
  const respHeaders = Object.fromEntries(generateResponse.headers.entries());
  console.log('Status:', generateResponse.status);
  console.log('Status Text:', generateResponse.statusText);
  console.log('Headers:', respHeaders);

      // Better error handling for HTML responses
      const generateResponseText = await generateResponse.text();
      console.log('Raw Response (first 500 chars):', generateResponseText.substring(0, 500));
      
      let generateResult;
      
      try {
        generateResult = JSON.parse(generateResponseText);
        console.log('Parsed Response:', JSON.stringify(generateResult, null, 2));
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
          // Likely hit a non-API route (Next.js HTML) instead of our generate route
          const isHtml = (respHeaders['content-type'] || '').includes('text/html')
            || generateResponseText.trim().startsWith('<!DOCTYPE html>')
            || generateResponseText.trim().startsWith('<html>');

          const hint = isHtml
            ? 'HTML came from your app, not RunPod. Your API route may be missing in this deployment (wrong project root) or origin was resolved incorrectly.'
            : 'Generate API returned invalid JSON.';

          // Fallback: call RunPod directly for image generation if internal route returned HTML
          if (isHtml && mode === 'image' && typeof runpodUrl === 'string' && runpodUrl) {
            console.warn('Internal API returned HTML; attempting direct RunPod fallback...');

            async function directRunpodImage(): Promise<{ images: string[]; videos: string[]; runpod: any }> {
              const base = runpodUrl.replace(/\/$/, '');
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
              };
              const apiKey = process.env.RUNPOD_API_KEY;
              if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
                headers['x-api-key'] = apiKey;
                headers['X-RunPod-Api-Key'] = apiKey;
              }

              // Try to auto-pick a checkpoint via /object_info
              let ckptName = 'sd_xl_base_1.0.safetensors';
              try {
                const oi = await fetch(`${base}/object_info`, { headers: { 'Accept': 'application/json' } });
                if (oi.ok) {
                  const oij = await oi.json().catch(() => null as any);
                  const cand = oij?.CheckpointLoaderSimple || oij?.CheckpointLoader || oij?.LoadCheckpoint;
                  const req = cand?.input?.required || cand?.input?.inputs || {};
                  const opt = cand?.input?.optional || {};
                  const getChoices = (slot: any) => Array.isArray(slot) && slot.length > 1 && slot[1] && typeof slot[1] === 'object' ? (slot[1].choices || slot[1].values || []) : [];
                  const choices = getChoices(req?.ckpt_name) || getChoices(opt?.ckpt_name) || [];
                  if (Array.isArray(choices) && choices.length) {
                    ckptName = (choices.find((x: any) => typeof x === 'string' && /xl/i.test(x)) || choices[0]) as string;
                  }
                }
              } catch {}

              const userSeed = typeof (otherParams?.seed) === 'number' ? otherParams.seed : Math.floor(Math.random() * 1000000);
              const width = typeof (otherParams?.width) === 'number' ? otherParams.width : 1024;
              const height = typeof (otherParams?.height) === 'number' ? otherParams.height : 1024;
              const steps = typeof (otherParams?.steps) === 'number' ? Math.max(1, Math.round(otherParams.steps as number)) : 20;
              const cfg = typeof (otherParams?.cfg) === 'number' ? otherParams.cfg : 8;
              const batch = typeof (batch_size) === 'number' ? batch_size : 1;
              const negative = typeof (otherParams?.negative) === 'string' ? otherParams.negative : '';

              const graph: any = {
                "1": { inputs: { ckpt_name: ckptName }, class_type: "CheckpointLoaderSimple" },
                "2": { inputs: { text: prompt, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
                "3": { inputs: { text: negative, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
                "4": { inputs: { width, height, batch_size: batch }, class_type: "EmptyLatentImage" },
                "5": { inputs: { seed: userSeed, steps, cfg, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0] }, class_type: "KSampler" },
                "6": { inputs: { samples: ["5", 0], vae: ["1", 2] }, class_type: "VAEDecode" },
                "7": { inputs: { filename_prefix: `user_${userId}_${Date.now()}`, images: ["6", 0] }, class_type: "SaveImage" }
              };

              const clientId = `user_${userId || 'anon'}`;
              const submit = await fetch(`${base}/prompt`, { method: 'POST', headers, body: JSON.stringify({ prompt: graph, client_id: clientId }) });
              const submitText = await submit.text();
              if (!submit.ok) throw new Error(`RunPod submit failed ${submit.status}: ${submitText.slice(0, 200)}`);
              let sj: any = {};
              try { sj = JSON.parse(submitText); } catch {}
              const promptId: string | undefined = sj?.prompt_id || sj?.id || sj?.promptId;
              if (!promptId) throw new Error('Missing prompt_id in RunPod response');

              const images: string[] = [];
              const videos: string[] = [];
              for (let i = 0; i < 150; i++) {
                const h = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, { headers });
                const ht = await h.text();
                let hj: any = {};
                try { hj = ht ? JSON.parse(ht) : {}; } catch {}
                const bag: any = hj?.[promptId]?.outputs || hj?.outputs || {};
                try {
                  for (const k of Object.keys(bag)) {
                    const node = bag[k];
                    if (node?.images) {
                      for (const img of node.images) {
                        const fn = img?.filename ?? img?.name ?? img;
                        const sub = img?.subfolder ?? '';
                        const t = img?.type ?? 'output';
                        const url = `${base}/view?filename=${encodeURIComponent(fn)}&subfolder=${encodeURIComponent(sub)}&type=${encodeURIComponent(t)}`;
                        if (/\.(mp4|webm)(\?|$)/i.test(String(fn))) videos.push(url); else images.push(url);
                      }
                    }
                    if (node?.videos) {
                      for (const vid of node.videos) {
                        const fn = vid?.filename ?? vid?.name ?? vid;
                        const sub = vid?.subfolder ?? '';
                        const t = vid?.type ?? 'output';
                        const url = `${base}/view?filename=${encodeURIComponent(fn)}&subfolder=${encodeURIComponent(sub)}&type=${encodeURIComponent(t)}`;
                        videos.push(url);
                      }
                    }
                  }
                } catch {}
                if (images.length || videos.length) break;
                await new Promise(r => setTimeout(r, 2000));
              }
              return { images, videos, runpod: sj };
            }

            try {
              const out = await directRunpodImage();
              const urls = out.images.length ? out.images : out.videos;
              const resultUrl = urls[0] || null;

              await supabase
                .from('generations')
                .update({
                  result_url: resultUrl,
                  content: null,
                  metadata: { ...(generationRecord as any).metadata, status: 'completed', batch_results: { images: out.images, videos: out.videos, urls } },
                  duration_seconds: null
                })
                .eq('id', generationRecord.id);

              // Deduct credits if affordable
              let didDeduct = false;
              let newBalance: number | null = null;
              if (canAfford) {
                const { data: bal, error: deductError } = await supabase.rpc('deduct_credits_simple', { p_user_id: userId, p_amount: totalCost });
                if (!deductError && typeof bal === 'number') { didDeduct = true; newBalance = bal; }
              }

              return NextResponse.json({
                ok: true,
                url: resultUrl,
                urls,
                images: out.images,
                videos: out.videos,
                runpod: out.runpod,
                creditInfo: { cost: totalCost, didDeduct, remainingCredits: didDeduct ? (newBalance as number) : availableCredits, generationId: generationRecord.id },
                allowanceWarning
              });
            } catch (fbErr) {
              console.error('Direct RunPod fallback failed:', fbErr);
              return NextResponse.json({
                error: 'Generation request failed',
                details: `${hint} Status: ${generateResponse.status}. Origin: ${baseOrigin}`,
                runpodStatus: generateResponse.status,
                isHtmlResponse: isHtml,
                responsePreview: generateResponseText.substring(0, 200),
              }, { status: 502 });
            }
          }

          return NextResponse.json({
            error: 'Generation request failed',
            details: `${hint} Status: ${generateResponse.status}. Origin: ${baseOrigin}`,
            runpodStatus: generateResponse.status,
            isHtmlResponse: isHtml,
            responsePreview: generateResponseText.substring(0, 200),
          }, { status: 502 });
      }

      if (!generateResponse.ok) {
        // Update generation record with error
        await supabase
          .from('generations')
          .update({
            metadata: {
              ...generationRecord.metadata,
              error: generateResult.error || 'Generation failed',
              status: 'failed'
            }
          })
          .eq('id', generationRecord.id);

        return NextResponse.json(generateResult, { status: generateResponse.status });
      }

      // Extract URLs from the successful response
      const data = generateResult.runpod ?? generateResult;
      const urls: string[] = generateResult.urls || (data?.urls || []);
      const batchImages: string[] = generateResult.images || (data?.images || []);
      const batchVideos: string[] = generateResult.videos || (data?.videos || []);
      const aiText: string | undefined = data?.text ?? data?.output ?? data?.message;
      const rawFromData: string | undefined = (data?.imageUrl ?? data?.image ?? data?.url) || undefined;
      const isVideoLike = (u?: string) => Boolean(u && /\.(mp4|webm)(\?|$)/i.test(u));
      const aiVideoFromData = isVideoLike(rawFromData) ? rawFromData : undefined;
      const aiImageFromData = !isVideoLike(rawFromData) ? rawFromData : undefined;
      const aiImage: string | undefined = aiImageFromData || urls.find(u => !isVideoLike(u));
      const aiVideo: string | undefined = (data?.videoUrl ?? data?.video ?? aiVideoFromData);
      const firstVideo = (batchVideos && batchVideos.length ? batchVideos[0] : undefined);

      // Update generation record with successful result
      const resultUrl = aiImage || aiVideo || firstVideo || null;
      const content = aiText || null;

      // Try to extract a duration from provider response
      const respDurationSec = ((): number | undefined => {
        const d = (data && typeof data === 'object') ? data : undefined;
        const ms = (d as any)?.duration_ms ?? (d as any)?.video_duration_ms ?? (d as any)?.metadata?.duration_ms;
        if (typeof ms === 'number') return Math.round(ms / 1000);
        const s = (d as any)?.duration_seconds ?? (d as any)?.video_duration_seconds ?? (d as any)?.metadata?.duration_seconds;
        if (typeof s === 'number') return s;
        return undefined;
      })();

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
        ...generateResult,
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

      return NextResponse.json(
        { error: 'Generation request failed', details: generationError instanceof Error ? generationError.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (err) {
    console.error('Generate with tracking error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
