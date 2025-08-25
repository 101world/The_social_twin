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
    const { roomId, limit = 50, offset = 0 } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Get messages from the room with sender info
    const { data, error } = await supabase
      .from('messenger_messages')
      .select(`
        id,
        content,
        message_type,
        ai_generation_data,
        media_urls,
        reply_to_id,
        created_at,
        updated_at,
        sender:messenger_users!messenger_messages_sender_id_fkey (
          id,
          clerk_id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Get messages error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Format messages for the frontend
    const formattedMessages = (data || []).map(message => {
      // Handle sender data - it might be an object or array depending on the query
      const senderData = Array.isArray(message.sender) ? message.sender[0] : message.sender;
      
      return {
        id: message.id,
        content: message.content,
        messageType: message.message_type,
        aiGenerationData: message.ai_generation_data,
        mediaUrls: message.media_urls,
        replyToId: message.reply_to_id,
        timestamp: new Date(message.created_at).toLocaleTimeString(),
        createdAt: message.created_at,
        sender: senderData ? {
          id: senderData.id,
          clerkId: senderData.clerk_id,
          username: senderData.username,
          displayName: senderData.display_name,
          avatarUrl: senderData.avatar_url
        } : null
      };
    });

    return NextResponse.json(formattedMessages);
  } catch (error) {
    console.error('Get messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
