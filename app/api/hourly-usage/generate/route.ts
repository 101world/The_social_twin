import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// HOURLY SESSION AI GENERATION
// POST /api/hourly-usage/generate
// For users with active hourly sessions - unlimited generations
// ============================================
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { prompt, recipe_id, generation_type = 'recipe' } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Check if user has an active hourly session
    const { data: sessionData, error: sessionError } = await supabase
      .from('hourly_usage_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { 
          error: 'No active hourly session found',
          message: 'Please start an hourly session to use unlimited AI generation',
          required_action: 'start_hourly_session'
        },
        { status: 402 }
      );
    }

    console.log(`🔥 Hourly generation started for user ${userId} in session ${sessionData.id}`);

    // Call RunPod API for AI generation
    const runpodResponse = await fetch(`${process.env.RUNPOD_ENDPOINT_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        }
      }),
    });

    if (!runpodResponse.ok) {
      console.error('RunPod API error:', await runpodResponse.text());
      return NextResponse.json(
        { error: 'AI generation service unavailable' },
        { status: 503 }
      );
    }

    const runpodResult = await runpodResponse.json();
    const generatedContent = runpodResult.output?.choices?.[0]?.text || 
                           runpodResult.output?.text || 
                           'Generation completed successfully';

    // Update session with generation count (no credit deduction for hourly users)
    const { error: updateError } = await supabase
      .from('hourly_usage_sessions')
      .update({
        generations_count: sessionData.generations_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionData.id);

    if (updateError) {
      console.error('Error updating session generation count:', updateError);
      // Don't fail the request for this
    }

    // Log the generation for tracking
    const { error: logError } = await supabase
      .from('user_generations')
      .insert({
        user_id: userId,
        prompt: prompt.substring(0, 500), // Truncate long prompts
        response: generatedContent.substring(0, 1000), // Truncate long responses
        model_used: 'hourly_unlimited',
        credits_used: 0, // No credits deducted for hourly users
        recipe_id: recipe_id || null,
        generation_type: generation_type,
        session_id: sessionData.id,
        metadata: {
          session_type: 'hourly_unlimited',
          hour_rate: 15.00,
          generation_number: sessionData.generations_count + 1
        }
      });

    if (logError) {
      console.error('Error logging generation:', logError);
      // Don't fail the request for this
    }

    console.log(`✅ Hourly generation completed for user ${userId}`);

    return NextResponse.json({
      success: true,
      content: generatedContent,
      session_info: {
        session_id: sessionData.id,
        generations_in_session: sessionData.generations_count + 1,
        session_start: sessionData.session_start,
        hourly_rate: '$15/hour',
        unlimited: true
      },
      generation_details: {
        model: 'Premium AI Model',
        generation_type: generation_type,
        credits_used: 0,
        billing_model: 'hourly_unlimited'
      }
    });

  } catch (error) {
    console.error('Error in hourly AI generation:', error);
    return NextResponse.json(
      { error: 'Generation failed' },
      { status: 500 }
    );
  }
}

// ============================================
// GET HOURLY SESSION GENERATION STATS
// GET /api/hourly-usage/generate
// ============================================
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get current active session
    const { data: sessionData, error: sessionError } = await supabase
      .from('hourly_usage_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({
        has_active_session: false,
        message: 'No active hourly session found'
      });
    }

    // Get generation count for this session
    const { data: generationsData, error: generationsError } = await supabase
      .from('user_generations')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionData.id)
      .order('created_at', { ascending: false });

    const sessionDuration = (new Date().getTime() - new Date(sessionData.session_start).getTime()) / (1000 * 60 * 60);

    return NextResponse.json({
      has_active_session: true,
      session: {
        id: sessionData.id,
        status: sessionData.status,
        start_time: sessionData.session_start,
        duration_hours: sessionDuration.toFixed(2),
        generations_count: generationsData?.length || 0,
        cost_so_far: `$${sessionData.total_cost_usd}`,
        hourly_rate: '$15/hour'
      },
      recent_generations: (generationsData || []).slice(0, 5).map(gen => ({
        id: gen.id,
        prompt: gen.prompt?.substring(0, 100) + '...',
        created_at: gen.created_at,
        generation_type: gen.generation_type
      })),
      features: [
        'Unlimited AI generations',
        'Premium model access',
        'No credit deductions',
        'Pause/Resume anytime'
      ]
    });

  } catch (error) {
    console.error('Error getting hourly generation stats:', error);
    return NextResponse.json(
      { error: 'Failed to get generation stats' },
      { status: 500 }
    );
  }
}
