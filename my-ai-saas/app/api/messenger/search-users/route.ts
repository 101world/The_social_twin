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

    const termRaw = typeof searchTerm === 'string' ? searchTerm : '';
    const term = termRaw.trim();
    if (!term) return NextResponse.json([]);

    const limit = Math.min(25, Math.max(1, Number(limitCount) || 10));
    const isEmail = term.includes('@');

    // Build query: strict username/email-only discovery, exclude self
    let query = supabase
      .from('messenger_users')
      .select('id, clerk_id, username, display_name, avatar_url, is_online, custom_status')
      .neq('clerk_id', currentUserClerkId)
      .order('username', { ascending: true })
      .limit(limit);

    if (isEmail) {
      // Email search (case-insensitive contains)
      query = query.ilike('email', `%${term}%`);
    } else {
      // Username search only (case-insensitive contains)
      query = query.ilike('username', `%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Search users error:', error);
      return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
    }

    // Sort exact matches to top
    const out = (data || []).sort((a: any, b: any) => {
      const ta = (isEmail ? (a.email || '') : (a.username || '')).toLowerCase();
      const tb = (isEmail ? (b.email || '') : (b.username || '')).toLowerCase();
      const t = term.toLowerCase();
      const ea = ta === t ? 0 : 1;
      const eb = tb === t ? 0 : 1;
      return ea - eb;
    });

    return NextResponse.json(out);
  } catch (error) {
    console.error('Search users API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
