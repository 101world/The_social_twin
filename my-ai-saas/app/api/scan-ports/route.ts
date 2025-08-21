import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { baseUrl } = body;
    
    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl required' }, { status: 400 });
    }

    console.log('=== RUNPOD PORT SCANNER ===');
    console.log('Base URL:', baseUrl);
    
    // Extract the base domain from the URL
    const urlMatch = baseUrl.match(/https:\/\/([^-]+)-(\d+)\.proxy\.runpod\.net/);
    if (!urlMatch) {
      return NextResponse.json({ error: 'Invalid RunPod URL format' }, { status: 400 });
    }
    
    const [, podId, currentPort] = urlMatch;
    console.log('Pod ID:', podId, 'Current Port:', currentPort);
    
    // Common ComfyUI ports to test
    const portsToTest = [3001, 8188, 7860, 3000, 8000, 8080];
    const results = [];
    
    for (const port of portsToTest) {
      const testUrl = `https://${podId}-${port}.proxy.runpod.net`;
      
      try {
        console.log(`Testing port ${port}...`);
        const response = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        });
        
        const text = await response.text();
        const isHtml = text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html>');
        const isJson = !isHtml && (text.startsWith('{') || text.startsWith('['));
        
        // Test if it's ComfyUI API by checking /prompt endpoint
        let isComfyApi = false;
        try {
          const promptResponse = await fetch(`${testUrl}/prompt`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          const promptText = await promptResponse.text();
          // ComfyUI API usually returns {"exec_info": {...}} or similar JSON
          isComfyApi = promptResponse.ok && (promptText.startsWith('{') || promptText.startsWith('['));
        } catch {}
        
        results.push({
          port,
          url: testUrl,
          status: response.status,
          success: response.ok,
          isHtml,
          isJson,
          isComfyApi,
          responsePreview: text.substring(0, 200),
          contentType: response.headers.get('content-type'),
          recommendation: isComfyApi ? '✅ USE THIS - ComfyUI API' : 
                        isHtml ? '🌐 Web Interface' : 
                        isJson ? '📄 JSON Response' : '❓ Unknown'
        });
        
      } catch (error: any) {
        results.push({
          port,
          url: `https://${podId}-${port}.proxy.runpod.net`,
          success: false,
          error: error.message,
          recommendation: '❌ Not accessible'
        });
      }
    }
    
    // Find the best API endpoint
    const apiEndpoint = results.find(r => r.isComfyApi);
    const recommendations = [];
    
    if (apiEndpoint) {
      recommendations.push(`Use ${apiEndpoint.url} as your RunPod URL in the app`);
    } else {
      recommendations.push('No ComfyUI API endpoint found. Check if ComfyUI is running properly.');
      const workingPorts = results.filter(r => r.success);
      if (workingPorts.length > 0) {
        recommendations.push(`Working ports found: ${workingPorts.map(p => p.port).join(', ')}`);
      }
    }
    
    console.log('=== PORT SCAN COMPLETE ===');
    console.log('Results:', JSON.stringify(results, null, 2));
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      podId,
      currentPort: parseInt(currentPort),
      results,
      apiEndpoint: apiEndpoint?.url || null,
      recommendations
    });
    
  } catch (error: any) {
    console.error('Port scan error:', error);
    return NextResponse.json({ 
      error: 'Port scan failed', 
      details: error.message 
    }, { status: 500 });
  }
}
