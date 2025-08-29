import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSafeSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

// Get individual enhanced project by ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const a = await auth();
    let userId = a.userId as string | null;
    const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = params.id;
    if (!projectId) return NextResponse.json({ error: 'Missing project ID' }, { status: 400 });

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);
    
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if enhanced project (v2.0) or legacy
    const isEnhanced = project.data?.version === '2.0';
    
    if (isEnhanced) {
      // Enhanced project - separate grid and chat data
      return NextResponse.json({
        id: project.id,
        title: project.title,
        enhanced: true,
        gridData: project.data?.grid || { items: [], edges: [] },
        chatData: project.data?.chat || { messages: [], messageCount: 0 },
        topicId: project.data?.topicId || null,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        thumbnailUrl: project.thumbnail_url
      });
    } else {
      // Legacy project - convert to enhanced format
      return NextResponse.json({
        id: project.id,
        title: project.title,
        enhanced: false,
        gridData: { 
          items: project.data?.items || project.data?.canvasItems || [], 
          edges: project.data?.edges || [] 
        },
        chatData: { 
          messages: project.data?.messages || [], 
          messageCount: project.data?.messages?.length || 0 
        },
        topicId: null,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        thumbnailUrl: project.thumbnail_url
      });
    }
  } catch (e: any) {
    console.error('Enhanced project GET error:', e);
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

// Update individual enhanced project by ID
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const a = await auth();
    let userId = a.userId as string | null;
    const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = params.id;
    const body = await req.json();
    const { title, gridData, chatData, topicId, thumbnailUrl } = body;
    
    if (!projectId) return NextResponse.json({ error: 'Missing project ID' }, { status: 400 });

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = createSafeSupabaseClient(jwt || undefined);
    
    // Get existing project data
    const { data: existing } = await supabase
      .from('projects')
      .select('data')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Merge updated data with existing (enhanced format)
    const currentData = existing.data || {};
    const updatedData = {
      ...currentData,
      ...(gridData ? { grid: gridData } : {}),
      ...(chatData ? { chat: chatData } : {}),
      ...(topicId !== undefined ? { topicId } : {}),
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
      .eq('id', projectId)
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    return NextResponse.json({ 
      ok: true,
      message: 'Project updated successfully'
    });
  } catch (e: any) {
    console.error('Enhanced project PUT error:', e);
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
