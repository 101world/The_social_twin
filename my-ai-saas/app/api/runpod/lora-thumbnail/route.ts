import { NextRequest, NextResponse } from 'next/server';
import { pickRunpodUrlFromConfig, getRunpodConfig } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }

    // Get RunPod URL
    const cfg = await getRunpodConfig().catch(() => null);
    const runpodUrl = pickRunpodUrlFromConfig({ 
      mode: 'image', 
      config: cfg 
    });

    if (!runpodUrl) {
      return NextResponse.json({ error: 'No RunPod URL configured' }, { status: 500 });
    }

    // Try to fetch thumbnail from RunPod
    const thumbnailUrl = `${runpodUrl}/api/lora-thumbnail?file=${encodeURIComponent(filename)}`;
    
    try {
      const response = await fetch(thumbnailUrl);
      
      if (response.ok) {
        // Proxy the image response
        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';
        
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          }
        });
      }
    } catch (error) {
      console.log('RunPod thumbnail fetch failed:', error);
    }

    // Fallback: Generate a placeholder thumbnail
    const placeholderSvg = `
      <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" fill="#374151"/>
        <text x="32" y="32" text-anchor="middle" dy=".3em" fill="#9CA3AF" font-family="Arial" font-size="10">
          LoRA
        </text>
        <text x="32" y="45" text-anchor="middle" dy=".3em" fill="#6B7280" font-family="Arial" font-size="8">
          ${filename.split('.')[0].slice(0, 8)}
        </text>
      </svg>
    `;

    return new NextResponse(placeholderSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300' // Cache placeholder for 5 minutes
      }
    });

  } catch (error: any) {
    console.error('LoRA thumbnail error:', error);
    return NextResponse.json({ 
      error: 'Failed to get thumbnail',
      details: error.message 
    }, { status: 500 });
  }
}
