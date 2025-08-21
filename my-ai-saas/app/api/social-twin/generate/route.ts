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
    const runpodUrl: string = body?.runpodUrl ?? '';
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

    // Build a ComfyUI prompt graph from your workflow files
    // Choose graph based on mode
    const workflowsDir = path.join(process.cwd(), 'Workflows');
    let graphFile = path.join(workflowsDir, 'Socialtwin-Image.json');
    if (mode === 'image-modify') {
      graphFile = path.join(workflowsDir, 'SocialTwin-Modify.json');
    } else if (mode === 'video') {
      // Choose video graph based on requested subtype
      const videoType: 'text' | 'image' = (typeof body?.video_type === 'string' && body.video_type === 'image') ? 'image' : 'text';
      const videoModel: string | undefined = typeof body?.video_model === 'string' ? body.video_model : 'ltxv';
      const videoDir = path.join(workflowsDir, 'VideoWorkflows');
      if (videoModel === 'ltxv') {
        graphFile = path.join(videoDir, videoType === 'text' ? 'LTXV-TEXT_VIDEO.json' : 'LTXIMAGETOVIDEO.json');
      } else if (videoModel === 'kling') {
        graphFile = path.join(videoDir, videoType === 'text' ? 'KLING-TEXT_VIDEO.json' : 'KLING-IMAGETOVIDEO.json');
      } else if (videoModel === 'wan') {
        graphFile = path.join(videoDir, videoType === 'text' ? 'Wan-text-video.json' : 'Wan-Image-video.json');
      }
      // Validate the chosen workflow exists; if not, return 501 Not Implemented so UI can inform user
      try {
        await fs.access(graphFile);
      } catch {
        return NextResponse.json({ error: 'Requested video workflow not available yet', workflow: path.basename(graphFile) }, { status: 501 });
      }
      // Business rule: image-to-video requires image + text
      if (videoType === 'image') {
        const hasRef = typeof body?.imageUrl === 'string' || typeof body?.attachment?.dataUrl === 'string';
        if (!hasRef) return NextResponse.json({ error: 'Image-to-video requires image attachment' }, { status: 400 });
        if (!prompt || String(prompt).trim().length === 0) return NextResponse.json({ error: 'Image-to-video requires text prompt' }, { status: 400 });
      }
    }
  const graphRaw = await fs.readFile(graphFile, 'utf8');
    const graph = JSON.parse(graphRaw);

    // If modify workflow, upload reference image to Comfy and inject into LoadImage node
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
      // Find LoadImage node and set its image field (Comfy expects filename only). For SocialTwin-Modify.json, default id is 190.
      let loadKey: string | null = null;
      for (const k of Object.keys(graph)) {
        const node = (graph as any)[k];
        if (node && node.class_type === 'LoadImage' && node.inputs) { loadKey = k; break; }
      }
      // Fallback to known id 190 if present
      if (!loadKey && (graph as any)['190']?.class_type === 'LoadImage') loadKey = '190';
      // Some exported graphs call it "Load Image"; normalize
      if (!loadKey) {
        for (const k of Object.keys(graph)) {
          const node = (graph as any)[k];
          if (node && (node.class_type === 'Load Image' || node._meta?.title === 'Load Image') && node.inputs) { loadKey = k; break; }
        }
      }
      if (!loadKey) {
        return NextResponse.json({ error: 'Modify graph missing LoadImage node' }, { status: 400 });
      }
      (graph as any)[loadKey].inputs.image = uploadedName;
      // Some graphs also have a path or folder input; prefer using comfy default input folder only
    }

    // If video image-to-video, require and upload reference image, inject into LoadImage
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

    // Positive prompt → node 6.inputs.text
    if (graph['6']?.inputs) {
      graph['6'].inputs.text = prompt;
    }
    // Negative prompt (optional) → node 33.inputs.text
    if (graph['33']?.inputs && typeof body?.negative === 'string') {
      graph['33'].inputs.text = body.negative;
    }
    // Batch/AR → node 27 (image) or 188 (modify) EmptySD3LatentImage
    const ar: string | undefined = body?.aspect_ratio;
    const mapAR = (val?: string) => {
      switch (val) {
        case '16:9': return { w: 1920, h: 1088 };
        case '9:16': return { w: 1088, h: 1920 };
        case '3:2': return { w: 1536, h: 1024 };
        case '2:3': return { w: 1024, h: 1536 };
        case '4:3': return { w: 1408, h: 1056 };
        case '1:1':
        default: return { w: 1024, h: 1024 };
      }
    };
    const dims = mapAR(ar);
    if (graph['27']?.inputs) {
      graph['27'].inputs.width = dims.w;
      graph['27'].inputs.height = dims.h;
      if (typeof body?.batch_size === 'number') graph['27'].inputs.batch_size = body.batch_size;
    }
    if (graph['188']?.inputs) {
      // Only touch batch size for modify unless AR provided
      if (ar) { graph['188'].inputs.width = dims.w; graph['188'].inputs.height = dims.h; }
      if (typeof body?.batch_size === 'number') graph['188'].inputs.batch_size = body.batch_size;
    }
    // LoRA loader (rgthree) is node 47; we pass through filename/scale when provided
    if (graph['47']?.inputs && typeof body?.lora === 'string' && body.lora) {
      // Many rgthree loaders accept a list of loras; here we set header field if present
      // If your graph needs a different field, tell me and I will map it exactly
      graph['47'].inputs['➕ Add Lora'] = body.lora;
      if (typeof body?.lora_scale === 'number') {
        graph['47'].inputs['lora_scale'] = body.lora_scale;
      }
    }

    // CFG/Guidance/Seed (with safe defaults = keep workflow defaults)
    const cfgScale: number | undefined = typeof body?.cfg === 'number' ? body.cfg : undefined;
    const guidance: number | undefined = typeof body?.guidance === 'number' ? body.guidance : undefined;
    const overrideSteps: number | undefined = typeof body?.steps === 'number' ? body.steps : undefined;
    if (graph['31']?.inputs) {
      if (typeof cfgScale === 'number') graph['31'].inputs.cfg = cfgScale;
      if (typeof overrideSteps === 'number') graph['31'].inputs.steps = Math.max(1, Math.round(overrideSteps));
      if (typeof guidance === 'number' && graph['35']?.inputs) graph['35'].inputs.guidance = guidance;
      // default: do not set seed to preserve workflow default
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
      // 1) POST /prompt with { prompt: graph }
      const promptPayload = { prompt: graph };
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


