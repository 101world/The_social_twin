import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSafeSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

// Enhanced Project Structure:
// - Saves grid layout (canvas items)
// - Saves chat conversation (messages)
// - Links to media generations
// - Creates unified project experience

export async function POST(req: NextRequest) {
  try {
    const a = await auth();
    let userId = a.userId as string | null;
    const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const title: string = body?.title || 'Untitled Project';
    const gridData = body?.gridData ?? {}; // Canvas items, layout, etc.
    const chatData = body?.chatData ?? {}; // Chat messages, topic info
    const topicId: string | null = body?.topicId || null; // Current chat topic ID
    const thumbnailUrl: string | undefined = body?.thumbnailUrl;

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);
    
    // Enhanced project data structure
    const enhancedData = {
      grid: gridData,
      chat: chatData,
      topicId: topicId,
      version: '2.0', // Enhanced version
      savedAt: new Date().toISOString()
    };

    // Create the enhanced project
    const { data: row, error } = await supabase
      .from('projects')
      .insert({ 
        user_id: userId, 
        title, 
        data: enhancedData, 
        thumbnail_url: thumbnailUrl 
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If we have a topic ID, we can optionally mark it as "saved to project"
    if (topicId) {
      try {
        await supabase
          .from('chat_topics')
          .update({ 
            title: title.includes('Project:') ? title : `Project: ${title}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', topicId)
          .eq('user_id', userId);

        // Add a system message to indicate project was saved
        await supabase
          .from('chat_messages')
          .insert({
            topic_id: topicId,
            user_id: userId,
            role: 'system',
            content: `💾 Project saved as "${title}" - Grid layout and chat history preserved.`
          });
      } catch (e) {
        console.warn('Failed to update topic/add message:', e);
      }
    }

    return NextResponse.json({ 
      ok: true, 
      id: row?.id,
      message: 'Enhanced project saved with chat and grid data'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const a = await auth();
    let userId = a.userId as string | null;
    const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);
    
    const { data, error } = await supabase
      .from('projects')
      .select('id,title,data,thumbnail_url,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Process projects to separate enhanced vs legacy
    const projects = [] as any[];
    for (const p of data || []) {
      // Check if this is an enhanced project (v2.0)
      const isEnhanced = p.data?.version === '2.0';
      const hasChat = isEnhanced && p.data?.chat;
      const hasGrid = isEnhanced && p.data?.grid;
      
      let thumbnailUrl = p.thumbnail_url;
      
      // Resolve storage URLs to signed URLs
      if (typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('storage:')) {
        try {
          const parts = thumbnailUrl.replace('storage:', '').split('/');
          const bucket = parts.shift() as string;
          const path = parts.join('/');
          const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
          if (!signed.error) {
            thumbnailUrl = signed.data.signedUrl;
          }
        } catch {}
      }

      // If no thumbnail and it's enhanced, try to get from grid data
      if (!thumbnailUrl && isEnhanced && p.data?.grid?.canvasItems) {
        try {
          const firstImage = p.data.grid.canvasItems.find((item: any) => 
            item.type === 'image' && item.url
          );
          if (firstImage) {
            thumbnailUrl = firstImage.url;
          }
        } catch {}
      }

      projects.push({
        ...p,
        thumbnail_url: thumbnailUrl,
        enhanced: isEnhanced,
        hasChat,
        hasGrid,
        messageCount: hasChat ? (p.data?.chat?.messages?.length || 0) : 0,
        itemCount: hasGrid ? (p.data?.grid?.canvasItems?.length || 0) : 0
      });
    }

    return NextResponse.json({ projects });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const a = await auth();
    let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id: string = body?.id;
    const gridData = body?.gridData;
    const chatData = body?.chatData;
    const title: string | undefined = body?.title;
    const thumbnailUrl: string | undefined = body?.thumbnailUrl;
    
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createSafeSupabaseClient();
    
    // Get existing project data
    const { data: existing } = await supabase
      .from('projects')
      .select('data')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Merge updated data with existing
    const currentData = existing.data || {};
    const updatedData = {
      ...currentData,
      ...(gridData ? { grid: gridData } : {}),
      ...(chatData ? { chat: chatData } : {}),
      version: '2.0',
      lastUpdated: new Date().toISOString()
    };

    const updatePayload: any = {
      data: updatedData,
      updated_at: new Date().toISOString(),
    };

    if (title) updatePayload.title = title;
    if (thumbnailUrl) updatePayload.thumbnail_url = thumbnailUrl;

    const { error } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    return NextResponse.json({ 
      ok: true,
      message: 'Enhanced project updated'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

// New endpoint to load a project (restore both chat and grid)
export async function PATCH(req: NextRequest) {
  try {
    const a = await auth();
    let userId = a.userId as string | null;
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projectId: string = body?.projectId;
    
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });

    const supabase = createSafeSupabaseClient();
    
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if enhanced project
    const isEnhanced = project.data?.version === '2.0';
    
    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        enhanced: isEnhanced,
        gridData: project.data?.grid || project.data, // Fallback for legacy
        chatData: project.data?.chat || null,
        topicId: project.data?.topicId || null,
        createdAt: project.created_at,
        updatedAt: project.updated_at
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
