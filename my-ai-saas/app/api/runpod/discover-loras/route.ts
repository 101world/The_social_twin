import { NextRequest, NextResponse } from 'next/server';
import { pickRunpodUrlFromConfig, getRunpodConfig } from '@/lib/supabase';
import crypto from 'crypto';

interface LoRAInfo {
  name: string;
  filename: string;
  type: 'character' | 'style' | 'concept' | 'other';
  path?: string;
  size?: number;
  created?: string;
  last_modified?: string;
  thumbnail?: string;
  description?: string;
  tags?: string[];
  strength_recommended?: number;
}

// Mock data for now - will be replaced with real RunPod scanning
const MOCK_LORAS: LoRAInfo[] = [
  {
    name: 'Maahi Character',
    filename: 'maahi_character_lora.safetensors',
    type: 'character',
    thumbnail: '/api/runpod/lora-thumbnail?file=maahi_character_lora.safetensors',
    description: 'Indian boy character with brown jacket and jeans',
    tags: ['character', 'male', 'indian', 'young'],
    strength_recommended: 0.8
  },
  {
    name: 'Anime Style',
    filename: 'anime_style_v2.safetensors',
    type: 'style',
    thumbnail: '/api/runpod/lora-thumbnail?file=anime_style_v2.safetensors',
    description: 'High quality anime art style',
    tags: ['anime', 'illustration', 'colorful'],
    strength_recommended: 0.6
  },
  {
    name: 'Realistic Portrait',
    filename: 'realistic_portrait_xl.safetensors',
    type: 'style',
    thumbnail: '/api/runpod/lora-thumbnail?file=realistic_portrait_xl.safetensors',
    description: 'Photorealistic portrait enhancement',
    tags: ['realistic', 'portrait', 'photography'],
    strength_recommended: 0.7
  },
  {
    name: 'Cyberpunk City',
    filename: 'cyberpunk_environment.safetensors',
    type: 'concept',
    thumbnail: '/api/runpod/lora-thumbnail?file=cyberpunk_environment.safetensors',
    description: 'Futuristic cyberpunk cityscapes',
    tags: ['cyberpunk', 'futuristic', 'neon', 'city'],
    strength_recommended: 0.9
  }
];

function ensureBase(u: string) { return u.replace(/\/$/, ''); }
function deriveBase(u: string | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    return url.origin; // strips any /lab/tree/... etc.
  } catch {
    // Fallback: best-effort trim at first single slash after protocol
    const m = /^(https?:\/\/[^/]+)/i.exec(u);
    return m ? m[1] : ensureBase(u);
  }
}

function classifyLoRA(nameOrPath: string): LoRAInfo['type'] {
  const s = nameOrPath.toLowerCase();
  if (/(character|char_|_char|person|face|actor|model|maahi|girl|boy)/.test(s)) return 'character';
  if (/(style|anime|toon|illustration|comic|manga|realistic|photoreal|cinematic|oil|sketch)/.test(s)) return 'style';
  if (/(concept|env|environment|city|cyberpunk|scifi|fantasy|mecha|vehicle|background)/.test(s)) return 'concept';
  return 'other';
}

async function listViaJupyterContents(runpodUrl: string, rootPath = 'workspace/ComfyUI/models/loras', maxDepth = 3): Promise<LoRAInfo[]> {
  const base = ensureBase(runpodUrl);
  const results: LoRAInfo[] = [];

  async function walk(p: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    const url = `${base}/api/contents/${encodeURIComponent(p)}?content=1`;
    let j: any;
    try {
      const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) return;
      j = await r.json();
    } catch {
      return;
    }
    if (!j) return;
    if (j.type === 'directory' && Array.isArray(j.content)) {
      for (const entry of j.content) {
        if (entry.type === 'directory') {
          await walk(entry.path || `${p}/${entry.name}`, depth + 1);
        } else if (entry.type === 'file') {
          const name: string = entry.name || '';
          if (/\.(safetensors|pt|ckpt)$/i.test(name)) {
            const info: LoRAInfo = {
              name: name.replace(/\.(safetensors|pt|ckpt)$/i, ''),
              filename: name,
              path: entry.path || `${p}/${name}`,
              size: typeof entry.size === 'number' ? entry.size : undefined,
              created: entry.created,
              last_modified: entry.last_modified,
              type: classifyLoRA(`${entry.path || p}/${name}`),
              // Thumbnail could be implemented via a separate preview service if available
            };
            results.push(info);
          }
        }
      }
    }
  }

  await walk(rootPath, 0);
  return results;
}

async function discoverLoRAsFromRunPod(runpodUrl: string, rootPath = 'workspace/ComfyUI/models/loras'): Promise<LoRAInfo[]> {
  // 1) Try Jupyter Contents API (works on RunPod Jupyter servers)
  const fromJupyter = await listViaJupyterContents(runpodUrl, rootPath).catch(() => [] as LoRAInfo[]);
  if (fromJupyter && fromJupyter.length) return fromJupyter;

  // 2) Optional: fallback to any custom endpoint if present
  try {
    const response = await fetch(`${ensureBase(runpodUrl)}/api/loras`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.loras)) return data.loras as LoRAInfo[];
    }
  } catch {}

  // 3) No mock by default; return empty to reflect storage-only policy
  return [];
}

export async function GET(req: NextRequest) {
  try {
    // Allow override via query param ?url=... or ?urls=a,b; normalize to origins
    const urlParam = req.nextUrl.searchParams.get('url') || req.nextUrl.searchParams.get('base');
    const urlsParam = req.nextUrl.searchParams.get('urls');
    const rootParam = req.nextUrl.searchParams.get('root') || 'workspace/ComfyUI/models/loras';
    const candidates: string[] = [];
    if (urlsParam) {
      for (const raw of urlsParam.split(',').map(s=>s.trim()).filter(Boolean)) {
        const origin = deriveBase(raw);
        if (origin) candidates.push(origin);
      }
    }
    if (urlParam) {
      const origin = deriveBase(urlParam);
      if (origin) candidates.push(origin);
    }

    // Get RunPod URL from config if not overridden
  let runpodUrl: string | undefined = candidates[0];
    if (!runpodUrl) {
      const cfg = await getRunpodConfig().catch(() => null);
  const picked = pickRunpodUrlFromConfig({ mode: 'image', config: cfg });
  runpodUrl = deriveBase(picked);
    }

    if (!runpodUrl) {
      return NextResponse.json({ 
        error: 'No RunPod URL configured' 
      }, { status: 500 });
    }

    // Discover available LoRAs with fallback across candidates
    let loras: LoRAInfo[] = [];
    const tried: string[] = [];
    const allCandidates = [runpodUrl!, ...candidates.filter(c=>c !== runpodUrl)];
    for (const base of allCandidates) {
      tried.push(base);
      loras = await discoverLoRAsFromRunPod(base, rootParam!);
      if (loras && loras.length) { runpodUrl = base; break; }
    }
    // Allow opt-in mock for development only (env or query)
    const allowMocks = process.env.ALLOW_LORA_MOCKS === 'true' || req.nextUrl.searchParams.get('mock') === '1';
    if ((!loras || loras.length === 0) && allowMocks) {
      loras = MOCK_LORAS;
    }

    // Group by type for better organization
    const groupedLoras = {
      character: loras.filter(l => l.type === 'character'),
      style: loras.filter(l => l.type === 'style'),
      concept: loras.filter(l => l.type === 'concept'),
      other: loras.filter(l => l.type === 'other')
    };

    // Compute a simple fingerprint so future URL changes can detect same storage
    const fpSource = loras
      .slice()
      .sort((a,b)=> (a.filename||'').localeCompare(b.filename||''))
      .map(x=> `${x.filename}|${x.size||0}|${x.path||''}`)
      .join('\n');
    const fingerprint = crypto.createHash('sha256').update(fpSource).digest('hex');

    return NextResponse.json({
      success: true,
      loras: groupedLoras,
      total: loras.length,
      runpod_url: runpodUrl,
      root_path: rootParam,
      tried_urls: tried,
      fingerprint
    });

  } catch (error: any) {
    console.error('LoRA discovery error:', error);
    return NextResponse.json({ 
      error: 'Failed to discover LoRAs',
      details: error.message 
    }, { status: 500 });
  }
}
