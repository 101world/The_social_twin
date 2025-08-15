export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient, createSupabaseClient } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const a = auth();
    let userId = a.userId as string | null;
    const getToken = (a as any)?.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const images: string[] = Array.isArray(body?.images) ? body.images : [];
    const topicId: string | undefined = typeof body?.topicId === 'string' ? body.topicId : undefined;
    const fileNameHint: string = typeof body?.fileName === 'string' && body.fileName ? body.fileName : 'export.pdf';
    if (!images.length) return NextResponse.json({ error: 'No images' }, { status: 400 });

    // Load all images into canvases server-side using a lightweight PDF builder
    // Avoid heavy headless dependencies; build a simple A4 PDF with each image scaled to fit
    const { default: PDFDocument } = await import('pdfkit');

    const tmpDir = path.join(process.cwd(), '.next', 'cache', 'export');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);

    await new Promise<void>(async (resolve, reject) => {
      try {
        const doc: any = new (PDFDocument as any)({ autoFirstPage: false });
        const stream = (await import('node:fs')).createWriteStream(tmpPath);
        const out = (doc as any).pipe(stream);
        // Add pages per image
        for (const src of images) {
          // Fetch image bytes
          let buf: Uint8Array | null = null;
          let contentType = 'image/png';
          try {
            if (src.startsWith('data:')) {
              const m = /data:(.*?);base64,(.*)$/i.exec(src);
              if (m) { contentType = m[1] || contentType; buf = Buffer.from(m[2], 'base64'); }
            } else {
              const res = await fetch(src);
              contentType = res.headers.get('content-type') || contentType;
              buf = new Uint8Array(await res.arrayBuffer());
            }
          } catch {}
          if (!buf) continue;
          // Create page and draw image to fit A4
          const pageSize: [number, number] = [595.28, 841.89]; // A4 points
          (doc as any).addPage({ size: pageSize });
          try {
            const img = (doc as any).openImage ? (doc as any).openImage(buf) : null;
            // If openImage not available, fallback to embed via image() with buffer
          } catch {}
          // pdfkit supports passing a Buffer directly to image()
          const margin = 36;
          const maxW = pageSize[0] - margin * 2;
          const maxH = pageSize[1] - margin * 2;
          try {
            (doc as any).image(Buffer.from(buf), {
              fit: [maxW, maxH],
              align: 'center',
              valign: 'center',
              margin,
            });
          } catch {}
        }
        (doc as any).end();
        out.on('finish', async () => { resolve(); });
        out.on('error', async (e: any) => { reject(e); });
      } catch (e) {
        reject(e);
      }
    });

    // Upload to Supabase storage and log
    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient(jwt || undefined);
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


