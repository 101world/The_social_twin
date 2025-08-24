export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

function safeDecodeJwtPart(part: string) {
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  try {
    const a = await auth();
    const userId = a.userId as string | null;
    const getToken = a.getToken;
    if (!userId) return NextResponse.json({ error: 'Unauthorized (not signed in)' }, { status: 401 });

    let token: string | null = null;
    try {
      token = getToken ? await getToken({ template: 'supabase' }) : null;
    } catch (e: any) {
      return NextResponse.json({ error: 'Failed to get Clerk token', details: e?.message || String(e) }, { status: 500 });
    }

    if (!token) {
      return NextResponse.json({ error: 'No token returned from Clerk template "supabase"' }, { status: 200 });
    }

    const [hdr, body] = token.split('.');
    const header = safeDecodeJwtPart(hdr);
    const payload = safeDecodeJwtPart(body);

    const preview = token.length > 24 ? `${token.slice(0, 12)}...${token.slice(-12)}` : token;
    return NextResponse.json({
      ok: true,
      userId,
      tokenPreview: preview,
      header,
      payload,
      checks: {
        has_sub: !!payload?.sub,
        sub_matches_user: payload?.sub === userId,
        aud_is_authenticated: payload?.aud === 'authenticated',
        role_is_authenticated: payload?.role === 'authenticated',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal error', details: e?.message || String(e) }, { status: 500 });
  }
}
