import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createSupabaseClient } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description } = await request.json();
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    
    // Check if user exists in our users table, create if not
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingUser) {
      // Get user info from Clerk
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from('users')
          .insert({
            id: userId,
            email: userData.user.email || '',
            name: userData.user.user_metadata?.name || null,
            credits: 10, // Default free tier credits
            subscription_active: false,
            subscription_plan: 'Free'
          });
      }
    }

    // Create the topic
    const { data: topic, error } = await supabase
      .from('chat_topics')
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description?.trim() || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating topic:', error);
      return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 });
    }

    return NextResponse.json(topic);
  } catch (error) {
    console.error('Error in POST /api/topics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient();
    
    const { data: topics, error } = await supabase
      .from('chat_topics')
      .select(`
        id,
        title,
        description,
        is_archived,
        created_at,
        updated_at,
        chat_messages!inner(id)
      `)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching topics:', error);
      return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
    }

    // Transform data to include message count
    const topicsWithCounts = topics?.map(topic => ({
      ...topic,
      message_count: topic.chat_messages?.length || 0
    })) || [];

    return NextResponse.json(topicsWithCounts);
  } catch (error) {
    console.error('Error in GET /api/topics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
