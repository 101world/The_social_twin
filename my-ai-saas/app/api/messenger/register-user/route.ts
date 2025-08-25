import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { 
      clerkId, 
      username, 
      displayName, 
      email, 
      avatarUrl 
    } = await request.json();

    if (!clerkId || !username) {
      return NextResponse.json(
        { error: 'Clerk ID and username are required' },
        { status: 400 }
      );
    }

    // Call the messenger_upsert_user function to create/update user
    const { data, error } = await supabase.rpc('messenger_upsert_user', {
      p_clerk_id: clerkId,
      p_username: username,
      p_display_name: displayName || username,
      p_email: email,
      p_avatar_url: avatarUrl
    });

    if (error) {
      console.error('Register user error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to register user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      userId: data,
      message: 'User registered successfully in messenger system' 
    });
  } catch (error) {
    console.error('Register user API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
