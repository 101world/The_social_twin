import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const code = searchParams.get('code');

    // Verify admin access code
    if (code !== '9820571837') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Search for user by username or email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.%${username}%,email.ilike.%${username}%`)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's generation statistics
    const { data: generations } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Get user's current credits
    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get recent credit transactions
    const { data: creditHistory } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate statistics
    const totalGenerations = generations?.length || 0;
    const last7Days = generations?.filter(g => 
      new Date(g.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length || 0;

    // Calculate generation types breakdown
    const generationTypes = generations?.reduce((acc: any, gen: any) => {
      const mode = gen.mode || 'unknown';
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {}) || {};

    // Find most used mode
    const favoriteMode = Object.entries(generationTypes).reduce((a: any, b: any) => 
      generationTypes[a[0]] > generationTypes[b[0]] ? a : b
    )?.[0] || 'none';

    // Calculate average daily usage
    const daysSinceJoined = user.created_at ? 
      Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)) || 1 : 1;
    const avgDaily = Math.round((totalGenerations / daysSinceJoined) * 100) / 100;

    // Find peak day
    const dailyUsage = generations?.reduce((acc: any, gen: any) => {
      const date = new Date(gen.created_at).toDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {}) || {};
    
    const peakDay = Object.entries(dailyUsage).reduce((a: any, b: any) => 
      dailyUsage[a[0]] > dailyUsage[b[0]] ? a : b
    )?.[0] || 'N/A';

    // Get recent activity (last 10 generations)
    const recentActivity = generations?.slice(0, 10).map(gen => ({
      mode: gen.mode,
      prompt: gen.prompt,
      status: gen.status,
      created_at: gen.created_at
    })) || [];

    // Prepare response
    const userReport = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      stats: {
        totalGenerations,
        currentCredits: userCredits?.credits || 0,
        last7Days,
        favoriteMode,
        avgDaily,
        peakDay,
        lastActivity: generations?.[0]?.created_at || null
      },
      generationTypes,
      recentActivity,
      creditHistory: creditHistory || []
    };

    return NextResponse.json(userReport);

  } catch (error) {
    console.error('Error in user report API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
