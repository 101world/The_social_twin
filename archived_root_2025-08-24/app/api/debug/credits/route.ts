import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  const debugInfo: any = {
    nodeEnv: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    timestamp: new Date().toISOString()
  };

  try {
    const authResult = await auth();
    debugInfo.userId = authResult?.userId;
    debugInfo.hasAuth = !!authResult?.userId;
    
    if (authResult?.getToken) {
      try {
        const jwt = await authResult.getToken({ template: 'supabase' });
        debugInfo.hasJwt = !!jwt;
        debugInfo.jwtLength = jwt?.length || 0;
      } catch (e) {
        debugInfo.jwtError = (e as Error).message;
      }
    }
  } catch (e) {
    debugInfo.authError = (e as Error).message;
  }

  // Test Supabase connection
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('user_credits')
      .select('count(*)')
      .limit(1);
    
    debugInfo.supabaseConnection = !error;
    debugInfo.supabaseError = error?.message;
  } catch (e) {
    debugInfo.supabaseConnectionError = (e as Error).message;
  }

  return NextResponse.json(debugInfo);
}
