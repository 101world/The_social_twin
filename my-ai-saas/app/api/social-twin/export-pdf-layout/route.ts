export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';

interface PdfItem {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  url?: string;
  text?: string;
  fontSize?: number;
}

interface PdfPage {
  id: string;
  items: PdfItem[];
}

interface ExportRequest {
  pages: PdfPage[];
  fileName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: ExportRequest = await req.json();
    const { pages, fileName = 'layout_export.pdf' } = body;

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: 'No pages to export' }, { status: 400 });
    }

    // Check and deduct credits (PDF export costs 1 credit)
    const supabaseAdmin = createSupabaseAdminClient();
    const REQUIRED_CREDITS = 1;

    // Use the working deduct_credits_simple function
    const { data: creditResult, error: creditError } = await supabaseAdmin.rpc('deduct_credits_simple', {
      p_user_id: userId,
      p_amount: REQUIRED_CREDITS
    });

    if (creditError) {
      console.error('Credit management error:', creditError);
      return NextResponse.json({ error: 'Failed to process credits' }, { status: 500 });
    }

    // creditResult is the remaining credits number, or null if insufficient
    if (creditResult === null) {
      return NextResponse.json({
        error: 'Insufficient credits',
        required: REQUIRED_CREDITS,
        available: 0
      }, { status: 402 });
    }

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: 'No pages to export' }, { status: 400 });
    }

    // Use jsPDF for client-side compatibility
    const { jsPDF } = await import('jspdf');

    const tmpDir = path.join(process.cwd(), '.next', 'cache', 'export');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    let isFirstPage = true;

    for (const page of pages) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      // Sort items by z-index (images first, then text on top)
      const sortedItems = [...page.items].sort((a, b) => {
        if (a.type === 'image' && b.type === 'text') return -1;
        if (a.type === 'text' && b.type === 'image') return 1;
        return 0;
      });

      for (const item of sortedItems) {
        try {
          console.log(`Processing item: ${item.type}, url: ${item.url}`);
          if (item.type === 'image' && item.url) {
            // Handle different URL types
            let imageData = item.url;
            
            // If it's a proxy URL, extract the original URL and fetch directly
            if (item.url.includes('/api/social-twin/proxy')) {
              try {
                // Extract the original URL from the proxy URL
                const urlMatch = item.url.match(/[?&]url=([^&]+)/);
                if (urlMatch) {
                  const originalUrl = decodeURIComponent(urlMatch[1]);
                  console.log(`Fetching image directly from: ${originalUrl}`);
                  const response = await fetch(originalUrl);
                  console.log(`Image fetch status: ${response.status}`);
                  
                  if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    imageData = `data:image/png;base64,${buffer.toString('base64')}`;
                    console.log(`Image converted to base64, length: ${imageData.length}`);
                  } else {
                    console.warn(`Failed to fetch image: ${response.status} ${response.statusText}`);
                    continue; // Skip this image
                  }
                } else {
                  console.warn('Could not extract original URL from proxy URL');
                  continue; // Skip this image
                }
              } catch (proxyError) {
                console.warn('Failed to fetch proxy image:', proxyError);
                continue; // Skip this image
              }
            } else if (item.url.startsWith('http')) {
              // Direct URL, fetch it
              try {
                const response = await fetch(item.url);
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  imageData = `data:image/png;base64,${buffer.toString('base64')}`;
                } else {
                  console.warn(`Failed to fetch direct image: ${response.status}`);
                  continue;
                }
              } catch (error) {
                console.warn('Failed to fetch direct image:', error);
                continue;
              }
            }
            // If it's already a data URL, use it as-is

            // Add image to PDF
            console.log(`Adding image to PDF at position: x=${item.x}, y=${item.y}, w=${item.w}, h=${item.h}`);
            doc.addImage(
              imageData,
              'PNG',
              item.x,
              item.y,
              item.w,
              item.h,
              undefined,
              'FAST'
            );
            console.log('Image added successfully to PDF');
          } else if (item.type === 'text' && item.text) {
            // Add text to PDF
            const fontSize = item.fontSize || 16;
            doc.setFontSize(fontSize);
            doc.setTextColor(0, 0, 0); // Black text
            
            // Simple text wrapping
            const maxWidth = item.w - 10; // Padding
            const lines = doc.splitTextToSize(item.text, maxWidth);
            
            doc.text(lines, item.x + 5, item.y + fontSize + 5);
            console.log(`Added text to PDF: "${item.text}"`);
          }
        } catch (itemError) {
          console.warn('Failed to add item to PDF:', itemError);
          // Continue with other items
        }
      }
    }

    // Save PDF to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    await fs.writeFile(tmpPath, pdfBuffer);

    // Upload to Supabase storage
    const supabase = createSupabaseAdminClient();
    const bucket = 'generated-pdfs';
    
    // Ensure bucket exists
    try {
      await (supabase as any).storage.createBucket(bucket, { public: false });
    } catch {
      // Bucket might already exist
    }

    const cleanFileName = fileName.replace(/[^a-z0-9_.-]/gi, '_');
    const storageFileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanFileName}`;
    const storagePath = `${userId}/${storageFileName}`;
    
    const fileBytes = await fs.readFile(tmpPath);
    const upload = await (supabase as any).storage
      .from(bucket)
      .upload(storagePath, fileBytes, { 
        contentType: 'application/pdf', 
        upsert: false 
      });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    // Create signed URL for download
    const signed = await (supabase as any).storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    if (signed.error) {
      return NextResponse.json({ error: signed.error.message }, { status: 500 });
    }

    // Log generation in database
    try {
      await (supabase as any).from('media_generations').insert({
        user_id: userId,
        type: 'pdf',
        prompt: 'PDF Layout Export',
        result_url: `storage:${bucket}/${storagePath}`
      });
    } catch (dbError) {
      console.warn('Failed to log PDF generation:', dbError);
    }

    // Clean up temp file
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json({ 
      ok: true, 
      url: signed.data.signedUrl,
      fileName: storageFileName,
      pages: pages.length,
      totalItems: pages.reduce((total, page) => total + page.items.length, 0)
    });

  } catch (error: any) {
    console.error('PDF export error:', error);
    return NextResponse.json({ 
      error: error?.message || 'PDF export failed' 
    }, { status: 500 });
  }
}
