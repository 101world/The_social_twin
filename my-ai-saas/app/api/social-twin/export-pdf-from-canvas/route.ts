export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';

interface CanvasItem {
  id: string;
  type: 'image' | 'video' | 'text' | 'operator';
  url?: string;
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontScale?: number;
}

interface Edge {
  id: string;
  fromId: string;
  toId: string;
  fromPort: 'male' | 'female';
  toPort: 'male' | 'female';
}

interface ExportRequest {
  nodeId: string;
  canvasItems: CanvasItem[];
  edges: Edge[];
  fileName?: string;
}

// Function to collect connected items following orange string connections
function getConnectedItemsForPDF(
  nodeId: string, 
  canvasItems: CanvasItem[], 
  edges: Edge[]
): Array<{ id: string; type: 'image' | 'text'; url?: string; text?: string; x: number; y: number; w: number; h: number; fontScale?: number }> {
  const visited = new Set<string>();
  type PDFItem = { id: string; type: 'image' | 'text'; url?: string; text?: string; x: number; y: number; w: number; h: number; fontScale?: number };
  
  function collect(nodeId: string): PDFItem[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    const incoming = edges.filter(e => e.toId === nodeId);
    
    return incoming.flatMap((ed) => {
      const upstream = collect(ed.fromId);
      const node = canvasItems.find(i => i.id === ed.fromId);
      const self: PDFItem[] = [];
      
      if (node) {
        if (node.type === 'image' && node.url) {
          self.push({
            id: node.id,
            type: 'image',
            url: node.url,
            x: node.x || 0,
            y: node.y || 0,
            w: node.w || 360,
            h: node.h || 240
          });
        } else if (node.type === 'text' && node.text) {
          self.push({
            id: node.id,
            type: 'text',
            text: node.text,
            x: node.x || 0,
            y: node.y || 0,
            w: node.w || 300,
            h: node.h || 100,
            fontScale: node.fontScale || 1
          });
        }
      }
      return [...upstream, ...self];
    });
  }
  
  const result = collect(nodeId);
  // De-duplicate while preserving order
  const seen = new Set<string>();
  const dedup: PDFItem[] = [];
  for (const it of result) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      dedup.push(it);
    }
  }
  return dedup;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: ExportRequest = await req.json();
    const { nodeId, canvasItems, edges, fileName = 'canvas_export.pdf' } = body;

    if (!nodeId || !canvasItems || !edges) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Collect connected items using orange string connections
    const connectedItems = getConnectedItemsForPDF(nodeId, canvasItems, edges);
    
    if (connectedItems.length === 0) {
      return NextResponse.json({ 
        error: 'No connected items found. Connect images and text using orange strings (male port → female port).' 
      }, { status: 400 });
    }

    console.log(`Found ${connectedItems.length} connected items for PDF export`);

    // Dynamic import to avoid build errors when jspdf is not installed
    let jsPDF;
    try {
      const jsPDFModule = await import('jspdf');
      jsPDF = jsPDFModule.jsPDF;
    } catch (importError) {
      return NextResponse.json({ error: 'PDF export feature not available - jsPDF dependency missing' }, { status: 503 });
    }

    const tmpDir = path.join(process.cwd(), '.next', 'cache', 'export');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    // Convert canvas items to PDF format
    const pdfItems = connectedItems.map(item => ({
      id: item.id,
      type: item.type,
      url: item.url,
      text: item.text,
      // Scale down canvas coordinates to fit PDF (A4 is ~595x842 pts)
      x: Math.max(10, (item.x * 0.7) % 500),
      y: Math.max(10, (item.y * 0.7) % 700),
      w: Math.min(item.w * 0.7, 400),
      h: Math.min(item.h * 0.7, 300),
      fontSize: item.type === 'text' ? Math.max(12, (item.fontScale || 1) * 16) : undefined
    }));

    // Sort items by z-index (images first, then text on top)
    const sortedItems = [...pdfItems].sort((a, b) => {
      if (a.type === 'image' && b.type === 'text') return -1;
      if (a.type === 'text' && b.type === 'image') return 1;
      return 0;
    });

    for (const item of sortedItems) {
      try {
        console.log(`Processing item: ${item.type}, url: ${item.url}, text: ${item.text?.substring(0, 50)}`);
        
        if (item.type === 'image' && item.url) {
          // Handle different URL types
          let imageData = item.url;
          
          // If it's a proxy URL, extract the original URL and fetch directly
          if (item.url.includes('/api/social-twin/proxy')) {
            try {
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
                  continue;
                }
              } else {
                console.warn('Could not extract original URL from proxy URL');
                continue;
              }
            } catch (proxyError) {
              console.warn('Failed to fetch proxy image:', proxyError);
              continue;
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
        prompt: `PDF from canvas connections: ${connectedItems.length} items`,
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
      connectedItems: connectedItems.length,
      message: `PDF created with ${connectedItems.length} connected items`
    });

  } catch (error: any) {
    console.error('Canvas PDF export error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Canvas PDF export failed' 
    }, { status: 500 });
  }
}
