import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user1ClerkId, user2ClerkId } = await request.json();

    if (!user1ClerkId || !user2ClerkId) {
      return NextResponse.json(
        { error: 'Both user clerk IDs are required' },
        { status: 400 }
      );
    }

    if (user1ClerkId === user2ClerkId) {
      return NextResponse.json(
        { error: 'Cannot create DM room with yourself' },
        { status: 400 }
      );
    }

    // Call the messenger_get_or_create_dm_room function
    const { data, error } = await supabase.rpc('messenger_get_or_create_dm_room', {
      user1_clerk_id: user1ClerkId,
      user2_clerk_id: user2ClerkId
    });

    if (error) {
      console.error('Get or create DM room error:', error);
      
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'One or both users not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Failed to create or get DM room' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      roomId: data,
      message: 'DM room ready' 
    });
  } catch (error) {
    console.error('Get or create DM room API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
