-- Complete database migration to fix credit system
-- Run this in Supabase SQL Editor

-- 1. Add missing column to user_credits table
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS last_daily_topup_at TIMESTAMPTZ;

-- 2. Create the missing grant_daily_credits_if_needed function
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

-- 3. Update existing user_credits records to have proper last_daily_topup_at
UPDATE public.user_credits 
SET last_daily_topup_at = updated_at 
WHERE last_daily_topup_at IS NULL;

-- 4. Grant RLS permissions (if needed)
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- 5. Create policy to allow authenticated users to read their own credits
CREATE POLICY IF NOT EXISTS "Users can view own credits" ON public.user_credits
  FOR SELECT USING (auth.uid()::text = user_id);

-- 6. Create policy to allow service role to manage all credits
CREATE POLICY IF NOT EXISTS "Service role can manage all credits" ON public.user_credits
  FOR ALL USING (true);

-- Verify the migration
SELECT 'Migration completed successfully' as status;
