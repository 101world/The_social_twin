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

    // Get user ID first
    const { data: userData, error: userError } = await supabase
      .from('messenger_users')
      .select('id')
      .eq('clerk_id', userClerkId)
      .single();

    if (userError || !userData) {
      return NextResponse.json([]);
    }

    // Get accepted friendships where user is either requester or addressee
    const { data: friendships, error } = await supabase
      .from('messenger_friendships')
      .select(`
        id,
        requester_id,
        addressee_id,
        friend_since,
        requester:messenger_users!messenger_friendships_requester_id_fkey (
          id,
          clerk_id,
          username,
          display_name,
          avatar_url,
          is_online,
          custom_status,
          last_seen
        ),
        addressee:messenger_users!messenger_friendships_addressee_id_fkey (
          id,
          clerk_id,
          username,
          display_name,
          avatar_url,
          is_online,
          custom_status,
          last_seen
        )
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userData.id},addressee_id.eq.${userData.id}`);

    if (error) {
      console.error('Get friends error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch friends' },
        { status: 500 }
      );
    }

    // Format friends list
    const formattedFriends = (friendships || []).map(friendship => {
      // Determine which user is the friend (not the current user)
      const isRequester = friendship.requester_id === userData.id;
      const friendData = isRequester ? friendship.addressee : friendship.requester;
      
      // Handle array/object type issues
      const friend = Array.isArray(friendData) ? friendData[0] : friendData;

      return {
        id: friend?.id,
        clerkId: friend?.clerk_id,
        username: friend?.username,
        displayName: friend?.display_name,
        avatarUrl: friend?.avatar_url,
        isOnline: friend?.is_online || false,
        customStatus: friend?.custom_status,
        lastSeen: friend?.last_seen,
        friendSince: friendship.friend_since,
        // For UI compatibility
        name: friend?.display_name || friend?.username || 'Unknown',
        avatar: friend?.username?.[0]?.toUpperCase() || '?',
        status: friend?.custom_status || (friend?.is_online ? 'Online' : 'Offline')
      };
    });

    return NextResponse.json(formattedFriends);
  } catch (error) {
    console.error('Get friends API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
