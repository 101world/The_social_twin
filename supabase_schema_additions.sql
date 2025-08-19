-- Minimal additions to existing Supabase schema
-- Only adds missing tables without duplicating existing functionality

-- Extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Missing table: generations (for generate-with-tracking endpoint)
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT,
  result_url TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Missing table: user_billing (for subscription tracking)
CREATE TABLE IF NOT EXISTS public.user_billing (
  user_id TEXT PRIMARY KEY,
  plan TEXT,
  status TEXT,
  clerk_customer_id TEXT,
  clerk_subscription_id TEXT,
  next_billing_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Missing table: plan_credits (for plan-based daily grants)
CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan TEXT PRIMARY KEY,
  monthly_credits INTEGER NOT NULL,
  daily_grant INTEGER NOT NULL
);

-- Insert plan data
INSERT INTO public.plan_credits(plan, monthly_credits, daily_grant) VALUES
  ('free', 1500, 50),
  ('one t', 1000, 33),
  ('one s', 5000, 166),
  ('one xt', 10000, 333),
  ('one z', 50000, 1666)
ON CONFLICT (plan) DO UPDATE SET
  monthly_credits = EXCLUDED.monthly_credits,
  daily_grant = EXCLUDED.daily_grant;

-- Enable RLS on new tables
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;

-- RLS policies for new tables (using same Clerk pattern as existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generations' AND policyname = 'generations_own_clerk') THEN
        CREATE POLICY "generations_own_clerk" ON public.generations
          FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
          WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_billing' AND policyname = 'user_billing_own_clerk') THEN
        CREATE POLICY "user_billing_own_clerk" ON public.user_billing
          FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
          WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
    END IF;
END $$;

-- Grants for new tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_billing TO authenticated;
GRANT SELECT ON public.plan_credits TO authenticated;

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_generations_user ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created ON public.generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_billing_user ON public.user_billing(user_id);

-- Note: Credit RPCs already exist in the current schema, no need to recreate them
-- Note: user_credits table already exists, no need to recreate it
-- Note: All other core tables already exist and working
