Generation worker

What this does

- Polls the Supabase `media_generations` table for rows with status='pending'.
- For each job it marks it 'processing', calls the existing Social Twin runtime to run the workflow on RunPod, downloads results, uploads them to Supabase storage, and updates the DB row with result URL and status.

How to run

- Ensure env vars are set in your environment:
  - RUNPOD_API_KEY - RunPod API key
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (or the project service role key) - required for storage uploads and admin queries
  - NEXT_PUBLIC_RUNPOD_IMAGE_URL (optional if stored in generation_params)

- Run with node (recommended to use ts-node if TypeScript):
  - npx ts-node ./scripts/generation-worker.ts
  - or compile to JS and run with node

Notes

- This is a simple single-process worker. For production use, run it under a process manager (PM2, systemd) or containerize it.
- Concurrency control, retries, backoff, and better error handling should be added for production.
- Ensure the service role key is kept secret.
