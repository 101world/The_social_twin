// Simple API test that should definitely work
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'working',
    message: 'API routes are functional',
    timestamp: new Date().toISOString()
  });
}

export async function POST() {
  return NextResponse.json({ 
    status: 'working',
    message: 'POST method functional',
    timestamp: new Date().toISOString()
  });
}
