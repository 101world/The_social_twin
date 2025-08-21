-- ===================================================================
-- RUNPOD CONNECTION TEST API
-- Create this to test your RunPod endpoint directly
-- ===================================================================

-- First, create this API endpoint to test RunPod connectivity
-- File: app/api/test-runpod/route.ts

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { runpodUrl } = body;
    
    if (!runpodUrl) {
      return Response.json({ error: 'RunPod URL required' }, { status: 400 });
    }

    const apiKey = process.env.RUNPOD_API_KEY;
    const base = runpodUrl.replace(/\/$/, '');

    console.log('Testing RunPod URL:', base);
    console.log('API Key present:', !!apiKey);

    // Test basic connectivity
    const testResponse = await fetch(base, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
      }
    });

    const responseText = await testResponse.text();
    console.log('RunPod Response Status:', testResponse.status);
    console.log('RunPod Response Headers:', Object.fromEntries(testResponse.headers.entries()));
    console.log('RunPod Response Text:', responseText);

    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }

    return Response.json({
      status: testResponse.status,
      ok: testResponse.ok,
      headers: Object.fromEntries(testResponse.headers.entries()),
      isJson: !!responseJson,
      isHtml: responseText.startsWith('<!DOCTYPE html>') || responseText.startsWith('<html>'),
      responseText: responseText.substring(0, 500), // First 500 chars
      responseJson
    });

  } catch (error: any) {
    return Response.json({ 
      error: 'Test failed', 
      details: error.message 
    }, { status: 500 });
  }
}
