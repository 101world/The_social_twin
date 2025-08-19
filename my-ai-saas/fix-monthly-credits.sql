-- Create the missing monthly credits RPC function
CREATE OR REPLACE FUNCTION public.grant_monthly_credits_if_needed(
  p_user_id TEXT,
  p_amount INTEGER,
  p_cycle_start TIMESTAMPTZ
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_grant_date TIMESTAMPTZ;
  current_cycle_start TIMESTAMPTZ;
BEGIN
  -- Get current cycle start (beginning of current month)
  current_cycle_start := p_cycle_start;
  
  -- Check if user already received credits for this cycle
  SELECT last_monthly_topup_at INTO last_grant_date
  FROM user_credits 
  WHERE user_id = p_user_id;
  
  -- If no previous grant or last grant was before current cycle, grant credits
  IF last_grant_date IS NULL OR last_grant_date < current_cycle_start THEN
    -- Upsert user credits with monthly amount
    INSERT INTO user_credits (user_id, credits, last_monthly_topup_at, updated_at)
    VALUES (p_user_id, p_amount, NOW(), NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      credits = p_amount,
      last_monthly_topup_at = NOW(),
      updated_at = NOW();
      
    RAISE NOTICE 'Granted % monthly credits to user %', p_amount, p_user_id;
  ELSE
    RAISE NOTICE 'User % already received credits for current cycle', p_user_id;
  END IF;
END;
$$;

-- Also ensure the last_monthly_topup_at column exists
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS last_monthly_topup_at TIMESTAMPTZ;
