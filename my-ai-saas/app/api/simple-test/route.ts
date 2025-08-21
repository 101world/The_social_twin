import { NextRequest, NextResponse } from 'next/server';

// Simple endpoint to test if your webapp can make basic HTTP requests
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ 
        error: 'Missing url parameter', 
        usage: 'GET /api/simple-test?url=https://your-runpod-url.com' 
      }, { status: 400 });
    }

    console.log('=== SIMPLE CONNECTIVITY TEST ===');
    console.log('Testing URL:', url);
    console.log('From environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL
    });

    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(30000)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const text = await response.text();
      
      console.log('Response received:', {
        status: response.status,
        time: responseTime,
        size: text.length
      });
      
      return NextResponse.json({
        success: true,
        status: response.status,
        responseTime: `${responseTime}ms`,
        responseSize: text.length,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: text.substring(0, 300),
        isHtml: text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html>'),
        timestamp: new Date().toISOString()
      });
      
    } catch (fetchError: any) {
      console.error('Fetch failed:', fetchError);
      
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        errorType: fetchError.name,
        timeout: fetchError.name === 'TimeoutError',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error: any) {
    console.error('Test failed:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message 
    }, { status: 500 });
  }
}
