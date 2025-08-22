export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const a = await auth();
    const userId = a.userId as string | null;
    const getToken = a.getToken;
    let jwt: string | null = null;
    try { jwt = getToken ? await getToken({ template: 'supabase' }) : null; } catch {}
    // Dev fallback without auth or admin key
    if (process.env.NODE_ENV !== 'production' && !userId && !jwt && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ items: [] });
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = jwt ? createSupabaseClient(jwt) : createSupabaseAdminClient();
    const q = req.nextUrl.searchParams;
    const limit = Number(q.get('limit') || '50');
    const page = Number(q.get('page') || '0');

    // Try media_generations table first (newer, more complete data)
    const { data: mediaGens, error: mediaError } = await supabase
      .from('media_generations')
      .select('id,type,prompt,result_url,thumbnail_url,generation_params,created_at,status,error_message,user_id')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (!mediaError && mediaGens && mediaGens.length > 0) {
      // Transform media_generations data to match expected generations format
      const transformedData = await Promise.all(mediaGens.map(async (item) => {
        let display_url: string | null = null;
        let content: string | null = null;
        
        // Get display URL (prioritize thumbnail, then result_url)
        try {
          if (item.thumbnail_url && item.thumbnail_url.startsWith('storage:')) {
            const parts = item.thumbnail_url.replace('storage:', '').split('/');
            const bucket = parts.shift() as string;
            const path = parts.join('/');
            const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
            if (!signed.error) display_url = signed.data.signedUrl;
          }
          
          if (!display_url && item.result_url && item.result_url.startsWith('storage:')) {
            const parts = item.result_url.replace('storage:', '').split('/');
            const bucket = parts.shift() as string;
            const path = parts.join('/');
            const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
            if (!signed.error) display_url = signed.data.signedUrl;
          }
          
          // Check generation_params for transient URLs
          if (!display_url && item.generation_params && Array.isArray(item.generation_params.result_urls)) {
            display_url = item.generation_params.result_urls[0];
          }
          
          if (!display_url && item.result_url && !item.result_url.startsWith('storage:')) {
            display_url = item.result_url;
          }
        } catch (e) {
          // ignore
        }

        // For text generations, extract content from generation_params if available
        if (item.type === 'text' && item.generation_params) {
          content = item.generation_params.generated_text || item.generation_params.text || null;
        }

        return {
          id: item.id,
          user_id: item.user_id,
          type: item.type,
          prompt: item.prompt,
          result_url: display_url,
          content: content,
          posted: false, // media_generations doesn't track this
          metadata: {
            status: item.status,
            error_message: item.error_message,
            generation_params: item.generation_params,
            original_result_url: item.result_url,
            thumbnail_url: item.thumbnail_url
          },
          created_at: item.created_at,
          posted_at: null
        };
      }));
      
      return NextResponse.json({ items: transformedData });
    }

    // Fallback to generations table if media_generations is empty or has error
    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    console.error('GET /api/generations error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const a = await auth();
    const userId = a.userId as string | null;
    const getToken = a.getToken;
    let jwt: string | null = null;
    try { jwt = getToken ? await getToken({ template: 'supabase' }) : null; } catch {}
    // Dev fallback: accept writes but no-op locally when not authenticated and no admin key
    if (process.env.NODE_ENV !== 'production' && !userId && !jwt && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const body = (await req.json().catch(() => ({}))) as any;
      return NextResponse.json({ item: { id: 'dev', user_id: 'dev', created_at: new Date().toISOString(), ...body } });
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
    const body = (await req.json()) as Record<string, unknown>;
    const type = String(body.type || '');
    const prompt = body.prompt ? String(body.prompt) : null;
    const result_url = body.result_url ? String(body.result_url) : null;
    const content = body.content ? String(body.content) : null;
    const metadata = body.metadata ?? null;

    if (!type || !['text', 'image', 'video'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const supabase = jwt ? createSupabaseClient(jwt) : createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('generations')
      .insert([
        { user_id: userId, type, prompt, result_url, content, metadata },
      ])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('POST /api/generations error', err);
    return NextResponse.json({ error: (err as Error).message || 'Internal server error' }, { status: 500 });
  }
}
