export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient, createSupabaseClient } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const images: string[] = Array.isArray(body?.images) ? body.images : [];
    const topicId: string | undefined = typeof body?.topicId === 'string' ? body.topicId : undefined;
    const fileNameHint: string = typeof body?.fileName === 'string' && body.fileName ? body.fileName : 'export.pdf';
    if (!images.length) return NextResponse.json({ error: 'No images' }, { status: 400 });

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

    let firstPage = true;
    for (const src of images) {
      if (!firstPage) {
        doc.addPage();
      }
      firstPage = false;

      try {
        // For jsPDF, we need to add the image directly
        // Get image dimensions to calculate scaling
        const pageWidth = 595.28; // A4 width in points
        const pageHeight = 841.89; // A4 height in points
        const margin = 36;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;

        if (src.startsWith('data:') || src.startsWith('http')) {
          // jsPDF can handle data URLs and HTTP URLs directly
          doc.addImage(src, 'JPEG', margin, margin, maxW, maxH, undefined, 'FAST');
        }
      } catch (error) {
        console.warn('Failed to add image to PDF:', error);
        // Continue with other images
      }
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    await fs.writeFile(tmpPath, pdfBuffer);

    // Upload to Supabase storage and log
    const supabase = createSupabaseAdminClient(); // Use admin client for server routes
    const bucket = 'generated-pdfs';
    // @ts-ignore
    if ((supabase as any).storage?.createBucket) { try { await (supabase as any).storage.createBucket(bucket, { public: false }); } catch {}
    }
    const fileBytes = await fs.readFile(tmpPath);
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}-${fileNameHint.replace(/[^a-z0-9_.-]/gi,'_')}`;
    const storagePath = `${userId}/${fileName}`;
    const up = await (supabase as any).storage.from(bucket).upload(storagePath, fileBytes, { contentType: 'application/pdf', upsert: false });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
    const signed = await (supabase as any).storage.from(bucket).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });

    // Ensure topic if missing
    let topicIdFinal: string | null = (topicId as string | null) || null;
    if (!topicIdFinal) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const title = `Social Twin - ${today}`;
        const { data: existing } = await (supabase as any)
          .from('chat_topics')
          .select('id')
          .eq('user_id', userId!)
          .eq('title', title)
          .limit(1)
          .maybeSingle();
        if (existing?.id) topicIdFinal = existing.id;
        else {
          const { data: created } = await (supabase as any)
            .from('chat_topics')
            .insert({ user_id: userId!, title })
            .select('id')
            .single();
          if (created?.id) topicIdFinal = created.id;
        }
      } catch {}
    }

    // Log media_generation row
    try {
      await (supabase as any).from('media_generations').insert({ topic_id: topicIdFinal, user_id: userId!, type: 'pdf', prompt: 'Exported PDF', result_url: `storage:${bucket}/${storagePath}` });
      if (topicIdFinal) {
        await (supabase as any).from('chat_messages').insert({ topic_id: topicIdFinal, user_id: userId!, role: 'ai', content: `Exported PDF: storage:${bucket}/${storagePath}` });
      }
    } catch {}

    return NextResponse.json({ ok: true, url: signed.data.signedUrl });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Export failed' }, { status: 500 });
  }
}


