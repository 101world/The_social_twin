-- Adds missing last_daily_topup_at column to user_credits if it doesn't exist
-- Safe to run multiple times
BEGIN;

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS last_daily_topup_at timestamptz;

-- Optional: backfill updated_at if missing, and set last_daily_topup_at to updated_at when NULL
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.user_credits
   SET last_daily_topup_at = COALESCE(last_daily_topup_at, updated_at)
 WHERE last_daily_topup_at IS NULL;

COMMIT;
