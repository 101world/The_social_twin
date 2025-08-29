// Lightweight end-to-end smoke test for Social Twin "image-modify"
// Usage: node test-modify-runpod.js
// It uses NEXT_PUBLIC_RUNPOD_IMAGE_URL and RUNPOD_API_KEY env if set.

const fs = require('fs');
const path = require('path');

const DEFAULT_URL = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || 'https://9wc6zqlr5p7i6a-3001.proxy.runpod.net/';
const API_KEY = process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_KEY;
const SAMPLE_IMAGE = process.env.TEST_REF_IMAGE || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png';
const PROMPT_TEXT = process.env.TEST_PROMPT || 'Make the scene dusk, more apocalyptic, cinematic lighting';

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
        // try next
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

async function submitGraph(base, graph, apiKey, clientId = 'test_modify') {
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

(async () => {
  try {
    const base = DEFAULT_URL;
    console.log('Using RunPod base:', base);
    console.log('API Key present:', !!API_KEY);
    console.log('Prompt:', PROMPT_TEXT);
    console.log('Reference image:', SAMPLE_IMAGE);

    // 1) Upload reference
    console.log('Uploading reference image...');
    const uploaded = await uploadReference(base, API_KEY, SAMPLE_IMAGE);
    if (!uploaded) throw new Error('Upload failed');
    console.log('Uploaded name:', uploaded);

    // 2) Load SocialTwin-Modify.json
    const wfPath = path.resolve(process.cwd(), 'Workflows', 'SocialTwin-Modify.json');
    const raw = fs.readFileSync(wfPath, 'utf-8');
    const graph = JSON.parse(raw);

    // 3) Patch prompt
    const pos = findByClassAndTitle(graph, 'CLIPTextEncode', 'Positive') || '6';
    if (pos && graph[pos] && graph[pos].inputs) graph[pos].inputs.text = PROMPT_TEXT;

    // 4) Inject uploaded image into LoadImage node
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

    // 5) Optionally patch dims
    const dimsKey = findByClassAndTitle(graph, 'EmptySD3LatentImage') || '188';
    if (dimsKey && graph[dimsKey] && graph[dimsKey].inputs) {
      graph[dimsKey].inputs.width = 1024; graph[dimsKey].inputs.height = 1024;
    }

    // 6) Submit
    console.log('Submitting prompt...');
    const submitJson = await submitGraph(base, graph, API_KEY, 'test_modify_runner');
    const promptId = submitJson?.prompt_id || submitJson?.id || submitJson?.promptId;
    if (!promptId) throw new Error('Missing prompt_id in submit response: ' + JSON.stringify(submitJson).slice(0,200));
    console.log('Prompt ID:', promptId);

    // 7) Poll history
    console.log('Polling history for outputs (up to 5 minutes)...');
    const images = await pollHistory(base, promptId, API_KEY, 5 * 60 * 1000);
    console.log('Received images:');
    for (const u of images) console.log('-', u);
    console.log('SUCCESS');
  } catch (err) {
    console.error('Test failed:', err?.message || err);
    process.exit(1);
  }
})();
