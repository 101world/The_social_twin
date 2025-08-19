-- ============================================================================
-- UPDATED CREDIT SYSTEM - FINAL VERSION
-- NEW SPECIFICATIONS: One T (200 images, 12 videos), One Z (700 images, 55 videos), One Pro (1500 images, 120 videos)
-- ============================================================================

-- STEP 1: Update plan_pricing table with new credit allocations
UPDATE public.plan_pricing SET
    monthly_credits = 1120,  -- (200 images × 5 credits) + (12 videos × 10 credits) = 1000 + 120 = 1120
    max_images_per_month = 200,
    max_videos_per_month = 12,
    features = '[
        "1,120 monthly credits", 
        "200 images per month", 
        "12 videos per month", 
        "30s per image generation", 
        "450s per video generation", 
        "Basic AI models", 
        "Email support"
    ]'::jsonb
WHERE plan = 'one_t';

UPDATE public.plan_pricing SET
    monthly_credits = 4050,  -- (700 images × 5 credits) + (55 videos × 10 credits) = 3500 + 550 = 4050
    max_images_per_month = 700,
    max_videos_per_month = 55,
    features = '[
        "4,050 monthly credits", 
        "700 images per month", 
        "55 videos per month", 
        "30s per image generation", 
        "450s per video generation", 
        "Premium AI models", 
        "Priority support", 
        "Advanced features"
    ]'::jsonb
WHERE plan = 'one_z';

UPDATE public.plan_pricing SET
    monthly_credits = 8700,  -- (1500 images × 5 credits) + (120 videos × 10 credits) = 7500 + 1200 = 8700
    max_images_per_month = 1500,
    max_videos_per_month = 120,
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
    ]'::jsonb
WHERE plan = 'one_pro';

-- STEP 2: Update plan_credits table (used for daily grants and reference)
UPDATE public.plan_credits SET
    monthly_credits = 1120,
    daily_grant = 37  -- 1120 ÷ 30 days ≈ 37 credits per day
WHERE plan = 'one t';

UPDATE public.plan_credits SET
    monthly_credits = 4050,
    daily_grant = 135  -- 4050 ÷ 30 days = 135 credits per day
WHERE plan = 'one z';

UPDATE public.plan_credits SET
    monthly_credits = 8700,
    daily_grant = 290  -- 8700 ÷ 30 days = 290 credits per day
WHERE plan = 'one pro';

-- STEP 3: Update existing users' credits to match their new plan allowances
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

-- STEP 4: Verify the changes
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

SELECT 'UPDATED PLAN CREDITS:' AS verification;
SELECT * FROM public.plan_credits WHERE plan IN ('one t', 'one z', 'one pro') ORDER BY monthly_credits;

SELECT 'USER CREDITS UPDATED:' AS verification;
SELECT 
    ub.plan,
    COUNT(*) as user_count,
    MIN(uc.credits) as min_credits,
    MAX(uc.credits) as max_credits,
    AVG(uc.credits) as avg_credits
FROM public.user_billing ub
JOIN public.user_credits uc ON ub.user_id = uc.user_id
WHERE ub.plan IN ('one t', 'one z', 'one pro') AND ub.status = 'active'
GROUP BY ub.plan
ORDER BY avg_credits;

-- STEP 5: Test credit deduction system
-- This will test if your existing credit deduction functions work with new credit amounts
SELECT 'TESTING CREDIT SYSTEM:' AS test_section;

-- Test with a sample user (replace with actual user_id if needed)
DO $$
DECLARE
    test_user_id TEXT := 'user_31COJVefTvqeXiOEb4SuFgwKHfD';
    initial_credits INTEGER;
    after_image_gen INTEGER;
    after_video_gen INTEGER;
BEGIN
    -- Get initial credits
    SELECT credits INTO initial_credits FROM public.user_credits WHERE user_id = test_user_id;
    RAISE NOTICE 'Initial credits: %', initial_credits;
    
    -- Test image generation (5 credits)
    SELECT public.deduct_credits_simple(test_user_id, 5) INTO after_image_gen;
    RAISE NOTICE 'After image generation (5 credits): %', after_image_gen;
    
    -- Test video generation (10 credits)  
    SELECT public.deduct_credits_simple(test_user_id, 10) INTO after_video_gen;
    RAISE NOTICE 'After video generation (10 credits): %', after_video_gen;
    
    -- Restore credits for testing
    PERFORM public.add_credits_simple(test_user_id, 15);
    RAISE NOTICE 'Credits restored for next test';
END $$;

-- ============================================================================
-- SUMMARY OF CHANGES:
-- ============================================================================
-- One T:   200 images, 12 videos  = 1,120 credits (was 10,000)
-- One Z:   700 images, 55 videos  = 4,050 credits (was 50,000) 
-- One Pro: 1,500 images, 120 videos = 8,700 credits (was 100,000)
--
-- This provides exact credit allocation based on your specified image/video limits
-- while maintaining the existing 5 credits/image, 10 credits/video cost structure.
-- ============================================================================
