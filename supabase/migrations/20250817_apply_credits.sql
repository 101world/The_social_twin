-- Migration: apply credits + billing schema and RPCs
-- Safe to run multiple times; uses IF NOT EXISTS and upserts where possible

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- user_billing: track plan/status from Clerk/Razorpay webhooks
CREATE TABLE IF NOT EXISTS public.user_billing (
  user_id TEXT PRIMARY KEY,
  plan TEXT,
  status TEXT,
  clerk_customer_id TEXT,
  clerk_subscription_id TEXT,
  next_billing_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "user_billing_own" ON public.user_billing
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_billing TO authenticated;

-- user_credits: per-user credit balance with last daily topup timestamp
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_daily_topup_at TIMESTAMPTZ
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "user_credits_own" ON public.user_credits
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credits TO authenticated;

-- Optional: plan -> monthly/daily credits map (for reference or future RPCs)
CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan TEXT PRIMARY KEY,
  monthly_credits INTEGER NOT NULL,
  daily_grant INTEGER NOT NULL
);

INSERT INTO public.plan_credits(plan, monthly_credits, daily_grant) VALUES
  ('free', 1500, 50),
  ('one t', 1000, 33),
  ('one s', 5000, 166),
  ('one xt', 10000, 333),
  ('one z', 50000, 1666)
ON CONFLICT (plan) DO UPDATE SET
  monthly_credits = EXCLUDED.monthly_credits,
  daily_grant = EXCLUDED.daily_grant;

-- Atomic RPC: add credits
CREATE OR REPLACE FUNCTION public.add_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE new_balance INTEGER;
BEGIN
  INSERT INTO public.user_credits(user_id, credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET credits = public.user_credits.credits + EXCLUDED.credits,
                                      updated_at = NOW()
  RETURNING credits INTO new_balance;
  RETURN new_balance;
END$$;

-- Atomic RPC: deduct credits if sufficient, return NULL if insufficient
CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE public.user_credits
  SET credits = credits - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND credits >= p_amount
  RETURNING credits INTO new_balance;

  IF NOT FOUND THEN
    RETURN NULL; -- insufficient credits or no row
  END IF;

  RETURN new_balance;
END$$;

-- Daily grant: add p_amount once per calendar day
CREATE OR REPLACE FUNCTION public.grant_daily_credits_if_needed(p_user_id TEXT, p_amount INTEGER)
RETURNS TABLE(granted BOOLEAN, new_balance INTEGER, last_grant_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE last_ts TIMESTAMPTZ;
BEGIN
  -- Ensure row exists
  INSERT INTO public.user_credits(user_id, credits, updated_at, last_daily_topup_at)
  VALUES (p_user_id, 0, NOW(), NULL)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_daily_topup_at INTO last_ts
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF last_ts IS NULL OR last_ts::date < CURRENT_DATE THEN
    UPDATE public.user_credits
    SET credits = credits + p_amount,
        updated_at = NOW(),
        last_daily_topup_at = NOW()
    WHERE user_id = p_user_id
    RETURNING credits, last_daily_topup_at INTO new_balance, last_grant_at;
    RETURN QUERY SELECT TRUE, new_balance, last_grant_at;
  ELSE
    SELECT credits, last_daily_topup_at INTO new_balance, last_grant_at
    FROM public.user_credits WHERE user_id = p_user_id;
    RETURN QUERY SELECT FALSE, new_balance, last_grant_at;
  END IF;
END$$;

-- REMOVED: Stripe integration (using Razorpay instead)
-- CREATE TABLE IF NOT EXISTS public.stripe_price_to_credits (
  price_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL
);
