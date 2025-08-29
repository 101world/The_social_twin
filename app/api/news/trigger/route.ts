import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔄 Manual news trigger initiated...');
    
    // Call the scrape-news endpoint manually
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
      
    const response = await fetch(`${baseUrl}/api/cron/scrape-news?manual=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    console.log('📊 Manual trigger result:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Manual news scraping triggered',
      result: result
    });
    
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to trigger manual scraping',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
