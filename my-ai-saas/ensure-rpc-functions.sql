-- Ensure the deduct_credits_simple RPC function exists in production database
-- This is critical for credit deduction to work properly

-- Create user_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Create RLS policy if it doesn't exist
DO $$ BEGIN
  CREATE POLICY "user_credits_own" ON public.user_credits
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credits TO authenticated;

-- Create the critical RPC function for credit deduction
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

-- Also create add_credits_simple for completeness
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

-- Test the function exists
SELECT 'deduct_credits_simple function created successfully' as status;
