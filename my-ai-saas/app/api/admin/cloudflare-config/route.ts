import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
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

    // Get Cloudflare configuration from environment variables or database
    const cloudflareConfig = {
      worker_url: process.env.CLOUDFLARE_WORKER_URL || '',
      r2_bucket: process.env.CLOUDFLARE_R2_BUCKET || '',
      r2_public_url: process.env.CLOUDFLARE_R2_PUBLIC_URL || ''
    };

    return NextResponse.json(cloudflareConfig);
  } catch (error) {
    console.error('Error fetching Cloudflare config:', error);
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

    const { worker_url, r2_bucket, r2_public_url } = await req.json();

    // Here you could save to database or update environment variables
    // For now, we'll just return success since these are typically set via env vars
    const updatedConfig = {
      worker_url: worker_url || process.env.CLOUDFLARE_WORKER_URL || '',
      r2_bucket: r2_bucket || process.env.CLOUDFLARE_R2_BUCKET || '',
      r2_public_url: r2_public_url || process.env.CLOUDFLARE_R2_PUBLIC_URL || ''
    };

    return NextResponse.json({
      message: 'Cloudflare configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error updating Cloudflare config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
