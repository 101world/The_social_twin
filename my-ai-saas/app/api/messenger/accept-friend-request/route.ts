import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { friendshipId, userClerkId } = await request.json();

    if (!friendshipId || !userClerkId) {
      return NextResponse.json(
        { error: 'Friendship ID and user clerk ID are required' },
        { status: 400 }
      );
    }

    // Call the messenger_accept_friend_request function
    const { data, error } = await supabase.rpc('messenger_accept_friend_request', {
      friendship_id: friendshipId,
      user_clerk_id: userClerkId
    });

    if (error) {
      console.error('Accept friend request error:', error);
      
      // Handle specific error cases
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Friend request not found or already processed' },
          { status: 404 }
        );
      }
      
      if (error.message.includes('can only accept')) {
        return NextResponse.json(
          { error: 'You can only accept requests sent to you' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Failed to accept friend request' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Friend request accepted successfully' 
    });
  } catch (error) {
    console.error('Accept friend request API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
