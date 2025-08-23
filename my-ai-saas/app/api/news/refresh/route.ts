import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Placeholder: could trigger a background job/webhook later
    return NextResponse.json({ ok: true, message: 'Refresh acknowledged' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown' }, { status: 500 });
  }
}
