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

    // Get all stable endpoints with their RunPod backends
    const { data: endpoints, error } = await supabase
      .from('stable_endpoints')
      .select(`
        *,
        runpod_endpoints (
          id,
          name,
          url,
          is_active,
          priority,
          health_status,
          last_checked,
          response_time,
          created_at,
          updated_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stable endpoints:', error);
      return NextResponse.json({ error: 'Failed to fetch stable endpoints' }, { status: 500 });
    }

    return NextResponse.json({ endpoints: endpoints || [] });
  } catch (error) {
    console.error('GET /api/admin/stable-endpoints error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, cloudflare_url, is_active = true, code } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    if (!mode || !cloudflare_url) {
      return NextResponse.json({ error: 'Mode and Cloudflare URL are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Check if an endpoint with this mode already exists
    const { data: existing } = await supabase
      .from('stable_endpoints')
      .select('id')
      .eq('mode', mode)
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json({ 
        error: `An active stable endpoint for ${mode} mode already exists` 
      }, { status: 400 });
    }

    // Create new stable endpoint
    const { data: newEndpoint, error } = await supabase
      .from('stable_endpoints')
      .insert([
        {
          mode,
          cloudflare_url,
          is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating stable endpoint:', error);
      return NextResponse.json({ error: 'Failed to create stable endpoint' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Stable endpoint created successfully',
      endpoint: newEndpoint
    });
  } catch (error) {
    console.error('POST /api/admin/stable-endpoints error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, mode, cloudflare_url, is_active, code } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Endpoint ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (mode !== undefined) updateData.mode = mode;
    if (cloudflare_url !== undefined) updateData.cloudflare_url = cloudflare_url;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: updatedEndpoint, error } = await supabase
      .from('stable_endpoints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating stable endpoint:', error);
      return NextResponse.json({ error: 'Failed to update stable endpoint' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Stable endpoint updated successfully',
      endpoint: updatedEndpoint
    });
  } catch (error) {
    console.error('PUT /api/admin/stable-endpoints error:', error);
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
      return NextResponse.json({ error: 'Endpoint ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // First delete all associated RunPod endpoints
    await supabase
      .from('runpod_endpoints')
      .delete()
      .eq('stable_endpoint_id', id);

    // Then delete the stable endpoint
    const { error } = await supabase
      .from('stable_endpoints')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting stable endpoint:', error);
      return NextResponse.json({ error: 'Failed to delete stable endpoint' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Stable endpoint deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/admin/stable-endpoints error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
