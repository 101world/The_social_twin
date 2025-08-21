import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runpodUrl } = body;
    
    if (!runpodUrl) {
      return NextResponse.json({ error: 'RunPod URL required' }, { status: 400 });
    }

    const base = runpodUrl.replace(/\/$/, '');
    const results = [];
    
    console.log('=== NETWORK CONNECTIVITY DEBUG ===');
    console.log('Testing URL:', base);
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      region: process.env.VERCEL_REGION
    });

    // Test 1: Basic DNS/Network connectivity
    try {
      console.log('Testing basic connectivity...');
      const startTime = Date.now();
      
      const response = await fetch(base, {
        method: 'GET',
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const responseText = await response.text();
      
      results.push({
        test: 'Basic Connectivity',
        success: true,
        status: response.status,
        responseTime: `${responseTime}ms`,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: responseText.substring(0, 200),
        isHtml: responseText.trim().startsWith('<!DOCTYPE html>') || responseText.trim().startsWith('<html>')
      });
      
      console.log('Basic connectivity SUCCESS:', response.status, responseTime + 'ms');
      
    } catch (error: any) {
      results.push({
        test: 'Basic Connectivity',
        success: false,
        error: error.message,
        errorType: error.name,
        stack: error.stack
      });
      console.log('Basic connectivity FAILED:', error.message);
    }

    // Test 2: URL validation
    try {
      const url = new URL(base);
      results.push({
        test: 'URL Validation',
        success: true,
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname
      });
    } catch (error: any) {
      results.push({
        test: 'URL Validation',
        success: false,
        error: error.message
      });
    }

    // Test 3: Different HTTP methods
    const methods = ['GET', 'POST', 'OPTIONS'];
    for (const method of methods) {
      try {
        console.log(`Testing ${method} method...`);
        const startTime = Date.now();
        
        const testResponse = await fetch(base, {
          method,
          signal: AbortSignal.timeout(15000),
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'NextJS-Debug-Client'
          },
          ...(method === 'POST' ? { body: JSON.stringify({ test: true }) } : {})
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        results.push({
          test: `${method} Method`,
          success: true,
          status: testResponse.status,
          responseTime: `${responseTime}ms`,
          headers: Object.fromEntries(testResponse.headers.entries())
        });
        
      } catch (error: any) {
        results.push({
          test: `${method} Method`,
          success: false,
          error: error.message,
          errorType: error.name
        });
      }
    }

    // Test 4: Common RunPod endpoints
    const endpoints = ['/', '/prompt', '/history', '/queue'];
    for (const endpoint of endpoints) {
      try {
        console.log(`Testing endpoint ${endpoint}...`);
        const fullUrl = `${base}${endpoint}`;
        const startTime = Date.now();
        
        const endpointResponse = await fetch(fullUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        results.push({
          test: `Endpoint ${endpoint}`,
          success: true,
          status: endpointResponse.status,
          responseTime: `${responseTime}ms`,
          url: fullUrl
        });
        
      } catch (error: any) {
        results.push({
          test: `Endpoint ${endpoint}`,
          success: false,
          error: error.message,
          errorType: error.name
        });
      }
    }

    // Test 5: Firewall/CORS check
    try {
      console.log('Testing CORS/Firewall...');
      const corsResponse = await fetch(base, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://your-app.vercel.app',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      
      results.push({
        test: 'CORS Check',
        success: true,
        status: corsResponse.status,
        corsHeaders: {
          'access-control-allow-origin': corsResponse.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': corsResponse.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': corsResponse.headers.get('access-control-allow-headers')
        }
      });
      
    } catch (error: any) {
      results.push({
        test: 'CORS Check',
        success: false,
        error: error.message
      });
    }

    console.log('=== NETWORK DEBUG COMPLETE ===');
    console.log('Results:', JSON.stringify(results, null, 2));

    // Summary
    const successfulTests = results.filter(r => r.success).length;
    const totalTests = results.length;
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      runpodUrl: base,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        region: process.env.VERCEL_REGION
      },
      summary: {
        successfulTests,
        totalTests,
        successRate: `${Math.round((successfulTests / totalTests) * 100)}%`
      },
      results,
      recommendations: generateRecommendations(results)
    });

  } catch (error: any) {
    console.error('Network debug error:', error);
    return NextResponse.json({ 
      error: 'Network debug failed', 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

function generateRecommendations(results: any[]) {
  const recommendations = [];
  
  // Check if basic connectivity failed
  const basicTest = results.find(r => r.test === 'Basic Connectivity');
  if (!basicTest?.success) {
    if (basicTest?.error?.includes('timeout')) {
      recommendations.push('Connection timeout - RunPod instance may be stopped or URL incorrect');
    } else if (basicTest?.error?.includes('ENOTFOUND')) {
      recommendations.push('DNS resolution failed - check RunPod URL format');
    } else if (basicTest?.error?.includes('ECONNREFUSED')) {
      recommendations.push('Connection refused - RunPod instance may not be running');
    } else {
      recommendations.push('Network connection failed - check RunPod instance status');
    }
  }
  
  // Check URL format
  const urlTest = results.find(r => r.test === 'URL Validation');
  if (!urlTest?.success) {
    recommendations.push('Invalid URL format - should be https://xxx-xxx.runpod.net');
  }
  
  // Check if HTML responses (wrong endpoint)
  const htmlResponses = results.filter(r => r.isHtml === true);
  if (htmlResponses.length > 0) {
    recommendations.push('Receiving HTML responses - may be hitting wrong endpoint or web interface');
  }
  
  // Check status codes
  const badStatuses = results.filter(r => r.status && (r.status >= 400 || r.status < 200));
  if (badStatuses.length > 0) {
    recommendations.push('HTTP errors detected - check API key and endpoint paths');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Network connectivity appears normal - check application logic');
  }
  
  return recommendations;
}
