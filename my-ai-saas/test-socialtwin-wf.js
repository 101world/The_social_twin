// Smoke test: submit Socialtwin-Image.json and SocialTwin-Modify.json with workflow_settings
// Usage: node test-socialtwin-wf.js
// Requires NEXT_PUBLIC_RUNPOD_IMAGE_URL or will use the default used elsewhere

const fs = require('fs');
const path = require('path');

const DEFAULT_URL = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || 'https://9wc6zqlr5p7i6a-3001.proxy.runpod.net/';
const API_KEY = process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_KEY;
const SAMPLE_IMAGE = process.env.TEST_REF_IMAGE || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png';

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...(API_KEY ? { 'X-RunPod-Api-Key': API_KEY } : {}),
  };
}

async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to download ref image ${r.status}`);
  const ct = r.headers.get('content-type') || 'image/png';
  const ab = await r.arrayBuffer();
  return { bytes: Buffer.from(ab), contentType: ct };
}

async function uploadReference(base, apiKey, refUrl) {
  const b = base.replace(/\/$/, '');
  const candidatePaths = [
    `${b}/upload/image`,
    `${b}/upload`,
    `${b}/upload/image?type=input&overwrite=true`,
    `${b}/upload?type=input&overwrite=true`,
  ];
  const fields = ['image', 'file', 'files', 'files[]', 'image[]'];
  const { bytes, contentType } = await fetchBytes(refUrl);
  const filename = contentType.includes('jpeg') ? 'input.jpg' : 'input.png';
  const authHeaders = { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...(apiKey ? { 'x-api-key': apiKey } : {}), ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}) };

  for (const url of candidatePaths) {
    for (const field of fields) {
      try {
        const fd = new FormData();
        fd.append(field, new Blob([bytes], { type: contentType }), filename);
        fd.append('type', 'input');
        fd.append('overwrite', 'true');
        const res = await fetch(url, { method: 'POST', headers: authHeaders, body: fd });
        const txt = await res.text().catch(() => '');
        if (res.ok) {
          try {
            const j = txt ? JSON.parse(txt) : {};
            const name = j?.name || j?.filename || (typeof j?.path === 'string' ? j.path.split('/').pop() : undefined);
            return name || filename;
          } catch {
            return txt.replace(/\r?\n/g, '').trim() || filename;
          }
        }
      } catch (err) {
        // try next option
      }
    }
  }
  return null;
}

function findNodeKeyBy(graphObj, predicate) {
  try {
    for (const k of Object.keys(graphObj)) {
      const n = graphObj[k];
      if (n && typeof n === 'object' && predicate(n)) return k;
    }
  } catch {}
  return null;
}

function findByClassAndTitle(graphObj, classType, titleIncludes) {
  return findNodeKeyBy(graphObj, (n) => {
    if (n.class_type !== classType) return false;
    if (!titleIncludes) return true;
    const t = n?._meta?.title || '';
    return typeof t === 'string' && t.toLowerCase().includes(titleIncludes.toLowerCase());
  });
}

async function submitGraph(base, graph, apiKey, clientId = 'test_socialtwin_wf') {
  const b = base.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...(apiKey ? { 'x-api-key': apiKey } : {}), ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}) };
  const res = await fetch(`${b}/prompt`, { method: 'POST', headers, body: JSON.stringify({ prompt: graph, client_id: clientId }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`/prompt failed ${res.status}: ${text.slice(0,200)}`);
  try { return JSON.parse(text); } catch { return {} }
}

async function pollHistory(base, promptId, apiKey, timeoutMs = 5 * 60 * 1000) {
  const b = base.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...(apiKey ? { 'x-api-key': apiKey } : {}), ...(apiKey ? { 'X-RunPod-Api-Key': apiKey } : {}) };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${b}/history/${encodeURIComponent(promptId)}`, { headers });
    const t = await r.text().catch(() => '');
    let j = {};
    try { j = t ? JSON.parse(t) : {}; } catch {}
    const bag = j?.[promptId]?.outputs || j?.outputs || {};
    const images = [];
    for (const k of Object.keys(bag)) {
      const node = bag[k];
      if (node?.images) {
        for (const img of node.images) {
          const fn = img?.filename ?? img?.name ?? img;
          const sub = img?.subfolder ?? '';
          const ttype = img?.type ?? 'output';
          const url = `${b}/view?filename=${encodeURIComponent(fn)}&subfolder=${encodeURIComponent(sub)}&type=${encodeURIComponent(ttype)}`;
          images.push(url);
        }
      }
    }
    if (images.length) return images;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for runpod history outputs');
}

async function runImageWorkflow(base, apiKey) {
  console.log('\n=== Testing Socialtwin-Image.json with workflow_settings ===');
  const wfPath = path.resolve(process.cwd(), 'Workflows', 'Socialtwin-Image.json');
  const raw = fs.readFileSync(wfPath, 'utf-8');
  const graph = JSON.parse(raw);

  // patch prompt
  const prompt = 'A futuristic cityscape at dusk, cinematic lighting, ultra-detailed';
  const pos = findByClassAndTitle(graph, 'CLIPTextEncode', 'Positive') || '6';
  if (pos && graph[pos] && graph[pos].inputs) graph[pos].inputs.text = prompt;

  // Apply workflow_settings
  const samplerKey = findByClassAndTitle(graph, 'KSampler') || '31';
  if (samplerKey && graph[samplerKey] && graph[samplerKey].inputs) {
    graph[samplerKey].inputs.sampler_name = 'dpm_2';
    graph[samplerKey].inputs.sampler = 'dpm_2';
    graph[samplerKey].inputs.denoise = 0.6;
  }
  const unetKey = findByClassAndTitle(graph, 'UNet', 'UNET') || findNodeKeyBy(graph, (n)=> (n.class_type||'').toLowerCase().includes('unet'));
  if (unetKey && graph[unetKey] && graph[unetKey].inputs) {
    graph[unetKey].inputs.unet_name = 'flux1-kontext-dev.safetensors';
    graph[unetKey].inputs.name = 'flux1-kontext-dev.safetensors';
  }

  console.log('Submitting image graph with sampler=dpm_2, denoise=0.6, unet=flux1-kontext-dev.safetensors');
  const submit = await submitGraph(base, graph, apiKey, 'test_socialtwin_image');
  const promptId = submit?.prompt_id || submit?.id || submit?.promptId;
  if (!promptId) throw new Error('No prompt_id returned for image graph submission');
  console.log('Prompt ID:', promptId);
  const outputs = await pollHistory(base, promptId, apiKey);
  console.log('Image outputs:'); outputs.forEach(u=> console.log('-', u));
}

async function runModifyWorkflow(base, apiKey) {
  console.log('\n=== Testing SocialTwin-Modify.json with workflow_settings ===');
  const wfPath = path.resolve(process.cwd(), 'Workflows', 'SocialTwin-Modify.json');
  const raw = fs.readFileSync(wfPath, 'utf-8');
  const graph = JSON.parse(raw);

  const prompt = 'Add cinematic dusk lighting and subtle film grain';
  const pos = findByClassAndTitle(graph, 'CLIPTextEncode', 'Positive') || '6';
  if (pos && graph[pos] && graph[pos].inputs) graph[pos].inputs.text = prompt;

  // Upload reference image
  console.log('Uploading reference image...');
  const uploaded = await uploadReference(base, apiKey, SAMPLE_IMAGE);
  if (!uploaded) throw new Error('Failed to upload reference image');
  console.log('Uploaded ref name:', uploaded);

  // Inject into LoadImage
  let loadKey = null;
  if (graph['190'] && graph['190'].class_type === 'LoadImage') loadKey = '190';
  if (!loadKey) {
    for (const k of Object.keys(graph)) {
      const n = graph[k];
      if (n && (n.class_type === 'LoadImage' || n.class_type === 'Load Image' || n._meta?.title === 'Load Image') && n.inputs) { loadKey = k; break; }
    }
  }
  if (!loadKey) throw new Error('Modify graph missing LoadImage node');
  graph[loadKey].inputs.image = uploaded;

  // Apply workflow_settings to sampler/unet/denoise
  const samplerKey = findByClassAndTitle(graph, 'KSampler') || '31';
  if (samplerKey && graph[samplerKey] && graph[samplerKey].inputs) {
    graph[samplerKey].inputs.sampler_name = 'dpm_2';
    graph[samplerKey].inputs.sampler = 'dpm_2';
    graph[samplerKey].inputs.denoise = 0.6;
  }
  const unetKey = findByClassAndTitle(graph, 'UNet', 'UNET') || findNodeKeyBy(graph, (n)=> (n.class_type||'').toLowerCase().includes('unet'));
  if (unetKey && graph[unetKey] && graph[unetKey].inputs) {
    graph[unetKey].inputs.unet_name = 'flux1-kontext-dev.safetensors';
    graph[unetKey].inputs.name = 'flux1-kontext-dev.safetensors';
  }

  console.log('Submitting modify graph with sampler=dpm_2, denoise=0.6, unet=flux1-kontext-dev.safetensors');
  const submit = await submitGraph(base, graph, apiKey, 'test_socialtwin_modify');
  const promptId = submit?.prompt_id || submit?.id || submit?.promptId;
  if (!promptId) throw new Error('No prompt_id returned for modify graph submission');
  console.log('Prompt ID:', promptId);
  const outputs = await pollHistory(base, promptId, apiKey);
  console.log('Modify outputs:'); outputs.forEach(u=> console.log('-', u));
}

(async () => {
  try {
    const base = DEFAULT_URL;
    console.log('RunPod base:', base);
    console.log('API Key present:', !!API_KEY);

    await runImageWorkflow(base, API_KEY);
    await runModifyWorkflow(base, API_KEY);

    console.log('\nBoth workflows submitted and returned outputs.');
  } catch (err) {
    console.error('Smoke test failed:', err?.message || err);
    process.exit(1);
  }
})();
