#!/usr/bin/env node
/**
 * RunPod autoscaler helper
 * - Maintains a warm pool of RunPod GPU pods based on queue length
 * - Starts pods via RunPod API and stops idle pods after TTL
 * - Writes instance metadata to Supabase table `runpod_instances` if SUPABASE_SERVICE_ROLE_KEY is present,
 *   otherwise falls back to a local .runpod_instances.json file in the repo root
 *
 * Configure with environment variables (see README-runpod-autoscaler.md)
 */

import fs from 'fs';
import path from 'path';

const POLL_INTERVAL = Number(process.env.RUNPOD_AUTOSCALER_POLL_SECONDS || '20') * 1000;
const IDLE_TTL = Number(process.env.RUNPOD_IDLE_TTL_SECONDS || '300'); // seconds
const WARM_POOL = Number(process.env.RUNPOD_WARM_POOL || '1');
const MAX_PODS = Number(process.env.RUNPOD_MAX_PODS || '4');

const STATE_FILE = path.resolve(process.cwd(), '.runpod_instances.json');

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || process.env.NEXT_PUBLIC_RUNPOD_API_KEY || '';
const RUNPOD_BASE_URL = process.env.RUNPOD_BASE_URL || process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || '';

if (!RUNPOD_API_KEY) {
  console.warn('WARN: RUNPOD_API_KEY is not set — start/stop API calls will be no-ops. Set RUNPOD_API_KEY to enable.');
}

type InstanceRecord = {
  id: string; // internal id or RunPod instance id
  endpoint?: string; // http endpoint to send generations to
  status: 'starting' | 'ready' | 'busy' | 'stopping' | 'stopped' | 'error';
  started_at?: string;
  last_used_at?: string | null;
  meta?: any;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Local state fallback
function readLocalState(): InstanceRecord[] {
  try {
    if (!fs.existsSync(STATE_FILE)) return [];
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function writeLocalState(items: InstanceRecord[]) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(items, null, 2), 'utf8');
}

// Supabase-backed functions (optional)
async function getSupabaseClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    // dynamic import to avoid startup issues in environments without node fetch polyfills
    const { createSupabaseAdminClient } = await import('../lib/supabase');
    return createSupabaseAdminClient();
  } catch (e) {
    console.error('Failed to create Supabase admin client', String(e));
    return null;
  }
}

async function listInstances(): Promise<InstanceRecord[]> {
  const sb = await getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('runpod_instances').select('*');
      if (!error && Array.isArray(data)) return data as InstanceRecord[];
    } catch (e) {
      // fall back
    }
  }
  return readLocalState();
}

async function persistInstances(items: InstanceRecord[]) {
  const sb = await getSupabaseClient();
  if (sb) {
    try {
      // naive: upsert all items using id as primary key
      await sb.from('runpod_instances').upsert(items, { onConflict: 'id' });
      return;
    } catch (e) {
      // fall back to local
    }
  }
  writeLocalState(items);
}

// Queue length query
async function getPendingCount(): Promise<number> {
  const sb = await getSupabaseClient();
  if (sb) {
    try {
      const { count, error } = await sb.from('media_generations').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (!error) return count || 0;
    } catch (e) {}
  }
  // fallback: return 0
  return 0;
}

// Start a RunPod instance (stubbed to call a user-provided start endpoint)
async function startRunPodInstance(): Promise<InstanceRecord | null> {
  if (!RUNPOD_API_KEY || !RUNPOD_BASE_URL) {
    console.warn('RunPod API key or base url missing; not starting instance');
    return null;
  }

  // Example: POST to RUNPOD_BASE_URL/jobs or /instances — adapt to your RunPod API
  try {
    const startUrl = process.env.RUNPOD_START_URL || `${RUNPOD_BASE_URL}`;
    const body = {
      // Populate with the exact body your RunPod endpoint expects
      // e.g. workflow_id, type, template, env, etc.
      // You should set RUNPOD_START_BODY env var as a JSON string if you want custom body.
      ...(process.env.RUNPOD_START_BODY ? JSON.parse(process.env.RUNPOD_START_BODY) : {}),
    };

    const res = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    // The response shape depends on RunPod; map to InstanceRecord
    const instance: InstanceRecord = {
      id: String(data.id || data.instance_id || Date.now()),
      endpoint: data.endpoint || data.url || data.public_url || null,
      status: data.endpoint || data.url ? 'ready' : 'starting',
      started_at: new Date().toISOString(),
      last_used_at: null,
      meta: data,
    };
    return instance;
  } catch (e) {
    console.error('startRunPodInstance failed', String(e));
    return null;
  }
}

async function stopRunPodInstance(instanceId: string): Promise<boolean> {
  if (!RUNPOD_API_KEY || !RUNPOD_BASE_URL) {
    console.warn('RunPod API key or base url missing; not stopping instance');
    return false;
  }
  try {
    const stopUrl = process.env.RUNPOD_STOP_URL || `${RUNPOD_BASE_URL}/stop/${instanceId}`;
    const res = await fetch(stopUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({ id: instanceId }),
    });
    if (res.ok) return true;
  } catch (e) {
    console.error('stopRunPodInstance failed', String(e));
  }
  return false;
}

async function reconcile() {
  const pending = await getPendingCount();
  const instances = await listInstances();
  const ready = instances.filter((i) => i.status === 'ready' || i.status === 'busy');
  const total = instances.length;

  console.log(new Date().toISOString(), 'pending=', pending, 'totalInstances=', total, 'ready=', ready.length);

  // desired based on simple rule: WARM_POOL + ceil(pending / 2)
  const desired = Math.min(MAX_PODS, Math.max(WARM_POOL, WARM_POOL + Math.ceil(pending / 2)));

  // scale up
  if (total < desired) {
    const toStart = Math.min(desired - total, MAX_PODS - total);
    console.log('Scaling up, starting', toStart, 'instance(s)');
    for (let i = 0; i < toStart; i++) {
      const inst = await startRunPodInstance();
      if (inst) {
        instances.push(inst);
        await persistInstances(instances);
      }
      // small delay between starts
      await sleep(2000);
    }
  }

  // scale down idle instances
  const now = Date.now();
  for (const inst of instances.slice()) {
    const lastUsed = inst.last_used_at ? new Date(inst.last_used_at).getTime() : new Date(inst.started_at || '').getTime();
    const idle = Math.floor((now - (lastUsed || now)) / 1000);
    if ((inst.status === 'ready' || inst.status === 'stopped') && idle > IDLE_TTL && instances.length > WARM_POOL) {
      console.log('Stopping idle instance', inst.id, 'idle seconds', idle);
      inst.status = 'stopping';
      await persistInstances(instances);
      const ok = await stopRunPodInstance(inst.id);
      if (ok) {
        inst.status = 'stopped';
        inst.last_used_at = new Date().toISOString();
        // remove from list
        const idx = instances.findIndex((x) => x.id === inst.id);
        if (idx >= 0) instances.splice(idx, 1);
        await persistInstances(instances);
      } else {
        inst.status = 'error';
        await persistInstances(instances);
      }
    }
  }
}

async function mainLoop() {
  console.log('RunPod autoscaler starting. pollInterval=', POLL_INTERVAL / 1000, 's, warmPool=', WARM_POOL, 'maxPods=', MAX_PODS);
  while (true) {
    try {
      await reconcile();
    } catch (e) {
      console.error('autoscaler reconcile failed', String(e));
    }
    await sleep(POLL_INTERVAL);
  }
}

if (require.main === module) {
  mainLoop().catch((e) => {
    console.error('autoscaler failed', e);
    process.exit(1);
  });
}

export {};
