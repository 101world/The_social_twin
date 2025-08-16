export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient } from '@/lib/supabase';

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

    const jwt = await getToken({ template: 'supabase' });
    if (!jwt) {
      return NextResponse.json({ error: 'No Supabase token' }, { status: 401 });
    }

    const body = await req.json();
    const {
      prompt,
      mode,
      runpodUrl,
      provider,
      batch_size = 1,
      userId: bodyUserId,
      attachment,
      ...otherParams
    } = body;

    // Validate mode and calculate costs
    if (!mode || !['text', 'image', 'image-modify', 'video'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid generation mode' }, { status: 400 });
    }

    const baseCost = CREDIT_COSTS[mode as keyof typeof CREDIT_COSTS] || CREDIT_COSTS.text;
    const totalCost = baseCost * (batch_size || 1);

    const supabase = createSupabaseClient(jwt);

    // Check if user has sufficient credits for this generation
    const { data: creditData, error: creditError } = await supabase
      .from('user_billing')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Credit check error:', creditError);
      // Continue with generation if credit check fails (graceful degradation)
    }

    const availableCredits = creditData?.credits_remaining || 0;
    
    // Soft-block policy: warn but allow generation if credits are low
    const canAfford = availableCredits >= totalCost;
    
    if (!canAfford) {
      // For now, we'll still allow the generation but warn the user
      console.warn(`User ${userId} generating with insufficient credits: ${availableCredits} < ${totalCost}`);
    }

    // Pre-insert generation record to track the attempt
    const { data: generationRecord, error: insertError } = await supabase
      .from('generations')
      .insert([{
        user_id: userId,
        type: mode,
        prompt: prompt || null,
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
      const generateResponse = await fetch(`${req.nextUrl.origin}/api/social-twin/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          prompt,
          mode,
          runpodUrl,
          provider,
          batch_size,
          userId,
          attachment,
          ...otherParams
        }),
      });

      const generateResult = await generateResponse.json();

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
          }
        })
        .eq('id', generationRecord.id);

      // Deduct credits if generation was successful
      if (canAfford) {
        const { error: deductError } = await supabase.rpc('deduct_credits_simple', {
          p_user_id: userId,
          p_amount: totalCost
        });

        if (deductError) {
          console.error('Failed to deduct credits:', deductError);
          // Don't fail the response for credit deduction errors
        }
      }

      // Return the successful generation result with credit info
      return NextResponse.json({
        ...generateResult,
        creditInfo: {
          cost: totalCost,
          remainingCredits: Math.max(0, availableCredits - totalCost),
          generationId: generationRecord.id
        }
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
