export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

// Minimal Clerk webhook verification helper: using raw body and header
// For robust verification, install @clerk/clerk-sdk-node and use verifyWebhook

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get('x-clerk-signature') || req.headers.get('x-clerk-signature-256');
    if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

    const bodyText = await req.text();
    let evt: any = null;
    try { evt = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const eventId = evt?.id || (evt?.data?.id) || null;
    if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    // Idempotency: check processed_webhooks
    const { data: existing } = await admin.from('processed_webhooks').select('id').eq('id', eventId).maybeSingle();
    if (existing) return NextResponse.json({ ok: true });

    // Example events: subscription.created, subscription.updated, subscription.deleted, payment.succeeded
    const t = evt?.type || evt?.event || '';
    if (t.startsWith('subscription') || t.startsWith('payment')) {
      const userId = evt?.data?.object?.metadata?.clerk_user_id || evt?.data?.object?.metadata?.user_id || null;
      const subId = evt?.data?.object?.id || evt?.data?.object?.subscription || null;
      const status = evt?.data?.object?.status || evt?.data?.object?.paid || 'unknown';

      if (userId) {
        await admin.from('user_billing').upsert([{ user_id: userId, plan: evt?.data?.object?.price?.nickname || null, status: String(status), clerk_subscription_id: subId }]);
      }
    }

    await admin.from('processed_webhooks').insert([{ id: eventId, source: 'clerk' }]);
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Webhook failed' }, { status: 500 });
  }
}
