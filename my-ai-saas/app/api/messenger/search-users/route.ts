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
    const { searchTerm, currentUserClerkId, limitCount = 10 } = await request.json();

    if (!searchTerm?.trim()) {
      return NextResponse.json([]);
    }

    // Call the messenger_search_users function
    const { data, error } = await supabase.rpc('messenger_search_users', {
      search_term: searchTerm.trim(),
      current_user_clerk_id: currentUserClerkId,
      limit_count: limitCount
    });

    if (error) {
      console.error('Search users error:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Search users API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
