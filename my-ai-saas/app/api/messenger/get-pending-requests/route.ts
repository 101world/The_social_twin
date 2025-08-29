import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { userClerkId } = await request.json();

    if (!userClerkId) {
      return NextResponse.json(
        { error: 'User clerk ID is required' },
        { status: 400 }
      );
    }

    // Call the messenger_get_pending_requests function
    const { data, error } = await supabase.rpc('messenger_get_pending_requests', {
      user_clerk_id: userClerkId
    });

    if (error) {
      console.error('Get pending requests error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending requests' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Get pending requests API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
