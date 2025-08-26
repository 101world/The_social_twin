import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

// Define credit costs for different AI modes
const CREDIT_COSTS = {
  normal: 2,    // General AI - moderate cost
  prompt: 1,    // Fast prompt generation - lower cost
  creative: 3,  // Creative writing - higher cost
  think: 4,     // Advanced reasoning - highest cost
  vision: 5,    // Vision + text - premium cost
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      message, 
      conversationHistory = [], 
      mode = 'normal',
      imageData = null 
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Determine mode - use vision if image is provided
    const actualMode = imageData ? 'vision' : mode;
    const creditCost = CREDIT_COSTS[actualMode as keyof typeof CREDIT_COSTS] || 2;

    // Create Supabase admin client for credit operations
    const supabase = createSupabaseAdminClient();

    // Check user credits using Supabase
    const { data: creditData, error: creditError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Credit check error:', creditError);
      return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 });
    }

    const availableCredits = (creditData as any)?.credits || 0;
    
    if (availableCredits < creditCost) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: creditCost,
        available: availableCredits 
      }, { status: 402 });
    }

    // Call Cloudflare AI Worker
    const workerUrl = 'https://101world-ai-api.welcometo101world.workers.dev';
    const endpoint = imageData ? '/chat-vision' : '/chat';
    
    const workerPayload = imageData ? {
      message,
      imageData,
      conversationHistory,
      userId
    } : {
      message,
      conversationHistory,
      mode: actualMode,
      userId
    };

    const aiResponse = await fetch(`${workerUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workerPayload),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Cloudflare AI Error:', errorText);
      return NextResponse.json({ 
        error: 'AI service failed',
        details: errorText 
      }, { status: 500 });
    }

    const aiResult = await aiResponse.json();

    // Deduct credits using Supabase RPC function
    let didDeduct = false;
    let newBalance: number | null = null;
    
    const { data: bal, error: deductError } = await supabase.rpc('deduct_credits_simple', {
      p_user_id: userId,
      p_amount: creditCost
    });

    if (deductError) {
      console.error('Failed to deduct credits:', deductError);
      // Still return AI response even if credit deduction fails
    } else if (typeof bal === 'number') {
      didDeduct = true;
      newBalance = bal;
    }

    // Track the generation for analytics
    try {
      await supabase
        .from('media_generations')
        .insert({
          user_id: userId,
          type: 'text',
          mode: actualMode,
          prompt: message,
          result: aiResult.response || aiResult.message,
          credits_used: creditCost,
          success: true,
          created_at: new Date().toISOString(),
          metadata: {
            model: aiResult.model,
            conversationLength: conversationHistory.length,
            hasImage: !!imageData
          }
        });
    } catch (trackingError) {
      console.error('Failed to track generation:', trackingError);
      // Don't fail the request if tracking fails
    }

    return NextResponse.json({
      response: aiResult.response || aiResult.message,
      creditsUsed: creditCost,
      remainingCredits: didDeduct ? newBalance : availableCredits - creditCost,
      mode: actualMode,
      model: aiResult.model
    });

  } catch (error) {
    console.error('Cloudflare AI API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
