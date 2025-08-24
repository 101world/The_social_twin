export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    console.log('=== MOBILE DEBUG TEST ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // Get user info
    const authRes = await auth();
    const userId = authRes.userId;
    console.log('User ID:', userId);
    
    // Get request details
    const userAgent = req.headers.get('user-agent') || '';
    const xForwardedFor = req.headers.get('x-forwarded-for') || '';
    const xRealIp = req.headers.get('x-real-ip') || '';
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const contentType = req.headers.get('content-type') || '';
    
    console.log('Headers:', {
      userAgent,
      xForwardedFor,
      xRealIp,
      origin,
      referer,
      contentType
    });
    
    // Mobile detection
    const isMobileUserAgent = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    console.log('Is Mobile User Agent:', isMobileUserAgent);
    
    // Parse body
    const body = await req.json().catch(() => ({}));
    console.log('Request Body:', JSON.stringify(body, null, 2));
    
    // Test basic functionality
    const testResults = {
      timestamp: new Date().toISOString(),
      userAuthenticated: !!userId,
      userId: userId || 'Not authenticated',
      isMobileUserAgent,
      userAgent,
      clientInfo: {
        origin,
        referer,
        xForwardedFor,
        xRealIp
      },
      requestBody: body,
      serverResponse: 'Mobile test endpoint working correctly'
    };
    
    console.log('Test Results:', testResults);
    
    return NextResponse.json({
      success: true,
      message: 'Mobile debug test completed',
      data: testResults
    });
    
  } catch (error) {
    console.error('Mobile debug test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Simple GET endpoint for basic connectivity test
  const userAgent = req.headers.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  return NextResponse.json({
    success: true,
    message: 'Mobile debug GET endpoint working',
    timestamp: new Date().toISOString(),
    userAgent,
    isMobile,
    headers: Object.fromEntries(req.headers.entries())
  });
}
