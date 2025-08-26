import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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

    // Check user credits first
    const creditsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/credits`, {
      headers: {
        'X-User-ID': userId,
      },
    });

    if (!creditsResponse.ok) {
      return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 });
    }

    const creditsData = await creditsResponse.json();
    
    if (creditsData.credits < creditCost) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: creditCost,
        available: creditsData.credits 
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

    // Deduct credits after successful AI response
    const deductResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/credits/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        amount: creditCost,
        reason: `AI Chat - ${actualMode} mode`,
        metadata: {
          mode: actualMode,
          messageLength: message.length,
          hasImage: !!imageData
        }
      }),
    });

    if (!deductResponse.ok) {
      console.error('Failed to deduct credits, but AI response was successful');
      // Still return AI response even if credit deduction fails
      // This ensures user gets the response they paid for
    }

    // Track the generation for analytics
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          type: 'text',
          mode: actualMode,
          prompt: message,
          result: aiResult.response || aiResult.message,
          credits_used: creditCost,
          success: true,
          metadata: {
            model: aiResult.model,
            conversationLength: conversationHistory.length,
            hasImage: !!imageData
          }
        }),
      });
    } catch (trackingError) {
      console.error('Failed to track generation:', trackingError);
      // Don't fail the request if tracking fails
    }

    return NextResponse.json({
      response: aiResult.response || aiResult.message,
      creditsUsed: creditCost,
      remainingCredits: creditsData.credits - creditCost,
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
