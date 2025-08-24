export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';

// Deprecated: Use /api/users/credits which now includes allowances and usage.
export async function GET(_req: NextRequest) {
  return NextResponse.json({ error: 'Use /api/users/credits (includes allowances)' }, { status: 410 });
}
