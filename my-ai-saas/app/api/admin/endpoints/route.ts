import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const endpoints = await request.json();
    
    // Store endpoints in Supabase (you might want to create an admin_endpoints table)
    const { data, error } = await supabase
      .from('admin_config')
      .upsert({
        key: 'runpod_endpoints',
        value: endpoints,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('Error saving endpoints:', error);
      return NextResponse.json({ error: 'Failed to save endpoints' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in endpoints API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'runpod_endpoints')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching endpoints:', error);
      return NextResponse.json({ error: 'Failed to fetch endpoints' }, { status: 500 });
    }

    const endpoints = data?.value || {
      textToImage: '',
      imageToImage: '',
      textToVideo: '',
      imageToVideo: ''
    };

    return NextResponse.json({ endpoints });
  } catch (error) {
    console.error('Error in endpoints API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
