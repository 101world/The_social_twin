export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';

// Allowed values to prevent bad writes
const ALLOWED_PLANS = new Set(['free', 'one t', 'one s', 'one xt', 'one z']);
const ALLOWED_STATUS = new Set(['active', 'trialing', 'past_due', 'canceled', 'inactive']);

export async function GET() {
  try {
    const { userId, getToken } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let jwt: string | null = null;
    try { jwt = await getToken({ template: 'supabase' }); } catch { jwt = null; }
    const supabase = jwt ? createSupabaseClient(jwt) : createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_billing')
      .select('plan, status, next_billing_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      userId,
      plan: data?.plan || 'free',
      status: data?.status || 'inactive',
      next_billing_at: data?.next_billing_at || null,
      updated_at: data?.updated_at || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let jwt: string | null = null;
    try { jwt = await getToken({ template: 'supabase' }); } catch { jwt = null; }
    const supabase = jwt ? createSupabaseClient(jwt) : createSupabaseAdminClient();

    const body = await req.json().catch(() => ({}));
    const planRaw = (body.plan || '').toString().toLowerCase();
    const statusRaw = (body.status || '').toString().toLowerCase();

    if (!ALLOWED_PLANS.has(planRaw)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!ALLOWED_STATUS.has(statusRaw)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_billing')
      .upsert({
        user_id: userId,
        plan: planRaw,
        status: statusRaw,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('plan, status, next_billing_at, updated_at')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      plan: data?.plan || planRaw,
      status: data?.status || statusRaw,
      next_billing_at: data?.next_billing_at || null,
      updated_at: data?.updated_at || new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
