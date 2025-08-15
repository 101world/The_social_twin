import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createSupabaseClient } from '@/lib/supabase/client';

// Credit costs for different generation types
const CREDIT_COSTS = {
  'text': 1,
  'image': 5,
  'video': 10,
  'image-modify': 3
};

export async function POST(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topicId } = params;
    const { type, prompt, generationParams = {} } = await request.json();
    
    if (!type || !['image', 'video', 'image-modify'].includes(type)) {
      return NextResponse.json({ error: 'Invalid generation type' }, { status: 400 });
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    
    // Verify topic exists and belongs to user
    const { data: topic, error: topicError } = await supabase
      .from('chat_topics')
      .select('id')
      .eq('id', topicId)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .single();

    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Check user credits
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credits, subscription_plan')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const requiredCredits = CREDIT_COSTS[type as keyof typeof CREDIT_COSTS];
    if (user.credits < requiredCredits) {
      return NextResponse.json({ 
        error: 'Insufficient credits', 
        required: requiredCredits, 
        available: user.credits 
      }, { status: 402 });
    }

    // Create media generation record
    const { data: mediaGeneration, error: mediaError } = await supabase
      .from('media_generations')
      .insert({
        topic_id: topicId,
        user_id: userId,
        type,
        prompt: prompt.trim(),
        credits_used: requiredCredits,
        status: 'pending',
        generation_params: generationParams
      })
      .select()
      .single();

    if (mediaError) {
      console.error('Error creating media generation record:', mediaError);
      return NextResponse.json({ error: 'Failed to create generation record' }, { status: 500 });
    }

    // Deduct credits using the database function
    const { data: creditResult, error: creditError } = await supabase
      .rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: requiredCredits,
        p_description: `${type} generation: ${prompt.substring(0, 50)}...`,
        p_reference_id: mediaGeneration.id
      });

    if (creditError || !creditResult) {
      console.error('Error deducting credits:', creditError);
      // Rollback media generation record
      await supabase
        .from('media_generations')
        .delete()
        .eq('id', mediaGeneration.id);
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // Update topic's updated_at timestamp
    await supabase
      .from('chat_topics')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', topicId);

    // TODO: In production, this would be handled by a background job/queue
    // For now, we'll simulate the generation process
    try {
      // Simulate AI generation (replace with actual RunPod API call)
      const result = await simulateAIGeneration(type, prompt, generationParams);
      
      // Update the media generation record with results
      const { error: updateError } = await supabase
        .from('media_generations')
        .update({
          result_url: result.url,
          thumbnail_url: result.thumbnail,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', mediaGeneration.id);

      if (updateError) {
        console.error('Error updating media generation:', updateError);
      }

      return NextResponse.json({
        ...mediaGeneration,
        result_url: result.url,
        thumbnail_url: result.thumbnail,
        status: 'completed'
      });
    } catch (generationError) {
      // Update status to failed
      await supabase
        .from('media_generations')
        .update({
          status: 'failed',
          error_message: generationError instanceof Error ? generationError.message : 'Generation failed'
        })
        .eq('id', mediaGeneration.id);

      return NextResponse.json({ 
        error: 'Generation failed', 
        generation_id: mediaGeneration.id 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/topics/[topicId]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topicId } = params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = createSupabaseClient();
    
    // Verify topic exists and belongs to user
    const { data: topic, error: topicError } = await supabase
      .from('chat_topics')
      .select('id')
      .eq('id', topicId)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .single();

    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Get media generations with pagination
    const { data: media, error, count } = await supabase
      .from('media_generations')
      .select('*', { count: 'exact' })
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching media generations:', error);
      return NextResponse.json({ error: 'Failed to fetch media generations' }, { status: 500 });
    }

    return NextResponse.json({
      media: media || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in GET /api/topics/[topicId]/media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Simulate AI generation (replace with actual RunPod API calls)
async function simulateAIGeneration(type: string, prompt: string, params: any) {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate mock URLs (replace with actual RunPod API integration)
  const mockUrl = `https://example.com/generated/${type}/${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;
  const mockThumbnail = type === 'video' ? `https://example.com/thumbnails/${Date.now()}.jpg` : mockUrl;
  
  return {
    url: mockUrl,
    thumbnail: mockThumbnail
  };
}
