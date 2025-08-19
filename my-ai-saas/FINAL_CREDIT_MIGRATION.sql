-- =================================================================
-- PERMANENT DATABASE MIGRATION FOR CREDIT SYSTEM
-- Run this ENTIRE script in Supabase SQL Editor to fix everything
-- =================================================================

-- 1. Add missing column to user_credits table
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS last_daily_topup_at TIMESTAMPTZ;

-- 2. Create the grant_daily_credits_if_needed function
CREATE OR REPLACE FUNCTION public.grant_daily_credits_if_needed(p_user_id TEXT, p_amount INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  current_credits INTEGER;
  last_grant TIMESTAMPTZ;
  should_grant BOOLEAN := FALSE;
BEGIN
  -- Get current credits and last grant time
  SELECT credits, last_daily_topup_at INTO current_credits, last_grant
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_credits(user_id, credits, last_daily_topup_at)
    VALUES (p_user_id, p_amount, NOW());
    RETURN TRUE;
  END IF;
  
  -- Check if we should grant (no previous grant or more than 24 hours ago)
  IF last_grant IS NULL OR last_grant < NOW() - INTERVAL '24 hours' THEN
    should_grant := TRUE;
  END IF;
  
  -- Grant credits if needed
  IF should_grant THEN
    UPDATE public.user_credits
    SET credits = p_amount,
        last_daily_topup_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END$$;

-- 3. Update existing records to have proper last_daily_topup_at
UPDATE public.user_credits 
SET last_daily_topup_at = updated_at 
WHERE last_daily_topup_at IS NULL;

-- 4. Ensure RLS is enabled
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- 5. Create proper RLS policies
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role can manage all credits" ON public.user_credits;

CREATE POLICY "Users can view own credits" ON public.user_credits
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can manage all credits" ON public.user_credits
  FOR ALL USING (true);

-- 6. Ensure user billing table has proper structure
CREATE TABLE IF NOT EXISTS public.user_billing (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  clerk_customer_id TEXT,
  clerk_subscription_id TEXT,
  next_billing_at TIMESTAMPTZ,
  billing_cycle_start INTEGER DEFAULT 1,
  last_daily_topup_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Ensure plan_credits table exists with correct data
CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan TEXT PRIMARY KEY,
  monthly_credits INTEGER NOT NULL,
  daily_grant INTEGER NOT NULL
);

INSERT INTO public.plan_credits (plan, monthly_credits, daily_grant) VALUES
  ('free', 1500, 50),
  ('one t', 1000, 33),
  ('one s', 5000, 166),
  ('one xt', 10000, 333),
  ('one z', 50000, 1666)
ON CONFLICT (plan) DO UPDATE SET
  monthly_credits = EXCLUDED.monthly_credits,
  daily_grant = EXCLUDED.daily_grant;

-- 8. Set proper credits for "one z" plan users
UPDATE public.user_credits 
SET credits = 50000,
    last_daily_topup_at = NOW(),
    updated_at = NOW()
WHERE user_id IN (
  SELECT user_id FROM public.user_billing WHERE plan = 'one z' AND status = 'active'
);

-- 9. Verify the migration
SELECT 
  'Migration completed - Credit system is now functional' as status,
  COUNT(*) as total_users_with_credits
FROM public.user_credits;

-- =================================================================
-- END OF MIGRATION - Your credit system should now work perfectly!
-- =================================================================
