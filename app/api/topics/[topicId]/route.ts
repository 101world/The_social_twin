import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createSupabaseClient } from '@/lib/supabase/client';

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
    const supabase = createSupabaseClient();
    
    const { data: topic, error } = await supabase
      .from('chat_topics')
      .select(`
        id,
        title,
        description,
        is_archived,
        created_at,
        updated_at
      `)
      .eq('id', topicId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      }
      console.error('Error fetching topic:', error);
      return NextResponse.json({ error: 'Failed to fetch topic' }, { status: 500 });
    }

    return NextResponse.json(topic);
  } catch (error) {
    console.error('Error in GET /api/topics/[topicId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topicId } = params;
    const { title, description, is_archived } = await request.json();
    
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (is_archived !== undefined) updateData.is_archived = is_archived;
    
    const { data: topic, error } = await supabase
      .from('chat_topics')
      .update(updateData)
      .eq('id', topicId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      }
      console.error('Error updating topic:', error);
      return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 });
    }

    return NextResponse.json(topic);
  } catch (error) {
    console.error('Error in PUT /api/topics/[topicId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topicId } = params;
    const supabase = createSupabaseClient();
    
    // Soft delete by archiving
    const { error } = await supabase
      .from('chat_topics')
      .update({ is_archived: true })
      .eq('id', topicId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error archiving topic:', error);
      return NextResponse.json({ error: 'Failed to archive topic' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/topics/[topicId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
