import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createSupabaseClient } from '@/lib/supabase/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topicId } = params;
    const { content, role = 'user' } = await request.json();
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    if (!['user', 'ai', 'system'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    
    // Verify topic exists and belongs to user
    const { data: topic, error: topicError } = await supabase
      .from('chat_topics')
      .select('id')
      .eq('id', topicId)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .single();

    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Create the message
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        topic_id: topicId,
        user_id: userId,
        role,
        content: content.trim(),
        metadata: role === 'ai' ? { model: 'gpt-4', tokens: content.length } : null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating message:', error);
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
    }

    // Update topic's updated_at timestamp
    await supabase
      .from('chat_topics')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', topicId);

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error in POST /api/topics/[topicId]/messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topicId } = params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = createSupabaseClient();
    
    // Verify topic exists and belongs to user
    const { data: topic, error: topicError } = await supabase
      .from('chat_topics')
      .select('id')
      .eq('id', topicId)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .single();

    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Get messages with pagination
    const { data: messages, error, count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({
      messages: messages || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in GET /api/topics/[topicId]/messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
