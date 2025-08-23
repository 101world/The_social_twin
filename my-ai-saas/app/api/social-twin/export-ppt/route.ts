export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient, createSupabaseClient } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

type PageInput = {
  images?: Array<{ url: string; x?: number; y?: number; w?: number; h?: number; fit?: 'cover'|'contain' }>;
  texts?: Array<{ content: string; x?: number; y?: number; w?: number; h?: number; fontSize?: number; bold?: boolean; align?: 'left'|'center'|'right' }>;
};

export async function POST(req: NextRequest) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
  const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const pages: PageInput[] = Array.isArray(body?.pages) ? body.pages : [];
    const pageSize: '16:9'|'A4P'|'A4L' = body?.pageSize === 'A4L' ? 'A4L' : body?.pageSize === 'A4P' ? 'A4P' : '16:9';
    const topicId: string | undefined = typeof body?.topicId === 'string' ? body.topicId : undefined;
    if (!pages.length) return NextResponse.json({ error: 'No pages' }, { status: 400 });

    // Generate PPTX via pptxgenjs
    const PPTX = (await import('pptxgenjs')).default;
    const pres = new PPTX();
    if (pageSize === 'A4P') pres.layout = 'A4'; else if (pageSize === 'A4L') pres.layout = 'LAYOUT_WIDE'; else pres.layout = 'LAYOUT_16x9';

    for (const p of pages) {
      const slide = pres.addSlide();
      for (const t of (p.texts || [])) {
        slide.addText(t.content || '', {
          x: (t.x ?? 0) / 100, y: (t.y ?? 0) / 100,
          w: (t.w ?? 960) / 100, h: (t.h ?? 100) / 100,
          fontSize: t.fontSize ?? 18,
          bold: !!t.bold,
          align: (t.align as any) ?? 'left',
        } as any);
      }
      for (const img of (p.images || [])) {
        slide.addImage({
          data: img.url,
          path: img.url.startsWith('data:') ? undefined : img.url,
          x: (img.x ?? 0) / 100,
          y: (img.y ?? 0) / 100,
          w: (img.w ?? 960) / 100,
          h: (img.h ?? 540) / 100,
          sizing: {
            type: img.fit === 'cover' ? 'cover' : 'contain',
          } as any,
        });
      }
    }

  const tmpDir = path.join(os.tmpdir(), 'export');
    await fs.mkdir(tmpDir, { recursive: true });
    const out = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.pptx`);
    await new Promise<void>((resolve, reject)=> {
      pres.writeFile({ fileName: out }).then(()=> resolve()).catch(reject);
    });

    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient(jwt || undefined);
    const bucket = 'generated-pptx';
    // @ts-ignore
    if ((supabase as any).storage?.createBucket) { try { await (supabase as any).storage.createBucket(bucket, { public: false }); } catch {}
    }
    const fileBytes = await fs.readFile(out);
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.pptx`;
    const storagePath = `${userId}/${fileName}`;
    const up = await (supabase as any).storage.from(bucket).upload(storagePath, fileBytes, { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', upsert: false });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
    const signed = await (supabase as any).storage.from(bucket).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });

    try {
      await (supabase as any).from('media_generations').insert({ topic_id: topicId, user_id: userId!, type: 'pptx', prompt: 'Exported PPTX', result_url: `storage:${bucket}/${storagePath}` });
      if (topicId) await (supabase as any).from('chat_messages').insert({ topic_id: topicId, user_id: userId!, role: 'ai', content: `Exported PPTX: storage:${bucket}/${storagePath}` });
    } catch {}

    return NextResponse.json({ ok: true, url: signed.data.signedUrl });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Export PPT failed' }, { status: 500 });
  }
}





