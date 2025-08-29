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
    const { requesterClerkId, addresseeClerkId, requestMessage } = await request.json();

    if (!requesterClerkId || !addresseeClerkId) {
      return NextResponse.json(
        { error: 'Both requester and addressee clerk IDs are required' },
        { status: 400 }
      );
    }

    if (requesterClerkId === addresseeClerkId) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
        { status: 400 }
      );
    }

    // Call the messenger_send_friend_request function
    const { data, error } = await supabase.rpc('messenger_send_friend_request', {
      requester_clerk_id: requesterClerkId,
      addressee_clerk_id: addresseeClerkId,
      request_message: requestMessage || 'Hi! I\'d like to connect with you.'
    });

    if (error) {
      console.error('Send friend request error:', error);
      
      // Handle specific error cases
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Friend request already sent or friendship already exists' },
          { status: 409 }
        );
      }
      
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Failed to send friend request' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      friendshipId: data,
      message: 'Friend request sent successfully' 
    });
  } catch (error) {
    console.error('Send friend request API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
