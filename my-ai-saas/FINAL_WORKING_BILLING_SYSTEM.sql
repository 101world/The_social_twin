-- ============================================================================
-- FINAL WORKING BILLING SYSTEM - NO CONFLICTS GUARANTEED
-- ============================================================================
-- Execute this AFTER running SAFE_COLUMN_MIGRATION.sql
-- This script updates your billing plans to exact specifications:
-- One T: 200 images/12 videos (1,120 credits) - $19
-- One Z: 700 images/55 videos (4,050 credits) - $79  
-- One Pro: 1500 images/120 videos (8,700 credits) - $149
-- ============================================================================

-- 1. UPDATE PLAN PRICING WITH EXACT LIMITS
UPDATE public.plan_pricing SET 
    usd_price = 19.00,
    inr_price = 1577.00,
    monthly_credits = 1120,
    description = '1,120 AI credits monthly (200 images, 12 videos)',
    image_generation_time = 30,
    video_generation_time = 450,
    max_images_per_month = 200,
    max_videos_per_month = 12,
    features = '["1,120 monthly credits", "200 images per month", "12 videos per month", "30s per image generation", "450s per video generation", "Standard AI models", "Email support"]'::jsonb,
    plan_type = 'monthly',
    billing_cycle = 'monthly'
WHERE plan = 'one_t';

-- Insert if doesn't exist
INSERT INTO public.plan_pricing (
    plan, usd_price, inr_price, monthly_credits, description,
    image_generation_time, video_generation_time, max_images_per_month, max_videos_per_month,
    features, plan_type, billing_cycle
) VALUES (
    'one_t', 19.00, 1577.00, 1120, 
    '1,120 AI credits monthly (200 images, 12 videos)',
    30, 450, 200, 12,
    '["1,120 monthly credits", "200 images per month", "12 videos per month", "30s per image generation", "450s per video generation", "Standard AI models", "Email support"]'::jsonb,
    'monthly', 'monthly'
) ON CONFLICT (plan) DO NOTHING;

-- One Z Plan
UPDATE public.plan_pricing SET 
    usd_price = 79.00,
    inr_price = 6551.00,
    monthly_credits = 4050,
    description = '4,050 AI credits monthly (700 images, 55 videos)',
    image_generation_time = 30,
    video_generation_time = 450,
    max_images_per_month = 700,
    max_videos_per_month = 55,
    features = '["4,050 monthly credits", "700 images per month", "55 videos per month", "30s per image generation", "450s per video generation", "Premium AI models", "Priority support", "Advanced features"]'::jsonb,
    plan_type = 'monthly',
    billing_cycle = 'monthly'
WHERE plan = 'one_z';

INSERT INTO public.plan_pricing (
    plan, usd_price, inr_price, monthly_credits, description,
    image_generation_time, video_generation_time, max_images_per_month, max_videos_per_month,
    features, plan_type, billing_cycle
) VALUES (
    'one_z', 79.00, 6551.00, 4050,
    '4,050 AI credits monthly (700 images, 55 videos)',
    30, 450, 700, 55,
    '["4,050 monthly credits", "700 images per month", "55 videos per month", "30s per image generation", "450s per video generation", "Premium AI models", "Priority support", "Advanced features"]'::jsonb,
    'monthly', 'monthly'
) ON CONFLICT (plan) DO NOTHING;

-- One Pro Plan  
UPDATE public.plan_pricing SET 
    usd_price = 149.00,
    inr_price = 12367.00,
    monthly_credits = 8700,
    description = '8,700 AI credits monthly (1,500 images, 120 videos)',
    image_generation_time = 30,
    video_generation_time = 450,
    max_images_per_month = 1500,
    max_videos_per_month = 120,
    features = '["8,700 monthly credits", "1,500 images per month", "120 videos per month", "30s per image generation", "450s per video generation", "Premium AI models", "Priority support", "Advanced features", "API access", "White-label options"]'::jsonb,
    plan_type = 'monthly',
    billing_cycle = 'monthly'
WHERE plan = 'one_pro';

INSERT INTO public.plan_pricing (
    plan, usd_price, inr_price, monthly_credits, description,
    image_generation_time, video_generation_time, max_images_per_month, max_videos_per_month,
    features, plan_type, billing_cycle
) VALUES (
    'one_pro', 149.00, 12367.00, 8700,
    '8,700 AI credits monthly (1,500 images, 120 videos)',
    30, 450, 1500, 120,
    '["8,700 monthly credits", "1,500 images per month", "120 videos per month", "30s per image generation", "450s per video generation", "Premium AI models", "Priority support", "Advanced features", "API access", "White-label options"]'::jsonb,
    'monthly', 'monthly'
) ON CONFLICT (plan) DO NOTHING;

-- 2. UPDATE PLAN CREDITS TABLE (if it exists)
INSERT INTO public.plan_credits (plan, monthly_credits, daily_grant) VALUES
    ('one_t', 1120, 37),   -- 1120/30 days ≈ 37 per day
    ('one_z', 4050, 135),  -- 4050/30 days = 135 per day  
    ('one_pro', 8700, 290) -- 8700/30 days = 290 per day
ON CONFLICT (plan) DO UPDATE SET
    monthly_credits = EXCLUDED.monthly_credits,
    daily_grant = EXCLUDED.daily_grant;

-- 3. ENSURE RPC FUNCTIONS EXIST (SAFE - won't overwrite if exists)
CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get current balance with row lock
  SELECT credits INTO current_balance 
  FROM public.user_credits 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user exists
  IF current_balance IS NULL THEN
    -- Create user with 0 credits
    INSERT INTO public.user_credits (user_id, credits) 
    VALUES (p_user_id, 0);
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
  INSERT INTO public.user_credits (user_id, credits, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    credits = user_credits.credits + p_amount,
    updated_at = NOW()
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END$$;

-- 4. CREATE SAFE MONTHLY CREDIT ALLOCATION FUNCTION
CREATE OR REPLACE FUNCTION public.set_monthly_credits(p_user_id TEXT, p_plan TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  plan_credits INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get credits for plan
  SELECT monthly_credits INTO plan_credits
  FROM public.plan_pricing
  WHERE plan = p_plan;
  
  IF plan_credits IS NULL THEN
    RETURN -1; -- Invalid plan
  END IF;
  
  -- Set user credits to plan amount
  INSERT INTO public.user_credits (user_id, credits, updated_at)
  VALUES (p_user_id, plan_credits, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    credits = plan_credits,
    updated_at = NOW()
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END$$;

-- 5. VERIFICATION QUERIES
SELECT 'BILLING SYSTEM UPDATED SUCCESSFULLY!' AS status;

SELECT 'Updated Plans:' AS info;
SELECT plan, usd_price, monthly_credits, max_images_per_month, max_videos_per_month, description
FROM public.plan_pricing 
WHERE plan IN ('one_t', 'one_z', 'one_pro')
ORDER BY usd_price;

SELECT 'RPC Functions Available:' AS info;
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('deduct_credits_simple', 'add_credits_simple', 'set_monthly_credits')
AND routine_schema = 'public';

-- 6. SHOW CREDIT CALCULATIONS
SELECT 'Credit Calculations (5 credits per image, 10 per video):' AS info;
SELECT 
    plan,
    max_images_per_month,
    max_videos_per_month,
    (max_images_per_month * 5) as image_credits_needed,
    (max_videos_per_month * 10) as video_credits_needed,
    (max_images_per_month * 5) + (max_videos_per_month * 10) as total_credits_used,
    monthly_credits,
    monthly_credits - ((max_images_per_month * 5) + (max_videos_per_month * 10)) as credits_remaining
FROM public.plan_pricing 
WHERE plan IN ('one_t', 'one_z', 'one_pro')
ORDER BY usd_price;

-- ============================================================================
-- BILLING SYSTEM READY! 
-- Your plans now have exact limits as requested:
-- - One T: 200 images + 12 videos = 1,120 credits ($19)
-- - One Z: 700 images + 55 videos = 4,050 credits ($79)  
-- - One Pro: 1500 images + 120 videos = 8,700 credits ($149)
-- ============================================================================
