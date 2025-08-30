export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

const ADMIN_CODE = '9820571837';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      stable_endpoint_id, 
      name, 
      url, 
      is_active = true, 
      priority = 1,
      code 
    } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    if (!stable_endpoint_id || !name || !url) {
      return NextResponse.json({ 
        error: 'Stable endpoint ID, name, and URL are required' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Verify the stable endpoint exists
    const { data: stableEndpoint } = await supabase
      .from('stable_endpoints')
      .select('id')
      .eq('id', stable_endpoint_id)
      .single();

    if (!stableEndpoint) {
      return NextResponse.json({ 
        error: 'Stable endpoint not found' 
      }, { status: 404 });
    }

    // Create new RunPod endpoint
    const { data: newEndpoint, error } = await supabase
      .from('runpod_endpoints')
      .insert([
        {
          stable_endpoint_id,
          name,
          url,
          is_active,
          priority,
          health_status: 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating RunPod endpoint:', error);
      return NextResponse.json({ error: 'Failed to create RunPod endpoint' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'RunPod endpoint created successfully',
      endpoint: newEndpoint
    });
  } catch (error) {
    console.error('POST /api/admin/runpod-endpoints error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      id, 
      name, 
      url, 
      is_active, 
      priority, 
      health_status,
      response_time,
      code 
    } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'RunPod endpoint ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (priority !== undefined) updateData.priority = priority;
    if (health_status !== undefined) {
      updateData.health_status = health_status;
      updateData.last_checked = new Date().toISOString();
    }
    if (response_time !== undefined) updateData.response_time = response_time;

    const { data: updatedEndpoint, error } = await supabase
      .from('runpod_endpoints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating RunPod endpoint:', error);
      return NextResponse.json({ error: 'Failed to update RunPod endpoint' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'RunPod endpoint updated successfully',
      endpoint: updatedEndpoint
    });
  } catch (error) {
    console.error('PUT /api/admin/runpod-endpoints error:', error);
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
      return NextResponse.json({ error: 'RunPod endpoint ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('runpod_endpoints')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting RunPod endpoint:', error);
      return NextResponse.json({ error: 'Failed to delete RunPod endpoint' }, { status: 500 });
    }

    return NextResponse.json({ message: 'RunPod endpoint deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/admin/runpod-endpoints error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
