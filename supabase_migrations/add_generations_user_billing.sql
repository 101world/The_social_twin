-- Migration: Add generations, user_billing and processed_webhooks tables

-- Generations table: record text/image/video generations
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'text' | 'image' | 'video'
  prompt TEXT,
  result_url TEXT,
  content TEXT,
  posted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ
);

-- Simple user_billing table to track subscription status (Clerk)
CREATE TABLE IF NOT EXISTS public.user_billing (
  user_id TEXT PRIMARY KEY,
  plan TEXT,
  status TEXT,
  clerk_customer_id TEXT,
  clerk_subscription_id TEXT,
  next_billing_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processed webhooks table for idempotency
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id TEXT PRIMARY KEY,
  source TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grants and indexes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_billing TO authenticated;

CREATE INDEX IF NOT EXISTS idx_generations_user ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_type ON public.generations(type);

-- Note: If your Supabase project requires RLS, add appropriate policies to restrict access by current JWT claims.
