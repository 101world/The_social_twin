export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient, createSupabaseClient } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
// Resolve ffmpeg/ffprobe binaries from static deps if available; fallback to system PATH
let FFMPEG_CMD: string = 'ffmpeg';
let FFPROBE_CMD: string = 'ffprobe';
try {
  const fb = require('ffmpeg-static');
  if (typeof fb === 'string' && fb) {
    let p = fb as string;
    if (/^[\\/]/.test(p) && /[\\/]ROOT[\\/]/i.test(p)) {
      p = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    }
    FFMPEG_CMD = p;
  }
} catch {}
try {
  const pb = require('ffprobe-static');
  let p = (pb && pb.path) ? pb.path : '';
  if (typeof p === 'string' && p) {
    if (/^[\\/]/.test(p) && /[\\/]ROOT[\\/]/i.test(p)) {
      p = 'ffprobe';
    }
    FFPROBE_CMD = p;
  }
} catch {}

type InputItem = { url: string; type: 'image'|'video'; imageDurationSec?: number; transitionMs?: number };

function run(cmd: string, args: string[], cwd?: string): Promise<{ code: number; out: string; err: string }>{
  return new Promise((resolve) => {
    let real = cmd === 'ffmpeg' ? FFMPEG_CMD : cmd === 'ffprobe' ? FFPROBE_CMD : cmd;
    // Fix placeholder paths like \ROOT\node_modules\ffmpeg-static\ffmpeg.exe on Windows
    if (process.platform === 'win32') {
      if (/^[\\/]/.test(real) && /[\\/]ROOT[\\/]/i.test(real)) {
        if (cmd === 'ffmpeg') real = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
        if (cmd === 'ffprobe') real = 'ffprobe';
      }
    }
    const p = spawn(real, args, { cwd, shell: false });
    let out = ''; let err = '';
    let hadError: any = null;
    p.on('error', (e)=> { hadError = e; err += String(e?.message || e); });
    p.stdout.on('data', (d)=> out += String(d));
    p.stderr.on('data', (d)=> err += String(d));
    p.on('close', (code)=> resolve({ code: (hadError ? -1 : (code ?? 0)), out, err }));
  });
}

async function downloadToTmp(url: string, extHint: string): Promise<string> {
  const tmp = path.join(os.tmpdir(), 'compile');
  await fs.mkdir(tmp, { recursive: true });
  // Support data: URLs
  if (/^data:/i.test(url)) {
    const m = /^data:(.*?);base64,(.*)$/i.exec(url);
    if (!m) throw new Error('invalid data url');
    const contentType = m[1] || '';
    const buf = Buffer.from(m[2], 'base64');
    const ext = extHint || (contentType.includes('png') ? '.png' : contentType.includes('jpeg') ? '.jpg' : contentType.includes('jpg') ? '.jpg' : contentType.includes('webp') ? '.webp' : contentType.includes('gif') ? '.gif' : contentType.includes('mp4') ? '.mp4' : '.bin');
    const file = path.join(tmp, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    await fs.writeFile(file, buf);
    return file;
  }
  // HTTP(S)
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const ab = await res.arrayBuffer();
  const ext = extHint || (res.headers.get('content-type')?.includes('image') ? '.png' : '.mp4');
  const file = path.join(tmp, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  await fs.writeFile(file, Buffer.from(ab));
  return file;
}

async function ffprobeDuration(file: string): Promise<number | null> {
  const { code, out, err } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  if (code !== 0) return null;
  const num = parseFloat(out.trim());
  return isFinite(num) ? num : null;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}

export async function POST(req: NextRequest) {
  try {
  const a = await auth();
  let userId = a.userId as string | null;
  const getToken = a.getToken as undefined | ((opts?: any) => Promise<string | null>);
    if (!userId) userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check credits before processing
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: userCredits, error: creditError } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (creditError || !userCredits) {
      return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 });
    }

    if (userCredits.credits < 3) {
      return NextResponse.json({ 
        error: 'Insufficient credits', 
        required: 3, 
        available: userCredits.credits 
      }, { status: 402 });
    }

    const body = await req.json();
    const inputs: InputItem[] = Array.isArray(body?.inputs) ? body.inputs : [];
    if (!inputs.length) return NextResponse.json({ error: 'No inputs' }, { status: 400 });
    const fps: number = typeof body?.fps === 'number' ? body.fps : 24;
    const audioUrl: string | undefined = typeof body?.audioUrl === 'string' ? body.audioUrl : undefined;
    const ar: string | undefined = typeof body?.ar === 'string' ? body.ar : undefined;
    const topicId: string | undefined = typeof body?.topicId === 'string' ? body.topicId : undefined;

    // Deduct credits before processing
    const { data: newBalance, error: deductError } = await supabaseAdmin.rpc('deduct_credits_simple', {
      p_user_id: userId,
      p_amount: 3
    });

    if (deductError || newBalance === null) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // Only compile videos: ignore images entirely for this simplified flow
    const videoInputs = inputs.filter(i=> i.type === 'video');
    if (!videoInputs.length) return NextResponse.json({ error: 'No video inputs' }, { status: 400 });
    // Download all videos
    const localFiles: string[] = [];
    for (const it of videoInputs) {
      const f = await downloadToTmp(it.url, '.mp4').catch(()=> null);
      if (f) localFiles.push(f);
    }
    if (!localFiles.length) return NextResponse.json({ error: 'Failed to download inputs' }, { status: 500 });

    // Normalize each video to a common format/size/fps
    function dimsForAR(r?: string): { w:number; h:number } {
      switch (r) {
        case '1:1': return { w: 1080, h: 1080 };
        case '9:16': return { w: 1080, h: 1920 };
        case '16:9':
        default: return { w: 1280, h: 720 };
      }
    }
    const target = dimsForAR(ar);
    const clips: string[] = [];
    for (const file of localFiles) {
      const outVid = file.replace(/\.[^.]+$/, '') + `-norm.mp4`;
      const vf = `scale=${target.w}:${target.h}:force_original_aspect_ratio=decrease,pad=${target.w}:${target.h}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
      await run('ffmpeg', ['-y', '-i', file, '-r', String(fps), '-pix_fmt', 'yuv420p', '-vf', vf, '-an', outVid]);
      clips.push(outVid);
    }
    
    // Concat using filter_complex (robust across containers)
  const tmpDir = path.join(os.tmpdir(), 'compile');
    const outPath = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}-out.mp4`);
    if (clips.length === 1) {
      await run('ffmpeg', ['-y', '-i', clips[0], '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), outPath]);
    } else {
      const args: string[] = ['-y'];
      clips.forEach(c=> { args.push('-i', c); });
      // Regenerate PTS for each input to ensure proper concatenation
      const prep = clips.map((_, idx)=> `[${idx}:v]setpts=PTS-STARTPTS[v${idx}]`).join(';');
      const refs = clips.map((_, idx)=> `[v${idx}]`).join('');
      const filter = `${prep};${refs}concat=n=${clips.length}:v=1:a=0[outv]`;
      args.push('-filter_complex', filter, '-map', '[outv]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), outPath);
      await run('ffmpeg', args);

      // Validate total duration; if only first clip made it, fall back to demuxer concat
      const inDurations: number[] = [];
      for (const c of clips) { const d = await ffprobeDuration(c).catch(()=> null); inDurations.push((d && isFinite(d) ? d : 0) as number); }
      const sumDur = inDurations.reduce((a,b)=> a + (b||0), 0);
      const outDur = await ffprobeDuration(outPath).catch(()=> null) || 0;
      if (!(await fileExists(outPath)) || outDur < Math.max(0.5, sumDur * 0.8)) {
        // Build list file and use concat demuxer
        const listPath = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}-list.txt`);
        await fs.writeFile(listPath, clips.map(f=> `file '${String(f).replace(/'/g, "'\\''")}'`).join('\n'));
        await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), outPath]);
      }
    }

    // Ensure we have a valid output path; if not, fall back to first clip
    if (!(await fileExists(outPath))) {
      // Return detailed error to client for debugging, include last stderr we have
      return NextResponse.json({ error: 'ffmpeg failed to create output', details: { clips, outPath } }, { status: 500 });
    }
    let finalVideoPath = outPath;

    // Optional: mix in background audio if provided
    if (audioUrl) {
      let audioPath: string | null = null;
      try {
        audioPath = await downloadToTmp(audioUrl, '.mp3');
      } catch {}
      if (audioPath) {
        const withAudio = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}-with-audio.mp4`);
        // Map video and audio, encode aac, end at the shortest stream
        const mux = await run('ffmpeg', ['-y', '-i', finalVideoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-shortest', withAudio]);
        if (mux.code === 0 && (await fileExists(withAudio))) {
          finalVideoPath = withAudio;
        }
      }
    }

    // Upload to Supabase storage
    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : createSupabaseClient(jwt || undefined);
    const bucket = 'compiled-videos';
    // @ts-ignore
    if ((supabase as any).storage?.createBucket) { try { await (supabase as any).storage.createBucket(bucket, { public: false }); } catch {}
    }
    const fileBytes = await fs.readFile(finalVideoPath);
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    const storagePath = `${userId}/${fileName}`;
    const up = await (supabase as any).storage.from(bucket).upload(storagePath, fileBytes, { contentType: 'video/mp4', upsert: false });
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
      await (supabase as any).from('media_generations').insert({ topic_id: topicIdFinal, user_id: userId!, type: 'video', prompt: 'Compiled video', result_url: `storage:${bucket}/${storagePath}` });
      if (topicIdFinal) {
        await (supabase as any).from('chat_messages').insert({ topic_id: topicIdFinal, user_id: userId!, role: 'ai', content: `Compiled video: storage:${bucket}/${storagePath}` });
      }
    } catch {}

    return NextResponse.json({ ok: true, url: signed.data.signedUrl });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Compile failed' }, { status: 500 });
  }
}



