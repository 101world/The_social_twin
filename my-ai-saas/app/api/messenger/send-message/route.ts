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
      senderClerkId, 
      roomId, 
      content, 
      messageType = 'text',
      aiGenerationData = null,
      mediaUrls = null,
      replyToId = null 
    } = await request.json();

    if (!senderClerkId || !roomId || !content?.trim()) {
      return NextResponse.json(
        { error: 'Sender, room ID, and content are required' },
        { status: 400 }
      );
    }

    // Call the messenger_send_message function
    const { data, error } = await supabase.rpc('messenger_send_message', {
      sender_clerk_id: senderClerkId,
      room_id: roomId,
      content: content.trim(),
      message_type: messageType,
      ai_generation_data: aiGenerationData,
      media_urls: mediaUrls,
      reply_to_id: replyToId
    });

    if (error) {
      console.error('Send message error:', error);
      
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Sender not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Failed to send message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      messageId: data,
      message: 'Message sent successfully' 
    });
  } catch (error) {
    console.error('Send message API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
