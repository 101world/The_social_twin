-- Add monthly top-up tracking and RPC to grant monthly credits once per billing cycle

BEGIN;

-- Track last monthly top-up per user
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS last_monthly_topup_at timestamptz;

-- Grant monthly credits if not yet granted in this cycle
CREATE OR REPLACE FUNCTION grant_monthly_credits_if_needed(
  p_user_id uuid,
  p_amount integer,
  p_cycle_start timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _last timestamptz;
BEGIN
  -- Lock user row for consistency
  SELECT last_monthly_topup_at INTO _last
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF _last IS NULL OR _last < p_cycle_start THEN
    UPDATE user_credits
    SET credits = p_amount,
        last_monthly_topup_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMIT;
