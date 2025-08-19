-- Enhanced Razorpay Monthly Subscription Schema
-- Add this to your Supabase SQL Editor

-- 1. Add subscription fields to user_billing table
ALTER TABLE public.user_billing 
ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT,
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ;

-- 2. Add subscription tracking to user_payments table  
ALTER TABLE public.user_payments
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_id TEXT;

-- 3. Create monthly credit management function
CREATE OR REPLACE FUNCTION public.set_monthly_credits(p_user_id TEXT, p_credits INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  new_balance INTEGER;
BEGIN
  -- Set user credits to exact monthly allowance (replace, don't add)
  INSERT INTO public.user_credits(user_id, credits, updated_at)
  VALUES (p_user_id, p_credits, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    credits = p_credits,
    updated_at = NOW()
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END$$;

-- 4. Create function to get user's current plan info
CREATE OR REPLACE FUNCTION public.get_user_subscription_info(p_user_id TEXT)
RETURNS TABLE(
  plan TEXT,
  status TEXT,
  monthly_credits INTEGER,
  current_credits INTEGER,
  next_billing_at TIMESTAMPTZ,
  subscription_active BOOLEAN
)
LANGUAGE sql
STABLE AS $$
  SELECT 
    ub.plan,
    ub.status,
    pc.monthly_credits,
    uc.credits as current_credits,
    ub.next_billing_at,
    (ub.status = 'active') as subscription_active
  FROM public.user_billing ub
  LEFT JOIN public.plan_credits pc ON pc.plan = ub.plan
  LEFT JOIN public.user_credits uc ON uc.user_id = ub.user_id
  WHERE ub.user_id = p_user_id;
$$;

-- 5. Update plan_credits with INR pricing info
CREATE TABLE IF NOT EXISTS public.plan_pricing (
  plan TEXT PRIMARY KEY,
  usd_price DECIMAL(6,2) NOT NULL,
  inr_price DECIMAL(8,2) NOT NULL,
  monthly_credits INTEGER NOT NULL,
  description TEXT
);

INSERT INTO public.plan_pricing (plan, usd_price, inr_price, monthly_credits, description) VALUES
  ('one_t', 19.00, 1577.00, 10000, '10,000 AI credits monthly'),
  ('one_z', 79.00, 6557.00, 50000, '50,000 AI credits monthly'),
  ('one_pro', 149.00, 12367.00, 100000, '100,000 AI credits monthly')
ON CONFLICT (plan) DO UPDATE SET
  usd_price = EXCLUDED.usd_price,
  inr_price = EXCLUDED.inr_price,
  monthly_credits = EXCLUDED.monthly_credits,
  description = EXCLUDED.description;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_billing_subscription_id ON public.user_billing(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_subscription_id ON public.user_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_status ON public.user_billing(status);

-- 7. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.plan_pricing TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_monthly_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_info TO authenticated;

-- 8. Test the functions
SELECT 'Monthly credit functions created successfully' as status;
