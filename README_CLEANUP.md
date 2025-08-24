Root app tree deprecated
=====================================

This repository contains two Next.js app trees:

- my-ai-saas/ — the live, supported application (source of truth)
- app/ (root) — deprecated; kept only for reference while we finish migration

To avoid accidental deploys from the root tree:

- Vercel Root Directory must be set to my-ai-saas
- Root middleware.ts now returns 410 Gone for all routes

You can safely remove the root app/ folder entirely once all references are cleared. Backend assets (supabase/, migrations, scripts) remain at repo root.
