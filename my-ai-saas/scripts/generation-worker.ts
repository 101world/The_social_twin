// We'll dynamically import project modules inside main() to avoid module format issues
let runSocialTwinGeneration: any = null;
let createSupabaseAdminClient: any = null;

// Simple worker: poll for pending media_generations and process them one by one.
// Run with: node ./scripts/generation-worker.ts (ts-node recommended in dev)

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processJob(job: any, supabase: any, runFn: any) {
  const id = job.id;
  try {
    console.log('Attempting to claim job', id);
    // Try status-based atomic claim (newer schemas)
    let claimRes: any = null;
    try {
      claimRes = await supabase
        .from('media_generations')
        .update({ status: 'processing' })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();
    } catch (e) {
      // ignore
    }

    // If status-based claim failed (schema without status), try a conditional claim using result_url IS NULL
    if (!claimRes || claimRes.error || !claimRes.data) {
      try {
        // If the schema doesn't have status/generation_params, we expect test jobs
        // to be inserted with result_url = 'PENDING_FOR_WORKER'. Claim by atomically
        // replacing that sentinel with a processing sentinel.
        const processingValue = `PROCESSING_BY_${process.pid}_${Date.now()}`;
        const alt = await supabase
          .from('media_generations')
          .update({ result_url: processingValue })
          .eq('id', id)
          .eq('result_url', 'PENDING_FOR_WORKER')
          .select();
        claimRes = alt;
      } catch (e) {
        // ignore
      }
    }

    if (claimRes && claimRes.error) {
      console.log('Claim attempt returned error, skipping', id, claimRes.error);
      return;
    }
    if (!claimRes || !claimRes.data) {
      console.log('Failed to claim job (probably taken by another worker), skipping', id);
      return;
    }

    console.log('Processing job', id);

    const params = job.generation_params || {};
    const body = params.requestBody || {};
    const runpodUrl = params.runpodUrl || process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL;

  const out = await runFn({
      mode: params.mode || body.mode || 'image',
      prompt: params.prompt || body.prompt || '',
      imageUrl: body.imageUrl || body.attachment?.dataUrl || undefined,
      runpodUrl,
      apiKey: process.env.RUNPOD_API_KEY,
      userId: job.user_id,
      batch_size: body.batch_size || 1,
      width: body.width,
      height: body.height,
      steps: body.steps,
      cfg: body.cfg,
      seed: params.seed || body.seed,
      workflow_settings: body.workflow_settings || undefined
    });

    // Persist outputs to Supabase storage and update media_generations ONLY if user opted in.
    const sourceUrls = (out.urls && out.urls.length) ? out.urls : (out.images && out.images.length ? out.images : []);
    const delivered: string[] = [];
    const saveToLibrary = (job.generation_params && job.generation_params.saveToLibrary) === true;
    if (saveToLibrary && sourceUrls.length) {
      const bucket = job.type === 'video' ? 'generated-videos' : 'generated-images';
      try { await supabase.storage.createBucket(bucket, { public: false }).catch(()=>{}); } catch {}
      for (const src of sourceUrls) {
        try {
          let contentType = 'application/octet-stream';
          let data: Buffer | null = null;
          if (typeof src === 'string' && src.startsWith('data:')) {
            const m = /data:(.*?);base64,(.*)$/i.exec(src as string);
            if (m) { contentType = m[1] || contentType; data = Buffer.from(m[2], 'base64'); }
          } else {
            const resp = await fetch(src as string);
            contentType = resp.headers.get('content-type') || contentType;
            data = Buffer.from(await resp.arrayBuffer());
          }
          if (!data) continue;
          const ext = contentType.startsWith('image/') ? '.png' : contentType.startsWith('video/') ? '.mp4' : '';
          const fileName = `${job.user_id}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
          const path = `${job.user_id}/${fileName}`;
          const up = await supabase.storage.from(bucket).upload(path, data, { contentType, upsert: false });
          if (!up.error) {
            const storagePath = `storage:${bucket}/${path}`;
            delivered.push(storagePath);
          } else {
            console.warn('Supabase upload error', up.error);
          }
        } catch (e) { console.warn('Upload failed for', src, e); }
      }
    } else {
      // If user didn't opt-in to saving, record RunPod URLs in generation_params for transient access
      try {
        const paramsUpdate = { ...(job.generation_params || {}), result_urls: sourceUrls, saved_to_library: false };
        await supabase.from('media_generations').update({ generation_params: paramsUpdate }).eq('id', id).catch(()=>{});
      } catch (e) { /* ignore */ }
    }

    // Update job row
    const updates: any = { status: delivered.length ? 'completed' : 'failed', completed_at: new Date().toISOString() };
    try {
      if (delivered.length) {
        updates.result_url = delivered[0];
        updates.thumbnail_url = delivered[0];
        // mark generation as saved in generation_params for visibility
        const params = { ...(job.generation_params || {}), saved_to_library: true };
        updates.generation_params = params;
      }
      await supabase.from('media_generations').update(updates).eq('id', id);
    } catch (e) {
      console.warn('Failed to update job row after processing', id, e);
    }

    // Optionally insert a chat message into the topic so users see the generation in their history
    try {
      if (delivered.length && job.topic_id) {
        await supabase.from('chat_messages').insert({ topic_id: job.topic_id, user_id: job.user_id, role: 'ai', content: `Generated: ${updates.result_url}` });
      }
    } catch (e) { console.warn('Failed to insert chat message for job', id, e); }

    console.log('Job finished', id, updates);
  } catch (err: any) {
    console.error('Job processing error', id, err);
    try { await supabase.from('media_generations').update({ status: 'failed', error_message: String(err?.message || err) }).eq('id', id); } catch {}
  }
}

async function main() {
  // Use require() to load project modules so this script can run under ts-node/node
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const runmod = require('../lib/runpod-socialtwin');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const supmod = require('../lib/supabase');
  runSocialTwinGeneration = runmod.runSocialTwinGeneration || runmod.default?.runSocialTwinGeneration || runmod.default;
  createSupabaseAdminClient = supmod.createSupabaseAdminClient || supmod.default?.createSupabaseAdminClient || supmod.default;

  // Ensure required env vars are present before creating admin client
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL; generation worker cannot run in this environment. Exiting.');
    return;
  }

  const supabase = createSupabaseAdminClient();
  console.log('Generation worker started');
  while (true) {
    try {
      // Try to select pending jobs (newer schemas). If the 'status' column doesn't exist
      // fall back to selecting recent rows where result_url is null (older/simple schemas).
      let jobs = null;
      try {
        const sel = await supabase
          .from('media_generations')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(5);
        if (!sel.error && sel.data && sel.data.length) jobs = sel.data;
      } catch (e) {
        console.warn('Status-based query failed, will try fallback query', String(e));
      }

      if (!jobs || jobs.length === 0) {
        try {
          // Fallback: select rows with sentinel value 'PENDING_FOR_WORKER' or null result_url
          const sel2 = await supabase
            .from('media_generations')
            .select('*')
            .in('result_url', ['PENDING_FOR_WORKER', null])
            .order('created_at', { ascending: true })
            .limit(5);
          if (!sel2.error && sel2.data && sel2.data.length) jobs = sel2.data;
        } catch (e) {
          console.error('Fallback query failed', String(e));
        }
      }
      if (jobs && jobs.length) {
        for (const job of jobs) {
          await processJob(job, supabase, runSocialTwinGeneration);
          await sleep(500); // small pause between jobs
        }
        continue; // immediately poll again
      }
    } catch (e) {
      console.error('Worker poll error', e);
    }
    await sleep(3000);
  }
}

if (require.main === module) {
  main().catch((e)=>{ console.error(e); process.exit(1); });
}
