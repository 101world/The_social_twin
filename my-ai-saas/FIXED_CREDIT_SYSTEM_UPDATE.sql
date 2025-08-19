-- ============================================================================
-- FIXED CREDIT SYSTEM UPDATE - ADD MISSING COLUMNS FIRST
-- Run this in Supabase SQL Editor to fix the column error
-- ============================================================================

-- STEP 1: Add missing columns to plan_pricing table
ALTER TABLE public.plan_pricing 
ADD COLUMN IF NOT EXISTS image_generation_time INTEGER DEFAULT 30;

ALTER TABLE public.plan_pricing 
ADD COLUMN IF NOT EXISTS video_generation_time INTEGER DEFAULT 450;

ALTER TABLE public.plan_pricing 
ADD COLUMN IF NOT EXISTS max_images_per_month INTEGER;

ALTER TABLE public.plan_pricing 
ADD COLUMN IF NOT EXISTS max_videos_per_month INTEGER;

ALTER TABLE public.plan_pricing 
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.plan_pricing 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'monthly';

ALTER TABLE public.plan_pricing 
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly';

-- STEP 2: Update plan_pricing table with new credit allocations
UPDATE public.plan_pricing SET
    monthly_credits = 1120,  -- (200 images × 5 credits) + (12 videos × 10 credits) = 1000 + 120 = 1120
    max_images_per_month = 200,
    max_videos_per_month = 12,
    image_generation_time = 30,
    video_generation_time = 450,
    features = '[
        "1,120 monthly credits", 
        "200 images per month", 
        "12 videos per month", 
        "30s per image generation", 
        "450s per video generation", 
        "Basic AI models", 
        "Email support"
    ]'::jsonb,
    plan_type = 'monthly',
    billing_cycle = 'monthly'
WHERE plan = 'one_t';

UPDATE public.plan_pricing SET
    monthly_credits = 4050,  -- (700 images × 5 credits) + (55 videos × 10 credits) = 3500 + 550 = 4050
    max_images_per_month = 700,
    max_videos_per_month = 55,
    image_generation_time = 30,
    video_generation_time = 450,
    features = '[
        "4,050 monthly credits", 
        "700 images per month", 
        "55 videos per month", 
        "30s per image generation", 
        "450s per video generation", 
        "Premium AI models", 
        "Priority support", 
        "Advanced features"
    ]'::jsonb,
    plan_type = 'monthly',
    billing_cycle = 'monthly'
WHERE plan = 'one_z';

UPDATE public.plan_pricing SET
    monthly_credits = 8700,  -- (1500 images × 5 credits) + (120 videos × 10 credits) = 7500 + 1200 = 8700
    max_images_per_month = 1500,
    max_videos_per_month = 120,
    image_generation_time = 30,
    video_generation_time = 450,
    features = '[
        "8,700 monthly credits", 
        "1,500 images per month", 
        "120 videos per month", 
        "30s per image generation", 
        "450s per video generation", 
        "Premium AI models", 
        "Priority support", 
        "Advanced features", 
        "API access", 
        "White-label options"
    ]'::jsonb,
    plan_type = 'monthly',
    billing_cycle = 'monthly'
WHERE plan = 'one_pro';

-- STEP 3: Ensure plan_credits table exists and is updated
CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan TEXT PRIMARY KEY,
  monthly_credits INTEGER NOT NULL,
  daily_grant INTEGER NOT NULL
);

-- Update or insert plan_credits data
INSERT INTO public.plan_credits (plan, monthly_credits, daily_grant) VALUES
    ('one t', 1120, 37),   -- 1120 ÷ 30 days ≈ 37 credits per day
    ('one z', 4050, 135),  -- 4050 ÷ 30 days = 135 credits per day
    ('one pro', 8700, 290) -- 8700 ÷ 30 days = 290 credits per day
ON CONFLICT (plan) DO UPDATE SET
    monthly_credits = EXCLUDED.monthly_credits,
    daily_grant = EXCLUDED.daily_grant;

-- STEP 4: Update existing users' credits to match their new plan allowances
-- Update One T users
UPDATE public.user_credits 
SET credits = 1120, updated_at = NOW()
WHERE user_id IN (
    SELECT user_id FROM public.user_billing 
    WHERE plan = 'one t' AND status = 'active'
);

-- Update One Z users  
UPDATE public.user_credits 
SET credits = 4050, updated_at = NOW()
WHERE user_id IN (
    SELECT user_id FROM public.user_billing 
    WHERE plan = 'one z' AND status = 'active'
);

-- Update One Pro users
UPDATE public.user_credits 
SET credits = 8700, updated_at = NOW()
WHERE user_id IN (
    SELECT user_id FROM public.user_billing 
    WHERE plan = 'one pro' AND status = 'active'
);

-- STEP 5: Ensure RPC functions exist for credit management
CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT credits INTO current_balance 
  FROM public.user_credits 
  WHERE user_id = p_user_id;
  
  -- If user doesn't exist, create with 0 credits
  IF current_balance IS NULL THEN
    INSERT INTO public.user_credits(user_id, credits, updated_at)
    VALUES (p_user_id, 0, NOW());
    current_balance := 0;
  END IF;
  
  -- Check if sufficient credits
  IF current_balance < p_amount THEN
    RETURN -1; -- Insufficient credits
  END IF;
  
  -- Deduct credits
  new_balance := current_balance - p_amount;
  
  UPDATE public.user_credits 
  SET credits = new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN new_balance;
END$$;

CREATE OR REPLACE FUNCTION public.add_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  new_balance INTEGER;
BEGIN
  -- Insert or update credits
  INSERT INTO public.user_credits(user_id, credits, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    credits = public.user_credits.credits + EXCLUDED.credits,
    updated_at = NOW()
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END$$;

-- STEP 6: Verify the changes
SELECT 'UPDATED PLAN PRICING:' AS verification;
SELECT 
    plan,
    monthly_credits,
    max_images_per_month,
    max_videos_per_month,
    (max_images_per_month * 5 + max_videos_per_month * 10) AS calculated_credits,
    CASE 
        WHEN monthly_credits = (max_images_per_month * 5 + max_videos_per_month * 10) 
        THEN '✅ CORRECT' 
        ELSE '❌ MISMATCH' 
    END AS credit_validation
FROM public.plan_pricing 
WHERE plan IN ('one_t', 'one_z', 'one_pro')
ORDER BY monthly_credits;

-- ============================================================================
-- SUMMARY OF CHANGES:
-- ============================================================================
-- ✅ Added missing columns to plan_pricing table
-- ✅ One T:   200 images, 12 videos  = 1,120 credits (was 10,000)
-- ✅ One Z:   700 images, 55 videos  = 4,050 credits (was 50,000) 
-- ✅ One Pro: 1,500 images, 120 videos = 8,700 credits (was 100,000)
-- ✅ Updated existing user credits to match new limits
-- ✅ Credit deduction: 5 credits/image, 10 credits/video
-- ============================================================================
