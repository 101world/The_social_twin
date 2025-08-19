-- Update subscription plans to new pricing model
-- Remove free tier and old plans, keep only: one t, one z, one pro

BEGIN;

-- 1) Remove old plan data and add new plans
DELETE FROM public.plan_generation_allowances 
WHERE plan IN ('free', 'one s', 'one xt');

-- 2) Update existing plans and add new ones
INSERT INTO public.plan_generation_allowances(plan, type, daily_count, monthly_count, daily_minutes, monthly_minutes) VALUES
  -- One T Plan ($19 - 10,000 credits)
  ('one t', 'text',  333,  10000, 0,   0),  -- 10k text generations
  ('one t', 'image',  33,   1000,  0,   0),  -- 2k image generations (5 credits each)
  ('one t', 'video',   1,     50,  0,   0),  -- 1k video generations (10 credits each)
  
  -- One Z Plan ($79 - 50,000 credits) - UNCHANGED
  ('one z', 'text', 1666,  50000, 0,   0),  -- 50k text generations
  ('one z', 'image', 333,  10000, 0,   0),  -- 10k image generations
  ('one z', 'video',  166,   5000, 0,   0),  -- 5k video generations
  
  -- One Pro Plan ($149 - 100,000 credits) - NEW
  ('one pro', 'text', 3333, 100000, 0,   0), -- 100k text generations
  ('one pro', 'image', 666,  20000, 0,   0), -- 20k image generations  
  ('one pro', 'video',  333,  10000, 0,   0)  -- 10k video generations
ON CONFLICT (plan, type) DO UPDATE SET
  daily_count = EXCLUDED.daily_count,
  monthly_count = EXCLUDED.monthly_count,
  daily_minutes = EXCLUDED.daily_minutes,
  monthly_minutes = EXCLUDED.monthly_minutes;

-- 3) Update plan_credits table if it exists
DELETE FROM public.plan_credits 
WHERE plan IN ('free', 'one s', 'one xt');

INSERT INTO public.plan_credits(plan, monthly_credits, daily_grant) VALUES
  ('one t', 10000, 333),     -- $19 plan
  ('one z', 50000, 1666),    -- $79 plan (unchanged)
  ('one pro', 100000, 3333)  -- $149 plan
ON CONFLICT (plan) DO UPDATE SET
  monthly_credits = EXCLUDED.monthly_credits,
  daily_grant = EXCLUDED.daily_grant;

-- 4) Update get_user_plan function to not default to 'free'
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE AS $$
  SELECT LOWER(plan)
  FROM public.user_billing
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

-- 5) Update any existing users with old plans to null (require re-subscription)
UPDATE public.user_billing 
SET plan = NULL, status = 'inactive', updated_at = now()
WHERE plan IN ('free', 'one s', 'one xt');

-- 6) Reset credits for users without valid plans
UPDATE public.user_credits 
SET credits = 0, updated_at = now()
WHERE user_id IN (
  SELECT user_id FROM public.user_billing 
  WHERE plan IS NULL OR plan NOT IN ('one t', 'one z', 'one pro')
);

COMMIT;
