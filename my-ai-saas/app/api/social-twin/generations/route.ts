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
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Fetch ALL user generations - show everything regardless of saveToLibrary flag
    const { data, error } = await supabase
      .from('media_generations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed') // Only show completed generations
      .not('result_url', 'is', null) // Must have a result URL to display
      .order('created_at', { ascending: false }); // No limit - show ALL generations

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
    }

    console.log(`Found ${data?.length || 0} completed generations with result_url for user ${userId}`);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
