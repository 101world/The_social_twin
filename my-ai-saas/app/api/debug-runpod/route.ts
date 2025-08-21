import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('=== RUNPOD DEBUG REQUEST ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request Body:', JSON.stringify(body, null, 2));
    console.log('Request Headers:', Object.fromEntries(req.headers.entries()));
    
    const { runpodUrl, prompt, mode } = body;
    
    if (!runpodUrl) {
      return NextResponse.json({ error: 'RunPod URL required for testing' }, { status: 400 });
    }

    const apiKey = process.env.RUNPOD_API_KEY;
    const base = runpodUrl.replace(/\/$/, '');

    console.log('=== RUNPOD CONNECTION TEST ===');
    console.log('RunPod Base URL:', base);
    console.log('API Key Present:', !!apiKey);
    console.log('API Key (partial):', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
    
    // Test various RunPod endpoints
    const testResults = [];

    // Test 1: Basic connectivity (GET /)
    try {
      console.log('Testing basic connectivity...');
      const basicTest = await fetch(base, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
          ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
        }
      });
      
      const basicText = await basicTest.text();
      console.log('Basic test status:', basicTest.status);
      console.log('Basic test response (first 200 chars):', basicText.substring(0, 200));
      
      testResults.push({
        test: 'Basic GET /',
        status: basicTest.status,
        ok: basicTest.ok,
        isHtml: basicText.startsWith('<!DOCTYPE html>') || basicText.startsWith('<html>'),
        response: basicText.substring(0, 200)
      });
    } catch (error: any) {
      testResults.push({
        test: 'Basic GET /',
        error: error.message
      });
    }

    // Test 2: ComfyUI prompt endpoint (GET /prompt)
    try {
      console.log('Testing /prompt endpoint...');
      const promptTest = await fetch(`${base}/prompt`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
          ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
        }
      });
      
      const promptText = await promptTest.text();
      console.log('Prompt test status:', promptTest.status);
      console.log('Prompt test response (first 200 chars):', promptText.substring(0, 200));
      
      testResults.push({
        test: 'GET /prompt',
        status: promptTest.status,
        ok: promptTest.ok,
        isHtml: promptText.startsWith('<!DOCTYPE html>') || promptText.startsWith('<html>'),
        response: promptText.substring(0, 200)
      });
    } catch (error: any) {
      testResults.push({
        test: 'GET /prompt',
        error: error.message
      });
    }

    // Test 3: Simulate actual generation request
    if (prompt && mode) {
      try {
        console.log('Testing actual generation request...');
        
        // Simple test workflow
        const testWorkflow = {
          "1": {
            "inputs": {
              "text": prompt,
              "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
          },
          "2": {
            "inputs": {
              "text": "",
              "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
          },
          "3": {
            "inputs": {
              "seed": Math.floor(Math.random() * 1000000),
              "steps": 20,
              "cfg": 8,
              "sampler_name": "euler",
              "scheduler": "normal",
              "denoise": 1,
              "model": ["4", 0],
              "positive": ["1", 0],
              "negative": ["2", 0],
              "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
          },
          "4": {
            "inputs": {
              "ckpt_name": "sd_xl_base_1.0.safetensors"
            },
            "class_type": "CheckpointLoaderSimple"
          },
          "5": {
            "inputs": {
              "width": 1024,
              "height": 1024,
              "batch_size": 1
            },
            "class_type": "EmptyLatentImage"
          },
          "6": {
            "inputs": {
              "samples": ["3", 0],
              "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
          },
          "7": {
            "inputs": {
              "filename_prefix": "ComfyUI",
              "images": ["6", 0]
            },
            "class_type": "SaveImage"
          }
        };

        const genTest = await fetch(`${base}/prompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
            ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
          },
          body: JSON.stringify({ prompt: testWorkflow })
        });
        
        const genText = await genTest.text();
        console.log('Generation test status:', genTest.status);
        console.log('Generation test response:', genText);
        
        testResults.push({
          test: 'POST /prompt (generation)',
          status: genTest.status,
          ok: genTest.ok,
          isHtml: genText.startsWith('<!DOCTYPE html>') || genText.startsWith('<html>'),
          response: genText,
          requestPayload: { prompt: testWorkflow }
        });
      } catch (error: any) {
        testResults.push({
          test: 'POST /prompt (generation)',
          error: error.message
        });
      }
    }

    console.log('=== TEST RESULTS ===');
    console.log(JSON.stringify(testResults, null, 2));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      runpodUrl: base,
      hasApiKey: !!apiKey,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING',
      testResults,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        hasRunpodKey: !!process.env.RUNPOD_API_KEY
      }
    });

  } catch (error: any) {
    console.error('RunPod debug error:', error);
    return NextResponse.json({ 
      error: 'Debug test failed', 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
