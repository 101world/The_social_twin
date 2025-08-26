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

    // Enforce username/email-only discovery with normalization
    const term = String(searchTerm).trim();
    const isEmail = term.includes('@');
    // Prefer exact match on username or email; fall back to ILIKE prefix
    const { data, error } = await supabase.rpc('messenger_search_users', {
      search_term: term,
      current_user_clerk_id: currentUserClerkId,
      limit_count: Math.min(25, Math.max(1, Number(limitCount) || 10)),
      exact: true,
      by_email: isEmail
    });

    if (error) {
      console.error('Search users error:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

  // Shape to consistent array for client
  return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Search users API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
