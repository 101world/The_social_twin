import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
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
