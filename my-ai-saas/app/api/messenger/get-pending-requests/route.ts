import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
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
