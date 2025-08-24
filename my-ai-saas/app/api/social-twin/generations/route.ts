import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id');
    
    console.log('🔍 Library API: Received request for user:', userId);
    
    if (!userId) {
      console.log('❌ Library API: No user ID provided');
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Fetch ALL user generations - show everything regardless of saveToLibrary flag
    const { data, error } = await supabase
      .from('media_generations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed') // Only show completed generations
      .or('result_url.not.is.null,media_url.not.is.null') // Must have either result_url OR media_url
      .order('created_at', { ascending: false }); // No limit - show ALL generations

    if (error) {
      console.error('💥 Supabase error in library API:', error);
      return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
    }

    console.log(`📊 Found ${data?.length || 0} completed generations with result_url for user ${userId}`);
    console.log('📋 Sample data (first item):', data?.[0] ? {
      id: data[0].id,
      type: data[0].type,
      status: data[0].status,
      result_url: data[0].result_url?.substring(0, 50) + '...',
      created_at: data[0].created_at
    } : 'No data');
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('💥 API error in library endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
