export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const authRes = await auth();
    const userId = authRes.userId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Log everything for mobile debugging
    console.log('=== MOBILE DEBUG ENDPOINT ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User ID:', userId);
    console.log('Request Headers:', {
      'content-type': req.headers.get('content-type'),
      'user-agent': req.headers.get('user-agent'),
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'x-real-ip': req.headers.get('x-real-ip'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
      'accept': req.headers.get('accept'),
      'accept-encoding': req.headers.get('accept-encoding'),
      'cache-control': req.headers.get('cache-control'),
      'connection': req.headers.get('connection'),
      'x-user-id': req.headers.get('x-user-id'),
    });
    console.log('Request Body:', JSON.stringify(body, null, 2));
    
    // Check if this is actually a mobile device
    const userAgent = req.headers.get('user-agent') || '';
    const isMobileUA = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    console.log('User Agent Analysis:', {
      userAgent,
      isMobileUA,
      contains_mobile: userAgent.toLowerCase().includes('mobile'),
      contains_android: userAgent.toLowerCase().includes('android'),
      contains_iphone: userAgent.toLowerCase().includes('iphone'),
    });

    // Try a simple generation call to see what happens
    try {
      const testGenRes = await fetch("/api/generate-with-tracking", {
        method: "POST", 
        headers: { 
          "Content-Type": "application/json", 
          "X-User-Id": userId || "",
          "User-Agent": userAgent
        },
        body: JSON.stringify({
          prompt: "test mobile generation",
          mode: "image",
          batch_size: 1,
          userId: userId,
          test_mobile: true
        }),
      });
      
      console.log('Test generation response status:', testGenRes.status);
      console.log('Test generation response headers:', Object.fromEntries(testGenRes.headers.entries()));
      
      if (!testGenRes.ok) {
        const errText = await testGenRes.text();
        console.log('Test generation error text:', errText);
        
        return NextResponse.json({
          debug: 'mobile test failed',
          status: testGenRes.status,
          error: errText,
          userAgent,
          isMobileUA,
          userId
        });
      }
      
      const testResult = await testGenRes.json();
      console.log('Test generation success:', testResult);
      
      return NextResponse.json({
        debug: 'mobile test success',
        result: testResult,
        userAgent,
        isMobileUA,
        userId
      });
      
    } catch (genError) {
      console.log('Test generation threw error:', genError);
      
      return NextResponse.json({
        debug: 'mobile test threw error',
        error: genError instanceof Error ? genError.message : String(genError),
        userAgent,
        isMobileUA,
        userId
      });
    }
    
  } catch (err) {
    console.error('Mobile debug error:', err);
    return NextResponse.json(
      { error: 'Debug failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
