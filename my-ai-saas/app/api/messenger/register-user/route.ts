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

    // Call the messenger_upsert_user function to create/update user (preferred)
    let callError: any | null = null;
    let userId: any | null = null;
    try {
      const { data, error } = await supabase.rpc('messenger_upsert_user', {
        p_clerk_id: clerkId,
        p_username: username,
        p_display_name: displayName || username,
        p_email: email,
        p_avatar_url: avatarUrl
      });
      if (error) throw error;
      userId = data;
    } catch (err: any) {
      callError = err;
    }

    // Fallback to messenger_register_user if upsert function isn't available
    if (callError) {
      try {
        const { data, error } = await supabase.rpc('messenger_register_user', {
          user_clerk_id: clerkId,
          user_username: username,
          user_display_name: displayName || username,
          user_email: email,
          user_avatar_url: avatarUrl
        });
        if (error) throw error;
        userId = data;
      } catch (fallbackErr: any) {
        console.error('Register user error (both upsert and fallback failed):', fallbackErr);
        return NextResponse.json(
          { error: fallbackErr?.message || callError?.message || 'Failed to register user' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      userId,
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
