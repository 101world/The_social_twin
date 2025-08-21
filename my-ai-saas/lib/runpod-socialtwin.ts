import { promises as fs } from 'fs';
import path from 'path';

export type SocialTwinMode = 'image' | 'image-modify' | 'video' | 'text';

type RunParams = {
  mode: SocialTwinMode;
  prompt: string;
  negative?: string;
  width?: number;
  height?: number;
  batch_size?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  imageUrl?: string; // for image-modify/video image-source
  attachment?: { dataUrl?: string };
  runpodUrl: string;
  apiKey?: string;
  userId?: string | null;
  ckpt_name?: string; // optional override for image mode
  workflow_settings?: any;
};

function ensureBase(url: string) {
  return url.replace(/\/$/, '');
}

async function loadWorkflowJson(fileName: string): Promise<any> {
  const p = path.resolve(process.cwd(), 'Workflows', fileName);
  const raw = await fs.readFile(p, 'utf-8');
  return JSON.parse(raw);
}

function findNodeKeyBy(graphObj: any, predicate: (node: any) => boolean): string | null {
  try {
    for (const k of Object.keys(graphObj)) {
      const n = graphObj[k];
      if (n && typeof n === 'object' && predicate(n)) return k;
    }
  } catch {}
  return null;
}
function findByClassAndTitle(graphObj: any, classType: string, titleIncludes?: string): string | null {
  return findNodeKeyBy(graphObj, (n) => {
    if (n.class_type !== classType) return false;
    if (!titleIncludes) return true;
    const t = n?._meta?.title || '';
    return typeof t === 'string' && t.toLowerCase().includes(titleIncludes.toLowerCase());
  });
}

async function uploadReferenceToComfy(base: string, apiKey: string | undefined, refUrl: string, filenameDefault = 'input.png'): Promise<string | null> {
  let bytes: Uint8Array | null = null;
  let contentType = 'image/png';
  try {
    if (refUrl.startsWith('data:')) {
      const m = /data:(.*?);base64,(.*)$/i.exec(refUrl);
      if (m) { contentType = m[1] || contentType; bytes = Buffer.from(m[2], 'base64'); }
    } else {
      const resp = await fetch(refUrl);
      contentType = resp.headers.get('content-type') || contentType;
      bytes = new Uint8Array(await resp.arrayBuffer());
    }
  } catch {}
  if (!bytes) return null;
  const filename = contentType.includes('jpeg') ? 'input.jpg' : filenameDefault;
  const authOnlyHeaders = {
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
  } as Record<string, string>;
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
      fd.append('type', 'input');
      fd.append('overwrite', 'true');
      try {
        const resp = await fetch(pathUrl, { method: 'POST', headers: authOnlyHeaders, body: fd as any });
        if (resp.ok) {
          let name: string | undefined;
          const txt = await resp.text().catch(() => '');
          if (txt) { try { const j: any = JSON.parse(txt); name = j?.name || j?.filename || (typeof j?.path === 'string' ? j.path.split('/').pop() : undefined); } catch { name = txt.replace(/\r?\n/g, '').trim() || undefined; } }
          return name || filename;
        }
      } catch {}
    }
  }
  return null;
}

export async function runSocialTwinGeneration(params: RunParams): Promise<{ images: string[]; videos: string[]; urls: string[]; runpod: any; }>{
  const { mode, prompt, negative, width, height, batch_size, steps, cfg, seed, imageUrl, attachment, runpodUrl, apiKey, userId, ckpt_name } = params;
  const base = ensureBase(runpodUrl);
  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}),
  } as Record<string, string>;

  let graph: any = {};
  const userSeed = typeof seed === 'number' ? seed : Math.floor(Math.random() * 1000000);

  // Load workflow and patch
  if (mode === 'image') {
    graph = await loadWorkflowJson('Socialtwin-Image.json');
    const posKey = findByClassAndTitle(graph, 'CLIPTextEncode', 'Positive') || '6';
    const negKey = findByClassAndTitle(graph, 'CLIPTextEncode', 'Negative') || '33';
    const dimsKey = findByClassAndTitle(graph, 'EmptySD3LatentImage') || '27';
    const samplerKey = findByClassAndTitle(graph, 'KSampler') || '31';
    const ckptKey = findByClassAndTitle(graph, 'CheckpointLoaderSimple') || '30';
    if (posKey && graph[posKey]?.inputs) graph[posKey].inputs.text = prompt;
    if (typeof negative === 'string' && negKey && graph[negKey]?.inputs) graph[negKey].inputs.text = negative;
    if (dimsKey && graph[dimsKey]?.inputs) {
      graph[dimsKey].inputs.width = typeof width === 'number' ? width : (graph[dimsKey].inputs.width ?? 1024);
      graph[dimsKey].inputs.height = typeof height === 'number' ? height : (graph[dimsKey].inputs.height ?? 1024);
      if (typeof batch_size === 'number') graph[dimsKey].inputs.batch_size = batch_size;
    }
    // Apply workflow_settings if present
    try {
      const wf = (params as any).workflow_settings;
      if (wf) {
        if (wf.sampler && samplerKey && graph[samplerKey]?.inputs) {
          graph[samplerKey].inputs.sampler_name = wf.sampler;
          graph[samplerKey].inputs.sampler = wf.sampler;
        }
        if (typeof wf.denoise === 'number' && samplerKey && graph[samplerKey]?.inputs) {
          graph[samplerKey].inputs.denoise = wf.denoise;
        }
        if (wf.unet) {
          const unetKey = findByClassAndTitle(graph, 'UNet', 'UNET') || findNodeKeyBy(graph, (n:any)=> (n.class_type||'').toLowerCase().includes('unet'));
          if (unetKey && graph[unetKey]?.inputs) {
            graph[unetKey].inputs.unet_name = wf.unet;
            graph[unetKey].inputs.name = wf.unet;
          }
        }
      }
    } catch (e) { /* ignore */ }
    if (samplerKey && graph[samplerKey]?.inputs) {
      if (typeof steps === 'number') graph[samplerKey].inputs.steps = Math.max(1, Math.round(steps));
      if (typeof cfg === 'number') graph[samplerKey].inputs.cfg = cfg;
      graph[samplerKey].inputs.seed = userSeed;
    }
    // Apply workflow_settings if present (sampler/denoise/UNet overrides)
    try {
      const wf = (params as any).workflow_settings;
      if (wf) {
        if (wf.sampler && samplerKey && graph[samplerKey]?.inputs) {
          graph[samplerKey].inputs.sampler_name = wf.sampler;
          graph[samplerKey].inputs.sampler = wf.sampler;
        }
        if (typeof wf.denoise === 'number' && samplerKey && graph[samplerKey]?.inputs) {
          graph[samplerKey].inputs.denoise = wf.denoise;
        }
        if (wf.unet) {
          const unetKey = findByClassAndTitle(graph, 'UNet', 'UNET') || findNodeKeyBy(graph, (n:any)=> (n.class_type||'').toLowerCase().includes('unet'));
          if (unetKey && graph[unetKey]?.inputs) {
            graph[unetKey].inputs.unet_name = wf.unet;
            graph[unetKey].inputs.name = wf.unet;
          }
        }
      }
    } catch (e) { /* ignore workflow tweak failures */ }
    if (typeof ckpt_name === 'string' && ckpt_name && ckptKey && graph[ckptKey]?.inputs) {
      graph[ckptKey].inputs.ckpt_name = ckpt_name;
    }
  } else if (mode === 'image-modify') {
    graph = await loadWorkflowJson('SocialTwin-Modify.json');
    const posKey = findByClassAndTitle(graph, 'CLIPTextEncode', 'Positive') || '6';
    const dimsKey = findByClassAndTitle(graph, 'EmptySD3LatentImage') || '188';
    const samplerKey = findByClassAndTitle(graph, 'KSampler') || '31';
    if (posKey && graph[posKey]?.inputs) graph[posKey].inputs.text = prompt;
    if (dimsKey && graph[dimsKey]?.inputs) {
      graph[dimsKey].inputs.width = typeof width === 'number' ? width : (graph[dimsKey].inputs.width ?? 1024);
      graph[dimsKey].inputs.height = typeof height === 'number' ? height : (graph[dimsKey].inputs.height ?? 1024);
      if (typeof batch_size === 'number') graph[dimsKey].inputs.batch_size = batch_size;
    }
    if (samplerKey && graph[samplerKey]?.inputs) {
      if (typeof steps === 'number') graph[samplerKey].inputs.steps = Math.max(1, Math.round(steps));
      if (typeof cfg === 'number') graph[samplerKey].inputs.cfg = cfg;
      graph[samplerKey].inputs.seed = userSeed;
    }
    // Upload reference image and set LoadImage
    const refUrl: string | undefined = imageUrl || attachment?.dataUrl;
    if (!refUrl) throw new Error('Image Modify requires imageUrl or attachment.dataUrl');
    const uploadedName = await uploadReferenceToComfy(base, apiKey, refUrl);
    if (!uploadedName) throw new Error('Failed to upload reference image to Comfy');
    let loadKey: string | null = null;
    if ((graph as any)['190']?.class_type === 'LoadImage') loadKey = '190';
    if (!loadKey) {
      for (const k of Object.keys(graph)) {
        const node = (graph as any)[k];
        if (node && (node.class_type === 'LoadImage' || node.class_type === 'Load Image' || node._meta?.title === 'Load Image') && node.inputs) { loadKey = k; break; }
      }
    }
    if (!loadKey) throw new Error('Modify graph missing LoadImage node');
    (graph as any)[loadKey].inputs.image = uploadedName;
  } else {
    throw new Error('Unsupported mode for Social Twin');
  }

  const clientId = (userId ? `user_${userId}` : `client_${Math.random().toString(36).slice(2)}`);
  const submit = await fetch(`${base}/prompt`, { method: 'POST', headers, body: JSON.stringify({ prompt: graph, client_id: clientId }) });
  const submitText = await submit.text();
  if (!submit.ok) throw new Error(`RunPod submit failed ${submit.status}: ${submitText.slice(0, 200)}`);
  let sj: any = {};
  try { sj = submitText ? JSON.parse(submitText) : {}; } catch {}
  const promptId: string | undefined = sj?.prompt_id || sj?.id || sj?.promptId;
  if (!promptId) throw new Error('Missing prompt_id in RunPod response');

  const images: string[] = [];
  const videos: string[] = [];
  const maxTries = (mode as string) === 'video' ? 450 : 150;
  for (let i = 0; i < maxTries; i++) {
    const h = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, { headers });
    const ht = await h.text();
    let hj: any = {};
    try { hj = ht ? JSON.parse(ht) : {}; } catch {}
    const bag: any = hj?.[promptId]?.outputs || hj?.outputs || {};
    try {
      for (const k of Object.keys(bag)) {
        const node = bag[k];
        if (node?.images) {
          for (const img of node.images) {
            const fn = img?.filename ?? img?.name ?? img;
            const sub = img?.subfolder ?? '';
            const t = img?.type ?? 'output';
            const url = `${base}/view?filename=${encodeURIComponent(fn)}&subfolder=${encodeURIComponent(sub)}&type=${encodeURIComponent(t)}`;
            if (/\.(mp4|webm)(\?|$)/i.test(String(fn))) videos.push(url); else images.push(url);
          }
        }
        if (node?.videos) {
          for (const vid of node.videos) {
            const fn = vid?.filename ?? vid?.name ?? vid;
            const sub = vid?.subfolder ?? '';
            const t = vid?.type ?? 'output';
            const url = `${base}/view?filename=${encodeURIComponent(fn)}&subfolder=${encodeURIComponent(sub)}&type=${encodeURIComponent(t)}`;
            videos.push(url);
          }
        }
      }
    } catch {}
    if (images.length || videos.length) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  const urls = images.length ? images.slice() : videos.slice();
  return { images, videos, urls, runpod: sj };
}
