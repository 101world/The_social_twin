RunPod Autoscaler helper

What this does
- Maintains a small warm pool of GPU pods (RunPod) to reduce generation latency.
- Starts pods by calling a configurable RunPod start endpoint and stops idle pods.
- Persists instance metadata to Supabase `runpod_instances` table if SUPABASE_SERVICE_ROLE_KEY is set; otherwise writes `.runpod_instances.json` locally.

Environment variables
- RUNPOD_API_KEY: RunPod API key used to call start/stop endpoints.
- RUNPOD_BASE_URL: Base URL for your RunPod control API or workflow endpoint.
- RUNPOD_START_URL: Optional full URL to POST to start a pod. If not set, RUNPOD_BASE_URL is used as-is.
- RUNPOD_STOP_URL: Optional URL used to stop pods. Defaults to RUNPOD_BASE_URL + '/stop/<id>'.
- RUNPOD_START_BODY: Optional JSON string body to send to start endpoint. Useful for sending workflow_id or template.
- RUNPOD_AUTOSCALER_POLL_SECONDS: How often to reconcile (default 20s).
- RUNPOD_IDLE_TTL_SECONDS: How long before stopping idle pods (default 300s).
- RUNPOD_WARM_POOL: Minimum number of pods to keep warm (default 1).
- RUNPOD_MAX_PODS: Maximum pods to allow (default 4).

How to run

Install dependencies if you haven't:

```powershell
npm install
```

Run locally (foreground):

```powershell
$env:RUNPOD_API_KEY = "rp-..."
$env:RUNPOD_BASE_URL = "https://api.runpod.example"
node .\my-ai-saas\scripts\runpod-autoscaler.ts
```

Notes
- This script uses a generic POST to the configured start URL — you must configure `RUNPOD_START_BODY` to match your RunPod API's expected payload.
- The script is intentionally provider-agnostic. You'll need to adapt `startRunPodInstance`/`stopRunPodInstance` to the exact RunPod API responses.
- Use SUPABASE_SERVICE_ROLE_KEY to enable writing instance metadata to your Supabase database (table `runpod_instances`). Without it, state is saved locally only.
