export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you can customize this logic)
    const isAdmin = userId === process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
                    process.env.ADMIN_USER_IDS?.split(',').includes(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = userId === process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
                    process.env.ADMIN_USER_IDS?.split(',').includes(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { mode, url, is_active = true } = body;

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
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = userId === process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
                    process.env.ADMIN_USER_IDS?.split(',').includes(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { id, mode, url, is_active } = body;

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
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = userId === process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
                    process.env.ADMIN_USER_IDS?.split(',').includes(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;

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
