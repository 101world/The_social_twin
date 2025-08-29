export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

const ADMIN_CODE = '9820571837';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const accessCode = url.searchParams.get('code');

    if (!accessCode || accessCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    // Get all RunPod configurations
    const { data: configs, error } = await supabase
      .from('runpod_config')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching RunPod configs:', error);
      return NextResponse.json({ error: 'Failed to fetch configurations' }, { status: 500 });
    }

    return NextResponse.json({ configs: configs || [] });
  } catch (error) {
    console.error('GET /api/admin/runpod-config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, url, is_active = true, code } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    if (!mode || !url) {
      return NextResponse.json({ error: 'Mode and URL are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Insert new configuration
    const { data, error } = await supabase
      .from('runpod_config')
      .insert([{
        mode,
        url,
        is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating RunPod config:', error);
      return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('POST /api/admin/runpod-config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, mode, url, is_active, code } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Update configuration
    const { data, error } = await supabase
      .from('runpod_config')
      .update({
        mode,
        url,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating RunPod config:', error);
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('PUT /api/admin/runpod-config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, code } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Delete configuration
    const { error } = await supabase
      .from('runpod_config')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting RunPod config:', error);
      return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/runpod-config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
