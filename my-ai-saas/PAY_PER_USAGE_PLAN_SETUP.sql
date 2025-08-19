-- ============================================================================
-- PAY-PER-USAGE PLAN (ONE MAX) - COMPLETE IMPLEMENTATION
-- ============================================================================
-- This adds a pay-per-usage plan alongside your monthly subscription plans
-- Users pay per generation without monthly commitments
-- ============================================================================

-- 1. ADD ONE MAX PLAN TO PLAN PRICING TABLE
INSERT INTO public.plan_pricing (
    plan, 
    usd_price, 
    inr_price, 
    monthly_credits, 
    description,
    image_generation_time,
    video_generation_time,
    max_images_per_month,
    max_videos_per_month,
    features,
    plan_type,
    billing_cycle
) VALUES (
    'one_max', 
    0.00, -- No monthly fee
    0.00, -- No monthly fee
    0, -- No monthly credits (pay per use)
    'Pay-per-use pricing: $0.20 per image, $0.50 per video',
    15, -- 15 seconds per image (faster)
    300, -- 300 seconds (5 mins) per video (faster)
    99999, -- Unlimited monthly images
    99999, -- Unlimited monthly videos
    '["Pay per generation", "No monthly commitment", "$0.20 per image", "$0.50 per video", "Ultra-fast processing", "15s per image generation", "300s per video generation", "Premium AI models", "Priority support", "API access", "Unlimited usage"]'::jsonb,
    'usage', -- Usage-based plan
    'per-use' -- Per-use billing
) ON CONFLICT (plan) DO UPDATE SET
    usd_price = EXCLUDED.usd_price,
    inr_price = EXCLUDED.inr_price,
    monthly_credits = EXCLUDED.monthly_credits,
    description = EXCLUDED.description,
    image_generation_time = EXCLUDED.image_generation_time,
    video_generation_time = EXCLUDED.video_generation_time,
    max_images_per_month = EXCLUDED.max_images_per_month,
    max_videos_per_month = EXCLUDED.max_videos_per_month,
    features = EXCLUDED.features,
    plan_type = EXCLUDED.plan_type,
    billing_cycle = EXCLUDED.billing_cycle;

-- 2. CREATE USER BALANCE TABLE FOR PAY-PER-USE
CREATE TABLE IF NOT EXISTS public.user_balance (
    user_id TEXT PRIMARY KEY,
    balance_usd DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    balance_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    minimum_balance_usd DECIMAL(10,4) NOT NULL DEFAULT 5.0000, -- $5 minimum
    last_topup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for user_balance
ALTER TABLE public.user_balance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_balance
CREATE POLICY "Users can view own balance" ON public.user_balance
  FOR SELECT USING (
    user_id = (
      SELECT COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        current_setting('request.jwt.claims', true)::json->>'user_id'
      )
    )
  );

CREATE POLICY "Service role can manage all balances" ON public.user_balance
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_balance TO authenticated;
GRANT ALL ON public.user_balance TO service_role;

-- 3. CREATE USAGE CHARGES TABLE
CREATE TABLE IF NOT EXISTS public.usage_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    generation_type TEXT NOT NULL, -- 'image', 'video', 'text'
    cost_usd DECIMAL(6,4) NOT NULL,
    cost_inr DECIMAL(8,2) NOT NULL,
    generation_id TEXT, -- Reference to the actual generation
    description TEXT,
    charged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for usage_charges
ALTER TABLE public.usage_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usage_charges
CREATE POLICY "Users can view own charges" ON public.usage_charges
  FOR SELECT USING (
    user_id = (
      SELECT COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        current_setting('request.jwt.claims', true)::json->>'user_id'
      )
    )
  );

CREATE POLICY "Service role can manage all charges" ON public.usage_charges
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT ON public.usage_charges TO authenticated;
GRANT ALL ON public.usage_charges TO service_role;

-- 4. CREATE PAY-PER-USE PRICING FUNCTION
CREATE OR REPLACE FUNCTION public.charge_for_generation(
    p_user_id TEXT,
    p_generation_type TEXT,
    p_generation_id TEXT DEFAULT NULL
) RETURNS TABLE(
    success BOOLEAN,
    new_balance_usd DECIMAL(10,4),
    cost_charged_usd DECIMAL(6,4),
    error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_balance DECIMAL(10,4);
    v_cost_usd DECIMAL(6,4);
    v_cost_inr DECIMAL(8,2);
    v_new_balance DECIMAL(10,4);
    v_min_balance DECIMAL(10,4);
BEGIN
    -- Define per-generation costs (in USD)
    CASE p_generation_type
        WHEN 'image' THEN v_cost_usd := 0.20; -- $0.20 per image
        WHEN 'video' THEN v_cost_usd := 0.50; -- $0.50 per video  
        WHEN 'text' THEN v_cost_usd := 0.01;  -- $0.01 per text
        ELSE 
            RETURN QUERY SELECT FALSE, 0.0000::DECIMAL(10,4), 0.0000::DECIMAL(6,4), 'Invalid generation type'::TEXT;
            RETURN;
    END CASE;
    
    -- Convert to INR (1 USD = 83 INR)
    v_cost_inr := v_cost_usd * 83;
    
    -- Get current balance with row lock
    SELECT balance_usd, minimum_balance_usd 
    INTO v_current_balance, v_min_balance
    FROM public.user_balance 
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Create balance record if doesn't exist
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_balance (user_id, balance_usd, balance_inr)
        VALUES (p_user_id, 0.0000, 0.00);
        v_current_balance := 0.0000;
        v_min_balance := 5.0000;
    END IF;
    
    -- Check if sufficient balance
    IF v_current_balance < v_cost_usd THEN
        RETURN QUERY SELECT FALSE, v_current_balance, v_cost_usd, 
            'Insufficient balance. Please add funds to continue.'::TEXT;
        RETURN;
    END IF;
    
    -- Deduct cost from balance
    v_new_balance := v_current_balance - v_cost_usd;
    
    UPDATE public.user_balance 
    SET 
        balance_usd = v_new_balance,
        balance_inr = v_new_balance * 83,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Record the charge
    INSERT INTO public.usage_charges (
        user_id, generation_type, cost_usd, cost_inr, 
        generation_id, description
    ) VALUES (
        p_user_id, p_generation_type, v_cost_usd, v_cost_inr,
        p_generation_id, 
        CASE p_generation_type
            WHEN 'image' THEN 'Image generation - $0.20'
            WHEN 'video' THEN 'Video generation - $0.50'
            WHEN 'text' THEN 'Text generation - $0.01'
        END
    );
    
    RETURN QUERY SELECT TRUE, v_new_balance, v_cost_usd, NULL::TEXT;
END$$;

-- 5. CREATE BALANCE TOP-UP FUNCTION
CREATE OR REPLACE FUNCTION public.add_balance(
    p_user_id TEXT,
    p_amount_usd DECIMAL(10,4)
) RETURNS TABLE(
    success BOOLEAN,
    new_balance_usd DECIMAL(10,4),
    amount_added_usd DECIMAL(10,4)
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_balance DECIMAL(10,4);
    v_new_balance DECIMAL(10,4);
    v_amount_inr DECIMAL(10,2);
BEGIN
    -- Convert USD to INR
    v_amount_inr := p_amount_usd * 83;
    
    -- Get current balance or create record
    SELECT balance_usd INTO v_current_balance
    FROM public.user_balance 
    WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        -- Create new balance record
        INSERT INTO public.user_balance (
            user_id, balance_usd, balance_inr, last_topup_at, updated_at
        ) VALUES (
            p_user_id, p_amount_usd, v_amount_inr, NOW(), NOW()
        );
        v_new_balance := p_amount_usd;
    ELSE
        -- Update existing balance
        v_new_balance := v_current_balance + p_amount_usd;
        UPDATE public.user_balance 
        SET 
            balance_usd = v_new_balance,
            balance_inr = v_new_balance * 83,
            last_topup_at = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;
    
    RETURN QUERY SELECT TRUE, v_new_balance, p_amount_usd;
END$$;

-- 6. CREATE FUNCTION TO GET USER BALANCE INFO
CREATE OR REPLACE FUNCTION public.get_user_balance_info(p_user_id TEXT)
RETURNS TABLE(
    balance_usd DECIMAL(10,4),
    balance_inr DECIMAL(10,2),
    minimum_balance_usd DECIMAL(10,4),
    needs_topup BOOLEAN,
    total_spent_this_month_usd DECIMAL(10,4),
    generations_this_month INTEGER
) LANGUAGE sql STABLE AS $$
    SELECT 
        COALESCE(ub.balance_usd, 0.0000) as balance_usd,
        COALESCE(ub.balance_inr, 0.00) as balance_inr,
        COALESCE(ub.minimum_balance_usd, 5.0000) as minimum_balance_usd,
        COALESCE(ub.balance_usd, 0.0000) < COALESCE(ub.minimum_balance_usd, 5.0000) as needs_topup,
        COALESCE(monthly_spend.total_spent, 0.0000) as total_spent_this_month_usd,
        COALESCE(monthly_spend.generation_count, 0) as generations_this_month
    FROM public.user_balance ub
    LEFT JOIN (
        SELECT 
            user_id,
            SUM(cost_usd) as total_spent,
            COUNT(*) as generation_count
        FROM public.usage_charges 
        WHERE user_id = p_user_id
            AND charged_at >= date_trunc('month', NOW())
        GROUP BY user_id
    ) monthly_spend ON monthly_spend.user_id = ub.user_id
    WHERE ub.user_id = p_user_id;
$$;

-- 7. UPDATE PLAN CREDITS TABLE FOR ONE MAX
INSERT INTO public.plan_credits (plan, monthly_credits, daily_grant) VALUES
    ('one_max', 0, 0) -- No credits, pay per use
ON CONFLICT (plan) DO UPDATE SET
    monthly_credits = EXCLUDED.monthly_credits,
    daily_grant = EXCLUDED.daily_grant;

-- 8. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_user_balance_user_id ON public.user_balance(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_charges_user_id ON public.usage_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_charges_charged_at ON public.usage_charges(charged_at);
CREATE INDEX IF NOT EXISTS idx_usage_charges_user_month ON public.usage_charges(user_id, charged_at) 
    WHERE charged_at >= date_trunc('month', NOW());

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

SELECT 'PAY-PER-USE PLAN SETUP COMPLETE!' AS status;

-- Show updated plans
SELECT 'Updated Plans:' AS info;
SELECT plan, usd_price, monthly_credits, plan_type, billing_cycle, description
FROM public.plan_pricing 
ORDER BY CASE 
    WHEN plan_type = 'usage' THEN 1 
    ELSE 2 
END, usd_price;

-- Show pricing structure
SELECT 'Pay-Per-Use Pricing:' AS info;
SELECT 
    'Image Generation' as service,
    '$0.20 USD' as cost_usd,
    '₹16.60 INR' as cost_inr,
    '15 seconds' as processing_time;
    
SELECT 
    'Video Generation' as service,
    '$0.50 USD' as cost_usd,
    '₹41.50 INR' as cost_inr,
    '300 seconds' as processing_time;

-- Show functions created
SELECT 'Functions Created:' AS info;
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('charge_for_generation', 'add_balance', 'get_user_balance_info')
AND routine_schema = 'public';

-- ============================================================================
-- READY FOR USE!
-- 
-- How it works:
-- 1. Users choose ONE MAX plan (no monthly fee)
-- 2. They add balance to their account ($5 minimum)
-- 3. Each generation charges their balance:
--    - Images: $0.20 each (₹16.60)
--    - Videos: $0.50 each (₹41.50)
--    - Text: $0.01 each (₹0.83)
-- 4. Users can top up anytime
-- 5. Faster processing than monthly plans
-- ============================================================================
