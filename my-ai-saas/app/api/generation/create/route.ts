import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadFileToR2, uploadUrlToR2 } from '@/lib/r2-upload';

// Generation types and costs
const GENERATION_TYPES = {
  'text-to-image': { credits: 15, workflow: 'flux' },
  'image-to-image': { credits: 20, workflow: 'flux-kontext' },
  'text-to-video': { credits: 50, workflow: 'wan-2.2' },
  'image-to-video': { credits: 75, workflow: 'image-to-video' },
} as const;

type GenerationType = keyof typeof GENERATION_TYPES;

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const type = formData.get('type') as GenerationType;
    const prompt = formData.get('prompt') as string;
    const inputImage = formData.get('inputImage') as File | null;

    // Validate inputs
    if (!type || !GENERATION_TYPES[type]) {
      return Response.json({ error: 'Invalid generation type' }, { status: 400 });
    }

    if (!prompt?.trim()) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const needsImage = type === 'image-to-image' || type === 'image-to-video';
    if (needsImage && !inputImage) {
      return Response.json({ error: 'Input image is required for this generation type' }, { status: 400 });
    }

    const { credits: requiredCredits, workflow } = GENERATION_TYPES[type];

    // Check user credits
    const creditsCheck = await fetch(`${req.nextUrl.origin}/api/users/credits`, {
      headers: { 'user-id': userId }
    });
    const { credits: userCredits } = await creditsCheck.json();

    if (userCredits < requiredCredits) {
      return Response.json({ 
        error: `Insufficient credits. Required: ${requiredCredits}, Available: ${userCredits}` 
      }, { status: 402 });
    }

    // Deduct credits first (prevents failed billing)
    await fetch(`${req.nextUrl.origin}/api/users/deduct-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId, 
        credits: requiredCredits, 
        type: `generation_${type}` 
      })
    });

    try {
      // Generate based on type
      let outputUrl: string;
      
      switch (type) {
        case 'text-to-image':
          outputUrl = await generateTextToImage(prompt, userId);
          break;
        case 'image-to-image':
          outputUrl = await generateImageToImage(prompt, inputImage!, userId);
          break;
        case 'text-to-video':
          outputUrl = await generateTextToVideo(prompt, userId);
          break;
        case 'image-to-video':
          outputUrl = await generateImageToVideo(prompt, inputImage!, userId);
          break;
        default:
          throw new Error('Unsupported generation type');
      }

      // Save to database
      await saveGeneration({
        userId,
        type,
        prompt,
        inputImageUrl: inputImage ? await uploadFileToR2(inputImage, userId, 'input') : null,
        outputUrl,
        creditsUsed: requiredCredits,
        workflow,
      });

      return Response.json({ 
        success: true, 
        outputUrl,
        creditsUsed: requiredCredits 
      });

    } catch (error) {
      // Refund credits on failure
      await fetch(`${req.nextUrl.origin}/api/users/refund-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          credits: requiredCredits, 
          reason: 'generation_failed' 
        })
      });

      throw error;
    }

  } catch (error: any) {
    console.error('Generation error:', error);
    return Response.json({ 
      error: error.message || 'Generation failed' 
    }, { status: 500 });
  }
}

// Generation functions for each type
async function generateTextToImage(prompt: string, userId: string): Promise<string> {
  // Call Flux serverless worker
  const response = await fetch(process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT!, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        prompt,
        workflow: 'flux',
        output_format: 'png'
      }
    })
  });

  const result = await response.json();
  
  // Poll for completion
  const jobId = result.id;
  const outputUrl = await pollForCompletion(jobId, 'image');
  
  // Upload to R2 and return public URL
  return await uploadUrlToR2(outputUrl, userId, 'text-to-image', 'png');
}

async function generateImageToImage(prompt: string, inputImage: File, userId: string): Promise<string> {
  // Upload input image to R2 first
  const inputImageUrl = await uploadFileToR2(inputImage, userId, 'input');
  
  // Call Flux Kontext serverless worker
  const response = await fetch(process.env.RUNPOD_IMAGE_TO_IMAGE_ENDPOINT!, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: inputImageUrl,
        workflow: 'flux-kontext',
        output_format: 'png'
      }
    })
  });

  const result = await response.json();
  const jobId = result.id;
  const outputUrl = await pollForCompletion(jobId, 'image');
  
  return await uploadUrlToR2(outputUrl, userId, 'image-to-image', 'png');
}

async function generateTextToVideo(prompt: string, userId: string): Promise<string> {
  // Call Wan 2.2 serverless worker
  const response = await fetch(process.env.RUNPOD_TEXT_TO_VIDEO_ENDPOINT!, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        prompt,
        workflow: 'wan-2.2',
        output_format: 'mp4'
      }
    })
  });

  const result = await response.json();
  const jobId = result.id;
  const outputUrl = await pollForCompletion(jobId, 'video');
  
  return await uploadUrlToR2(outputUrl, userId, 'text-to-video', 'mp4');
}

async function generateImageToVideo(prompt: string, inputImage: File, userId: string): Promise<string> {
  // Upload input image to R2 first
  const inputImageUrl = await uploadFileToR2(inputImage, userId, 'input');
  
  // Call Image to Video serverless worker
  const response = await fetch(process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT!, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: inputImageUrl,
        workflow: 'image-to-video',
        output_format: 'mp4'
      }
    })
  });

  const result = await response.json();
  const jobId = result.id;
  const outputUrl = await pollForCompletion(jobId, 'video');
  
  return await uploadUrlToR2(outputUrl, userId, 'image-to-video', 'mp4');
}

// Utility functions
async function pollForCompletion(jobId: string, type: 'image' | 'video'): Promise<string> {
  const timeout = 5 * 60 * 1000; // 5 minutes
  const interval = 2000; // 2 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const statusResponse = await fetch(`https://api.runpod.ai/v2/${jobId}/status`, {
      headers: { 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` }
    });

    const status = await statusResponse.json();

    if (status.status === 'COMPLETED') {
      return status.output?.output_url || status.output?.image_url || status.output?.video_url;
    }

    if (status.status === 'FAILED') {
      throw new Error(`Generation failed: ${status.error || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Generation timeout');
}

async function saveGeneration(data: {
  userId: string;
  type: string;
  prompt: string;
  inputImageUrl: string | null;
  outputUrl: string;
  creditsUsed: number;
  workflow: string;
}) {
  // Save to your database (Supabase)
  // Implementation depends on your database schema
  console.log('Saving generation:', data);
}
