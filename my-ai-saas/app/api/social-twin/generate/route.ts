export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';

type Mode = 'text' | 'image' | 'image-modify' | 'video';

async function ensureSocialTwinTopic(supabase: ReturnType<typeof createSupabaseClient> | ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const title = `Social Twin - ${today}`;
  const { data: existing } = await supabase
    .from('chat_topics')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from('chat_topics')
    .insert({ user_id: userId, title })
    .select('id')
    .single();
  if (error) throw error;
  return created.id as string;
}

export async function POST(req: NextRequest) {
  try {
  const authState = await auth();
  let userId = authState.userId as string | null;
  const getToken = authState.getToken as undefined | ((opts?: any) => Promise<string | null>);

    const body = await req.json();
    
    // Log the complete request for debugging
    console.log('=== SOCIAL-TWIN GENERATE REQUEST ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User ID:', userId);
    console.log('Request Body:', JSON.stringify(body, null, 2));
    console.log('Request Headers:', {
      'content-type': req.headers.get('content-type'),
      'user-agent': req.headers.get('user-agent'),
      'x-user-id': req.headers.get('x-user-id'),
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'x-real-ip': req.headers.get('x-real-ip'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    
  const mode: Mode = body?.mode;
  const prompt: string = body?.prompt ?? '';
  const DEFAULT_IMAGE_RUNPOD = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || 'https://64e5p2jm3e5r3k-3001.proxy.runpod.net/';
  const runpodUrl: string = body?.runpodUrl ?? DEFAULT_IMAGE_RUNPOD ?? '';
    const referenceImageUrl: string | undefined = body?.imageUrl; // for image-modify
    const apiKey = process.env.RUNPOD_API_KEY;
    
    console.log('=== PARSED REQUEST DATA ===');
    console.log('Mode:', mode);
    console.log('Prompt:', prompt);
    console.log('RunPod URL:', runpodUrl);
    console.log('Reference Image URL:', referenceImageUrl);
    console.log('API Key Present:', !!apiKey);
    console.log('API Key (partial):', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
    console.log('Other params:', JSON.stringify({ ...body, prompt: '[REDACTED]', runpodUrl: '[REDACTED]' }, null, 2));

    if (!mode || !['text', 'image', 'image-modify', 'video'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    }
    if (!runpodUrl) {
      return NextResponse.json({ error: 'RunPod URL missing' }, { status: 400 });
    }
    const base = runpodUrl.replace(/\/$/, '');

    // Fallback user id from body/header if Clerk auth not present (dev convenience)
    if (!userId) {
      userId = (typeof body?.userId === 'string' && body.userId) || req.headers.get('x-user-id');
    }
    const jwt = getToken ? await getToken({ template: 'supabase' }).catch(() => null) : null;
    const canLog = Boolean(userId);
    // Prefer admin client for reliable writes regardless of RLS
    let supabase: ReturnType<typeof createSupabaseAdminClient> | ReturnType<typeof createSupabaseClient> | null = null;
    let topicId: string | null = null;
    if (canLog) {
      try {
        supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseClient(jwt!);
        topicId = await ensureSocialTwinTopic(supabase, userId!);
          await supabase
          .from('chat_messages')
            .insert({ topic_id: topicId, user_id: userId!, role: 'user', content: prompt })
          .select('id')
          .single();
      } catch {}
    }

    // Build the graph: Prefer Social Twin Flux workflows for image and image-modify; fallback to simple graph for others
    console.log('=== SELECTING WORKFLOW GRAPH ===');
    const useSocialTwin = (mode === 'image' || mode === 'image-modify');
    let graph: any = {};
    let isSocialTwin = false;

    // Helper to load workflow JSON from the project Workflows folder
    async function loadWorkflowJson(fileName: string): Promise<any> {
      const p = path.resolve(process.cwd(), 'Workflows', fileName);
      const raw = await fs.readFile(p, 'utf-8');
      return JSON.parse(raw);
    }

    // Generate a unique seed for this user's generation
    const userSeed = typeof body?.seed === 'number' ? body.seed : Math.floor(Math.random() * 1000000);

    if (useSocialTwin) {
      try {
        if (mode === 'image') {
          graph = await loadWorkflowJson('Socialtwin-Image.json');
          isSocialTwin = true;
          console.log('Loaded SocialTwin-Image.json');
          // Patch known nodes: 6 (positive prompt), 33 (negative), 27 (width/height/batch), 31 (sampler params), 30 (ckpt optional)
          if (graph['6']?.inputs) graph['6'].inputs.text = prompt;
          if (typeof body?.negative === 'string' && graph['33']?.inputs) graph['33'].inputs.text = body.negative;
          if (graph['27']?.inputs) {
            const w = typeof body?.width === 'number' ? body.width : graph['27'].inputs.width ?? 1024;
            const h = typeof body?.height === 'number' ? body.height : graph['27'].inputs.height ?? 1024;
            graph['27'].inputs.width = w;
            graph['27'].inputs.height = h;
            if (typeof body?.batch_size === 'number') graph['27'].inputs.batch_size = body.batch_size;
          }
          if (graph['31']?.inputs) {
            if (typeof body?.steps === 'number') graph['31'].inputs.steps = Math.max(1, Math.round(body.steps));
            if (typeof body?.cfg === 'number') graph['31'].inputs.cfg = body.cfg;
            graph['31'].inputs.seed = userSeed;
          }
          if (typeof body?.ckpt_name === 'string' && body.ckpt_name && graph['30']?.inputs) {
            graph['30'].inputs.ckpt_name = body.ckpt_name;
          }
        } else if (mode === 'image-modify') {
          graph = await loadWorkflowJson('SocialTwin-Modify.json');
          isSocialTwin = true;
          console.log('Loaded SocialTwin-Modify.json');
          // Patch known nodes: 6 (positive prompt), 188 (dims), 31 (sampler params)
          if (graph['6']?.inputs) graph['6'].inputs.text = prompt;
          if (graph['188']?.inputs) {
            const w = typeof body?.width === 'number' ? body.width : graph['188'].inputs.width ?? 1024;
            const h = typeof body?.height === 'number' ? body.height : graph['188'].inputs.height ?? 1024;
            graph['188'].inputs.width = w;
            graph['188'].inputs.height = h;
            if (typeof body?.batch_size === 'number') graph['188'].inputs.batch_size = body.batch_size;
          }
          if (graph['31']?.inputs) {
            if (typeof body?.steps === 'number') graph['31'].inputs.steps = Math.max(1, Math.round(body.steps));
            if (typeof body?.cfg === 'number') graph['31'].inputs.cfg = body.cfg;
            graph['31'].inputs.seed = userSeed;
          }
        }
      } catch (e) {
        console.error('Failed to load Social Twin workflow, falling back to simple graph:', e);
      }
    }

    // Fallback simple SD/SDXL graph if Social Twin not used/available
    if (!isSocialTwin) {
      console.log('Using simple SD/SDXL graph fallback');
      // Pick checkpoint via body override or default
      const ckptName: string = typeof body?.ckpt_name === 'string' && body.ckpt_name
        ? body.ckpt_name
        : 'sd_xl_base_1.0.safetensors';
      graph = {
        "1": { inputs: { ckpt_name: ckptName }, class_type: "CheckpointLoaderSimple" },
        "2": { inputs: { text: prompt, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
        "3": { inputs: { text: body?.negative || "", clip: ["1", 1] }, class_type: "CLIPTextEncode" },
        "4": { inputs: { width: body?.width || 1024, height: body?.height || 1024, batch_size: typeof body?.batch_size === 'number' ? body.batch_size : 1 }, class_type: "EmptyLatentImage" },
        "5": { inputs: { seed: userSeed, steps: body?.steps || 20, cfg: body?.cfg || 8, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0] }, class_type: "KSampler" },
        "6": { inputs: { samples: ["5", 0], vae: ["1", 2] }, class_type: "VAEDecode" },
        "7": { inputs: { filename_prefix: `user_${userId}_${Date.now()}`, images: ["6", 0] }, class_type: "SaveImage" }
      };
    }

  // If modify workflow, upload reference image to Comfy and inject into LoadImage node (expects filename only)
  if (mode === 'image-modify') {
      const refUrl: string | undefined = referenceImageUrl || (typeof body?.attachment?.dataUrl === 'string' ? body.attachment.dataUrl : undefined);
      if (!refUrl) {
        return NextResponse.json({ error: 'Image Modify requires imageUrl or attachment.dataUrl' }, { status: 400 });
      }
      // Fetch or decode the image into bytes
      let bytes: Uint8Array | null = null;
      let contentType = 'image/png';
      try {
        if (refUrl.startsWith('data:')) {
          const m = /data:(.*?);base64,(.*)$/i.exec(refUrl);
          if (m) {
            contentType = m[1] || contentType;
            bytes = Buffer.from(m[2], 'base64');
          }
        } else {
          const resp = await fetch(refUrl);
          contentType = resp.headers.get('content-type') || contentType;
          bytes = new Uint8Array(await resp.arrayBuffer());
        }
      } catch {
        // no-op; will error below if bytes null
      }
      if (!bytes) {
        return NextResponse.json({ error: 'Failed to load reference image' }, { status: 400 });
      }
      const filename = contentType.includes('jpeg') ? 'input.jpg' : 'input.png';
      const authOnlyHeaders = {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
      } as Record<string, string>;
      // Upload to comfyui
      async function uploadToComfy(): Promise<string | null> {
        const candidatePaths = [
          `${base}/upload/image`,
          `${base}/upload`,
          `${base}/upload/image?type=input&overwrite=true`,
          `${base}/upload?type=input&overwrite=true`,
        ];
        const fieldNames = ['image', 'file', 'files', 'files[]', 'image[]'];
        for (const pathUrl of candidatePaths) {
          for (const field of fieldNames) {
            const fd = new FormData();
            const ab = (bytes as Uint8Array).buffer.slice((bytes as Uint8Array).byteOffset, (bytes as Uint8Array).byteOffset + (bytes as Uint8Array).byteLength) as ArrayBuffer;
            fd.append(field, new Blob([ab], { type: contentType }), filename);
            // Some deployments need these keys even as query params; keep in body too
            fd.append('type', 'input');
            fd.append('overwrite', 'true');
            try {
              const resp = await fetch(pathUrl, { method: 'POST', headers: authOnlyHeaders, body: fd as any });
              if (resp.ok) {
                let name: string | undefined;
                try {
                  const txt = await resp.text();
                  if (txt) {
                    try { const j: any = JSON.parse(txt); name = j?.name || j?.filename || (typeof j?.path === 'string' ? j.path.split('/').pop() : undefined); }
                    catch { name = txt.replace(/\r?\n/g, '').trim() || undefined; }
                  }
                } catch {}
                return name || filename;
              }
            } catch {}
          }
        }
        return null;
      }
      const uploadedName = await uploadToComfy();
      if (!uploadedName) {
        return NextResponse.json({ error: 'Failed to upload reference image to Comfy' }, { status: 502 });
      }
      // Find LoadImage node and set its image field; for SocialTwin-Modify.json, id is '190'
      let loadKey: string | null = null;
      if ((graph as any)['190']?.class_type === 'LoadImage') loadKey = '190';
      if (!loadKey) {
        for (const k of Object.keys(graph)) {
          const node = (graph as any)[k];
          if (node && (node.class_type === 'LoadImage' || node.class_type === 'Load Image' || node._meta?.title === 'Load Image') && node.inputs) { loadKey = k; break; }
        }
      }
      if (!loadKey) return NextResponse.json({ error: 'Modify graph missing LoadImage node' }, { status: 400 });
      (graph as any)[loadKey].inputs.image = uploadedName;
      // Some graphs also have a path or folder input; prefer using comfy default input folder only
    }

    // If video image-to-video, require and upload reference image, inject into LoadImage (simple support)
    if (mode === 'video' && ((typeof body?.video_type === 'string' && body.video_type === 'image') || (!body?.video_type && (typeof body?.attachment?.dataUrl === 'string')))) {
      const refUrl: string | undefined = (typeof body?.imageUrl === 'string' && body.imageUrl) || (typeof body?.attachment?.dataUrl === 'string' ? body.attachment.dataUrl : undefined);
      if (!refUrl) {
        return NextResponse.json({ error: 'Image-to-video requires an image attachment' }, { status: 400 });
      }
      let bytes: Uint8Array | null = null;
      let contentType = 'image/png';
      try {
        if (refUrl.startsWith('data:')) {
          const m = /data:(.*?);base64,(.*)$/i.exec(refUrl);
          if (m) { contentType = m[1] || contentType; bytes = Buffer.from(m[2], 'base64'); }
        } else {
          const resp = await fetch(refUrl); contentType = resp.headers.get('content-type') || contentType; bytes = new Uint8Array(await resp.arrayBuffer());
        }
      } catch {}
      if (!bytes) return NextResponse.json({ error: 'Failed to load reference image' }, { status: 400 });
      const filename = contentType.includes('jpeg') ? 'input.jpg' : 'input.png';
      const authOnlyHeaders = { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...(apiKey ? { 'x-api-key': apiKey } : {}), ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}) } as Record<string, string>;
      async function uploadVidRef(): Promise<string | null> {
        const candidates = [`${base}/upload/image`, `${base}/upload`, `${base}/upload/image?type=input&overwrite=true`, `${base}/upload?type=input&overwrite=true`];
        const fields = ['image', 'file', 'files', 'files[]', 'image[]'];
        for (const url of candidates) {
          for (const f of fields) {
            const fd = new FormData();
            const ab2 = (bytes as Uint8Array).buffer.slice((bytes as Uint8Array).byteOffset, (bytes as Uint8Array).byteOffset + (bytes as Uint8Array).byteLength) as ArrayBuffer;
            fd.append(f, new Blob([ab2], { type: contentType }), filename);
            fd.append('type', 'input');
            fd.append('overwrite', 'true');
            try {
              const r = await fetch(url, { method: 'POST', headers: authOnlyHeaders, body: fd as any });
              if (r.ok) {
                let name: string | undefined; const txt = await r.text().catch(()=> '');
                if (txt) { try { const j:any = JSON.parse(txt); name = j?.name || j?.filename || (typeof j?.path === 'string' ? j.path.split('/').pop() : undefined); } catch { name = txt.replace(/\r?\n/g, '').trim() || undefined; } }
                return name || filename;
              }
            } catch {}
          }
        }
        return null;
      }
      const uploadedName = await uploadVidRef();
      if (!uploadedName) return NextResponse.json({ error: 'Failed to upload reference image to Comfy' }, { status: 502 });
      // Set LoadImage
      let loadKey: string | null = null;
      for (const k of Object.keys(graph)) { const n = (graph as any)[k]; if (n && (n.class_type === 'LoadImage' || n._meta?.title === 'Load Image') && n.inputs) { loadKey = k; break; } }
      if (!loadKey && (graph as any)['190']?.class_type === 'LoadImage') loadKey = '190';
      if (!loadKey) return NextResponse.json({ error: 'Video graph missing LoadImage node' }, { status: 400 });
      (graph as any)[loadKey].inputs.image = uploadedName;
    }

    // If using simple graph, do final parameter patches
    if (!isSocialTwin) {
      if (graph['2']?.inputs) graph['2'].inputs.text = prompt;
      if (typeof body?.negative === 'string' && graph['3']?.inputs) graph['3'].inputs.text = body.negative;
      if (graph['4']?.inputs) {
        if (body?.width || body?.height) {
          graph['4'].inputs.width = body.width || 1024;
          graph['4'].inputs.height = body.height || 1024;
        }
        if (typeof body?.batch_size === 'number') graph['4'].inputs.batch_size = body.batch_size;
      }
      if (graph['5']?.inputs) {
        if (typeof body?.cfg === 'number') graph['5'].inputs.cfg = body.cfg;
        if (typeof body?.steps === 'number') graph['5'].inputs.steps = Math.max(1, Math.round(body.steps));
        graph['5'].inputs.seed = userSeed;
      }
    }

    // Send graph to RunPod (try /prompt with {prompt}, then '/' with raw graph)
    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
    } as Record<string, string>;

    console.log('=== RUNPOD SUBMISSION ===');
    console.log('Base URL:', base);
    console.log('Headers:', headers);
    console.log('Graph (first 1000 chars):', JSON.stringify(graph, null, 2).substring(0, 1000));

    async function submit(): Promise<{ res: Response; bodyText: string }> {
  // 1) POST /prompt with { prompt: graph, client_id }
  const clientId = (userId ? `user_${userId}` : `client_${Math.random().toString(36).slice(2)}`);
  const promptPayload = { prompt: graph, client_id: clientId } as any;
      const promptUrl = `${base}/prompt`;
      
      console.log('=== ATTEMPT 1: POST /prompt ===');
      console.log('URL:', promptUrl);
      console.log('Payload (first 500 chars):', JSON.stringify(promptPayload, null, 2).substring(0, 500));
      
      let res = await fetch(promptUrl, {
        method: 'POST', headers, body: JSON.stringify(promptPayload),
      });
      let text = await res.text();
      
      console.log('Response Status:', res.status);
      console.log('Response Headers:', Object.fromEntries(res.headers.entries()));
      console.log('Response Body (first 500 chars):', text.substring(0, 500));
      
      if (res.ok) return { res, bodyText: text };
      
      // 2) POST base with raw graph
      console.log('=== ATTEMPT 2: POST base URL ===');
      console.log('URL:', base);
      console.log('Raw Graph (first 500 chars):', JSON.stringify(graph, null, 2).substring(0, 500));
      
      res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(graph) });
      text = await res.text();
      
      console.log('Response Status:', res.status);
      console.log('Response Headers:', Object.fromEntries(res.headers.entries()));
      console.log('Response Body (first 500 chars):', text.substring(0, 500));
      
      if (res.ok) return { res, bodyText: text };
      // Return last attempt
      return { res, bodyText: text };
    }

    const submitAttempt = await submit();
    const submitText = submitAttempt.bodyText;
    let submitJson: any = {};
    try { submitJson = submitText ? JSON.parse(submitText) : {}; } catch { /* raw */ }
    
    console.log('=== SUBMIT RESULT ===');
    console.log('Success:', submitAttempt.res.ok);
    console.log('Status:', submitAttempt.res.status);
    console.log('Response Text:', submitText);
    console.log('Parsed JSON:', JSON.stringify(submitJson, null, 2));
    
    if (!submitAttempt.res.ok) {
      const isHtml = submitText.trim().startsWith('<!DOCTYPE html>') || submitText.trim().startsWith('<html>');
      console.log('Error - Is HTML Response:', isHtml);
      if (isHtml) {
        console.log('HTML Response detected - likely RunPod connectivity issue');
      }
      return NextResponse.json({ error: `RunPod submit failed (${submitAttempt.res.status})`, runpodResponse: submitJson }, { status: submitAttempt.res.status || 502 });
    }

    const promptId: string | undefined = submitJson?.prompt_id || submitJson?.id || submitJson?.promptId;
    if (!promptId) {
      return NextResponse.json({ error: 'Missing prompt_id in response', runpodResponse: submitJson }, { status: 502 });
    }

    // Poll history
    let rpJson: any = submitJson;
    let imageUrl: string | undefined;
    let imageList: any[] = [];
    let videoList: any[] = [];
    let outputImages: string[] = [];
    let outputVideos: string[] = [];
    // Poll timeout: image/text ~5m, video ~15m
    const maxTries = mode === 'video' ? 450 : 150; // 450 * 2s = 900s = 15 minutes
    for (let i = 0; i < maxTries; i++) {
      const hRes = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, { headers });
      const hText = await hRes.text();
      let hJson: any = {};
      try { hJson = hText ? JSON.parse(hText) : {}; } catch {}
      rpJson = hJson;
      // Try pulling images/videos from any node outputs
      const outputsBag: any = hJson?.[promptId]?.outputs || hJson?.outputs || {};
      const collectedImages: string[] = [];
      const collectedVideos: string[] = [];
      try {
        for (const key of Object.keys(outputsBag)) {
          const node = outputsBag[key];
          if (node && Array.isArray(node.images) && node.images.length) {
            for (const img of node.images) {
              const fn = img?.filename ?? img?.name ?? img;
              const sub = img?.subfolder ?? '';
              const t = img?.type ?? 'output';
              const url = `${base}/view?filename=${encodeURIComponent(fn)}&subfolder=${encodeURIComponent(sub)}&type=${encodeURIComponent(t)}`;
              if (/\.(mp4|webm)(\?|$)/i.test(String(fn))) collectedVideos.push(url);
              else collectedImages.push(url);
            }
          }
          if (node && Array.isArray(node.videos) && node.videos.length) {
            for (const vid of node.videos) {
              const fn = vid?.filename ?? vid?.name ?? vid;
              const sub = vid?.subfolder ?? '';
              const t = vid?.type ?? 'output';
              const url = `${base}/view?filename=${encodeURIComponent(fn)}&subfolder=${encodeURIComponent(sub)}&type=${encodeURIComponent(t)}`;
              collectedVideos.push(url);
            }
          }
        }
      } catch {}
      if (collectedImages.length) {
        imageList = collectedImages.slice();
        imageUrl = imageList[0];
        outputImages = imageList.slice();
        if (!rpJson.imageUrl) rpJson.imageUrl = imageUrl;
      }
      if (collectedVideos.length) {
        videoList = collectedVideos.slice();
        if (!rpJson.videoUrl) rpJson.videoUrl = videoList[0];
      }
      if ((imageList && imageList.length) || (videoList && videoList.length)) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    // Extract common fields (handle arrays and base64)
    const aiText: string | undefined = rpJson.text ?? rpJson.output ?? rpJson.message;
    let aiImage: string | undefined = imageUrl ?? rpJson.imageUrl ?? rpJson.image ?? rpJson.url;
    const imagesArr: any[] | undefined = rpJson.images ?? rpJson.output_images ?? rpJson.outputs;
    if (!aiImage && Array.isArray(imagesArr) && imagesArr.length > 0) {
      aiImage = typeof imagesArr[0] === 'string' ? imagesArr[0] : imagesArr[0]?.url;
    }
    // base64 variants
    const imgB64: string | undefined = rpJson.image_base64 ?? rpJson.imageBase64 ?? rpJson.base64;
    if (!aiImage && imgB64) {
      aiImage = `data:image/png;base64,${imgB64}`;
    }
    const aiVideo: string | undefined = rpJson.videoUrl ?? (typeof rpJson.video === 'string' ? rpJson.video : undefined) ?? rpJson.url;

    if (mode === 'text') {
      // Log assistant message
      if (aiText && canLog && supabase && topicId) {
        try {
          await supabase
            .from('chat_messages')
            .insert({ topic_id: topicId, user_id: userId!, role: 'ai', content: aiText })
            .select('id')
            .single();
        } catch {}
      }
    } else {
      // Log media generation and upload to Supabase Storage for durability
      const type = mode === 'video' ? 'video' : 'image';
      const sourceUrls = type === 'video' ? (videoList.length ? videoList : (aiVideo ? [aiVideo] : [])) : (imageList.length ? imageList : (aiImage ? [aiImage] : []));
      const deliveredUrls: string[] = [];

      if (canLog && supabase && sourceUrls.length) {
        const bucket = type === 'video' ? 'generated-videos' : 'generated-images';
        // @ts-ignore
        if ((supabase as any).storage?.createBucket) { try { await (supabase as any).storage.createBucket(bucket, { public: false }); } catch {} }
        for (const src of sourceUrls) {
          try {
            let contentType = type === 'video' ? 'video/mp4' : 'image/png';
            let data: Uint8Array | null = null;
            if (src.startsWith('data:')) {
              const m = /data:(.*?);base64,(.*)$/.exec(src);
              if (m) { contentType = m[1] || contentType; data = Buffer.from(m[2], 'base64'); }
            } else {
              const resp = await fetch(src);
              contentType = resp.headers.get('content-type') || contentType;
              data = new Uint8Array(await resp.arrayBuffer());
            }
            if (!data) continue;
            const ext = contentType.startsWith('image/') ? '.png' : contentType.startsWith('video/') ? '.mp4' : '';
            const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
            const path = `${userId}/${fileName}`;
            const up = await (supabase as any).storage.from(bucket).upload(path, data, { contentType, upsert: false });
            if (!up.error) {
              const storagePath = `storage:${bucket}/${path}`;
              // insert one row per asset
              if (topicId) {
                try { await supabase.from('media_generations').insert({ topic_id: topicId, user_id: userId!, type, prompt, result_url: storagePath }); } catch {}
              }
              const signed = await (supabase as any).storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
              if (!signed.error) deliveredUrls.push(signed.data.signedUrl);
            }
          } catch {}
        }
      }

      // Fallback if nothing uploaded
      if (deliveredUrls.length === 0 && sourceUrls.length) deliveredUrls.push(sourceUrls[0]);
      if (type === 'video') outputVideos = deliveredUrls.slice();
      else outputImages = deliveredUrls.slice();
      return NextResponse.json({ ok: true, url: deliveredUrls[0], urls: deliveredUrls, images: outputImages, videos: outputVideos, runpod: rpJson });
    }

    return NextResponse.json({ ok: true, url: aiImage, urls: aiImage ? [aiImage] : [], runpod: rpJson });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}


