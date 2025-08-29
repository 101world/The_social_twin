import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_CODE = '9820571837';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const accessCode = url.searchParams.get('code');

    if (!accessCode || accessCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    // Get Cloudflare configuration from environment variables or database
    const cloudflareConfig = {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      r2_access_key_id: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      r2_secret_access_key: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      r2_bucket: process.env.R2_BUCKET_NAME || '',
      r2_public_url: process.env.R2_PUBLIC_URL || ''
    };

    return NextResponse.json(cloudflareConfig);
  } catch (error) {
    console.error('Error fetching Cloudflare config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code || code !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 });
    }

    // Return current configuration since these are set via environment variables
    const currentConfig = {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      r2_access_key_id: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      r2_secret_access_key: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      r2_bucket: process.env.R2_BUCKET_NAME || '',
      r2_public_url: process.env.R2_PUBLIC_URL || ''
    };

    return NextResponse.json({
      message: 'Cloudflare configuration retrieved successfully',
      config: currentConfig
    });
  } catch (error) {
    console.error('Error fetching Cloudflare config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
