export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

async function computeHmacHex(secret: string, data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyClerkSignature(secret: string, body: string, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  try {
    const expected = await computeHmacHex(secret, body);
    return signatureHeader.includes(expected) || signatureHeader === expected;
  } catch (err) {
    console.error('HMAC compute error', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const sigHeader = req.headers.get('x-clerk-signature-256') || req.headers.get('x-clerk-signature');
    const bodyText = await req.text();

    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (secret) {
      const ok = await verifyClerkSignature(secret, bodyText, sigHeader);
      if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let evt: unknown = null;
    try { evt = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const e = evt as any;

    const eventId = e?.id || e?.data?.id || null;
    if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    // Idempotency: check processed_webhooks
    const { data: existing } = await admin.from('processed_webhooks').select('id').eq('id', eventId).maybeSingle();
    if (existing) return NextResponse.json({ ok: true });

    // Handle subscription/payment events
    const t = e?.type || e?.event || '';
    if (String(t).startsWith('subscription') || String(t).startsWith('payment')) {
      const userId = e?.data?.object?.metadata?.clerk_user_id || e?.data?.object?.metadata?.user_id || null;
      const subId = e?.data?.object?.id || e?.data?.object?.subscription || null;
      const status = e?.data?.object?.status ?? e?.data?.object?.paid ?? 'unknown';

      if (userId) {
        await admin.from('user_billing').upsert([{ user_id: userId, plan: e?.data?.object?.price?.nickname || null, status: String(status), clerk_subscription_id: subId }]);
      }
    }

    await admin.from('processed_webhooks').insert([{ id: eventId, source: 'clerk' }]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Clerk webhook error', err);
    return NextResponse.json({ error: (err as Error).message || 'Webhook failed' }, { status: 500 });
  }
}
