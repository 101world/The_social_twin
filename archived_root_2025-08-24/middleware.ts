import { NextResponse } from 'next/server';

// Root Next.js app is deprecated. Prevent accidental deploy/use by returning 410 for all routes.
export function middleware() {
  return new NextResponse(
    'Deprecated app tree. Please deploy from my-ai-saas/ (set Vercel Root Directory to my-ai-saas).',
    { status: 410, headers: { 'content-type': 'text/plain; charset=utf-8' } }
  );
}

export const config = { matcher: '/:path*' };
