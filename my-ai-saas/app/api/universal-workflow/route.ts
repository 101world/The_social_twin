import { NextRequest, NextResponse } from 'next/server';
import { getRunpodConfig, pickRunpodUrlFromConfig } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runpodUrl: runpodUrlRaw, prompt, mode = 'image', ...params } = body;
    // Resolve runpodUrl from DB config -> env fallbacks if not provided
    const cfg = await getRunpodConfig();
    const runpodUrl = pickRunpodUrlFromConfig({ provided: runpodUrlRaw, mode, config: cfg });
     
    if (!runpodUrl || !prompt) {
      return NextResponse.json({ error: 'runpodUrl and prompt required' }, { status: 400 });
    }

    const apiKey = process.env.RUNPOD_API_KEY;
    const base = runpodUrl.replace(/\/$/, '');
    
    console.log('=== UNIVERSAL WORKFLOW GENERATOR ===');
    console.log('Mode:', mode);
    console.log('Prompt:', prompt);
    console.log('RunPod URL:', base);
    
    // Step 1: Check what models are available on this RunPod
    const modelsResponse = await fetch(`${base}/object_info`, {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
      }
    });
    
    let availableNodes = {};
    try {
      availableNodes = await modelsResponse.json();
    } catch {
      console.log('Could not fetch object_info, using fallback workflow');
    }
    
    console.log('Available nodes:', Object.keys(availableNodes).slice(0, 10));
    
    // Step 2: Build a universal workflow based on available nodes
    const workflow = buildUniversalWorkflow(prompt, mode, availableNodes, params);
    
    console.log('Generated workflow:', JSON.stringify(workflow, null, 2));
    
    // Step 3: Submit the workflow
    const submitResponse = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({ prompt: workflow })
    });
    
    const submitText = await submitResponse.text();
    let submitResult;
    
    try {
      submitResult = JSON.parse(submitText);
    } catch {
      return NextResponse.json({
        error: 'Invalid response from RunPod',
        details: submitText.substring(0, 200),
        isHtml: submitText.includes('<html>')
      }, { status: 502 });
    }
    
    if (!submitResponse.ok) {
      return NextResponse.json({
        error: 'RunPod submission failed',
        details: submitResult,
        status: submitResponse.status
      }, { status: submitResponse.status });
    }
    
    const promptId = submitResult.prompt_id;
    if (!promptId) {
      return NextResponse.json({
        error: 'No prompt_id in response',
        response: submitResult
      }, { status: 502 });
    }
    
    // Step 4: Poll for results
    const maxTries = mode === 'video' ? 150 : 60; // 5 minutes for video, 2 minutes for image
    let result = null;
    
    for (let i = 0; i < maxTries; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const historyResponse = await fetch(`${base}/history/${promptId}`, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
          ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
        }
      });
      
      const historyData = await historyResponse.json().catch(() => ({}));
      const outputs = historyData[promptId]?.outputs || {};
      
      // Look for any output with images or videos
      for (const nodeId of Object.keys(outputs)) {
        const output = outputs[nodeId] as any;
        if (output.images && output.images.length > 0) {
          const image = output.images[0];
          const imageUrl = `${base}/view?filename=${encodeURIComponent(image.filename)}&type=${encodeURIComponent(image.type || 'output')}&subfolder=${encodeURIComponent(image.subfolder || '')}`;
          result = { imageUrl, images: (output.images as any[]).map((img: any) => `${base}/view?filename=${encodeURIComponent(img.filename)}&type=${encodeURIComponent(img.type || 'output')}&subfolder=${encodeURIComponent(img.subfolder || '')}`) };
          break;
        }
        if (output.videos && output.videos.length > 0) {
          const video = output.videos[0];
          const videoUrl = `${base}/view?filename=${encodeURIComponent(video.filename)}&type=${encodeURIComponent(video.type || 'output')}&subfolder=${encodeURIComponent(video.subfolder || '')}`;
          result = { videoUrl, videos: (output.videos as any[]).map((vid: any) => `${base}/view?filename=${encodeURIComponent(vid.filename)}&type=${encodeURIComponent(vid.type || 'output')}&subfolder=${encodeURIComponent(vid.subfolder || '')}`) };
          break;
        }
      }
      
      if (result) break;
    }
    
    if (!result) {
      return NextResponse.json({
        error: 'Generation timeout',
        message: 'No output received within time limit'
      }, { status: 408 });
    }
    
    return NextResponse.json({
      ok: true,
      ...result,
      promptId,
      runpod: { prompt_id: promptId }
    });
    
  } catch (error: any) {
    console.error('Universal workflow error:', error);
    return NextResponse.json({
      error: 'Workflow generation failed',
      details: error.message
    }, { status: 500 });
  }
}

function buildUniversalWorkflow(prompt: string, mode: string, availableNodes: any, params: any = {}) {
  console.log('Building workflow for mode:', mode);
  
  // Try to find the best available checkpoint
  const checkpointLoaders = ['CheckpointLoaderSimple', 'CheckpointLoader', 'UNETLoader'];
  const checkpointNode = checkpointLoaders.find(node => availableNodes[node]);
  
  // Try to find text encoding nodes
  const textEncoders = ['CLIPTextEncode', 'CLIPTextEncodeSDXL', 'ConditioningConcat'];
  const textEncodeNode = textEncoders.find(node => availableNodes[node]);
  
  // Try to find sampling nodes
  const samplers = ['KSampler', 'KSamplerAdvanced', 'SamplerCustom'];
  const samplerNode = samplers.find(node => availableNodes[node]);
  
  // Try to find VAE decode nodes
  const vaeDecoders = ['VAEDecode', 'VAEDecodeAudio'];
  const vaeDecodeNode = vaeDecoders.find(node => availableNodes[node]);
  
  // Try to find save nodes
  const saveNodes = ['SaveImage', 'SaveVideo', 'PreviewImage'];
  const saveNode = saveNodes.find(node => availableNodes[node]);
  
  console.log('Found nodes:', { checkpointNode, textEncodeNode, samplerNode, vaeDecodeNode, saveNode });
  
  if (!checkpointNode || !textEncodeNode || !samplerNode || !vaeDecodeNode || !saveNode) {
    console.log('Missing required nodes, using fallback workflow');
    return buildFallbackWorkflow(prompt, params);
  }
  
  // Build dynamic workflow
  const workflow: any = {};
  
  // 1. Checkpoint Loader
  workflow["1"] = {
    inputs: {
      ckpt_name: params.model || "sd_xl_base_1.0.safetensors" // Common default
    },
    class_type: checkpointNode
  };
  
  // 2. Positive Text Encode
  workflow["2"] = {
    inputs: {
      text: prompt,
      clip: ["1", 1] // From checkpoint loader
    },
    class_type: textEncodeNode
  };
  
  // 3. Negative Text Encode
  workflow["3"] = {
    inputs: {
      text: params.negative || "",
      clip: ["1", 1] // From checkpoint loader
    },
    class_type: textEncodeNode
  };
  
  // 4. Empty Latent Image
  workflow["4"] = {
    inputs: {
      width: params.width || 1024,
      height: params.height || 1024,
      batch_size: params.batch_size || 1
    },
    class_type: "EmptyLatentImage"
  };
  
  // 5. Sampler
  workflow["5"] = {
    inputs: {
      seed: params.seed || Math.floor(Math.random() * 1000000),
      steps: params.steps || 20,
      cfg: params.cfg || 8,
      sampler_name: params.sampler || "euler",
      scheduler: params.scheduler || "normal",
      denoise: params.denoise || 1,
      model: ["1", 0], // From checkpoint loader
      positive: ["2", 0], // From positive text encode
      negative: ["3", 0], // From negative text encode
      latent_image: ["4", 0] // From empty latent
    },
    class_type: samplerNode
  };
  
  // 6. VAE Decode
  workflow["6"] = {
    inputs: {
      samples: ["5", 0], // From sampler
      vae: ["1", 2] // From checkpoint loader
    },
    class_type: vaeDecodeNode
  };
  
  // 7. Save Image
  workflow["7"] = {
    inputs: {
      filename_prefix: "ComfyUI",
      images: ["6", 0] // From VAE decode
    },
    class_type: saveNode
  };
  
  return workflow;
}

function buildFallbackWorkflow(prompt: string, params: any = {}) {
  // Minimal fallback workflow that should work on most ComfyUI setups
  return {
    "1": {
      inputs: {
        ckpt_name: "model.safetensors"
      },
      class_type: "CheckpointLoaderSimple"
    },
    "2": {
      inputs: {
        text: prompt,
        clip: ["1", 1]
      },
      class_type: "CLIPTextEncode"
    },
    "3": {
      inputs: {
        text: "",
        clip: ["1", 1]
      },
      class_type: "CLIPTextEncode"
    },
    "4": {
      inputs: {
        width: 512,
        height: 512,
        batch_size: 1
      },
      class_type: "EmptyLatentImage"
    },
    "5": {
      inputs: {
        seed: Math.floor(Math.random() * 1000000),
        steps: 20,
        cfg: 8,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0]
      },
      class_type: "KSampler"
    },
    "6": {
      inputs: {
        samples: ["5", 0],
        vae: ["1", 2]
      },
      class_type: "VAEDecode"
    },
    "7": {
      inputs: {
        filename_prefix: "ComfyUI",
        images: ["6", 0]
      },
      class_type: "SaveImage"
    }
  };
}
