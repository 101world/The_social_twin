import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Get ALL generations for this user with status breakdown
    const { data: allGenerations, error: allError } = await supabase
      .from('media_generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('Supabase error:', allError);
      return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
    }

    // Analyze the data
    const total = allGenerations?.length || 0;
    const completed = allGenerations?.filter(g => g.status === 'completed').length || 0;
    const pending = allGenerations?.filter(g => g.status === 'pending').length || 0;
    const failed = allGenerations?.filter(g => g.status === 'failed').length || 0;
    const withMediaUrl = allGenerations?.filter(g => g.media_url).length || 0;
    const withResultUrl = allGenerations?.filter(g => g.result_url).length || 0;

    // Sample of recent generations
    const recentSample = allGenerations?.slice(0, 10).map(g => ({
      id: g.id,
      status: g.status,
      type: g.type,
      created_at: g.created_at,
      completed_at: g.completed_at,
      has_media_url: !!g.media_url,
      has_result_url: !!g.result_url,
      prompt_preview: g.prompt?.substring(0, 50) + (g.prompt?.length > 50 ? '...' : '')
    }));

    return NextResponse.json({
      user_id: userId,
      total_generations: total,
      status_breakdown: {
        completed,
        pending,
        failed
      },
      url_stats: {
        with_media_url: withMediaUrl,
        with_result_url: withResultUrl
      },
      recent_sample: recentSample,
      completed_generations: allGenerations?.filter(g => g.status === 'completed').slice(0, 5)
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
