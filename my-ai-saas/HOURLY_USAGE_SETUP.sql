-- ====================================
-- PER-HOUR USAGE MODEL FOR ADVANCED USERS
-- Add this to your Supabase database
-- ====================================

-- 1. Create hourly_usage_sessions table
CREATE TABLE IF NOT EXISTS public.hourly_usage_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'cancelled'
    hours_charged INTEGER NOT NULL DEFAULT 1, -- Minimum 1 hour, even for partial usage
    total_cost_usd DECIMAL(6,2) NOT NULL DEFAULT 15.00, -- $15/hour
    total_cost_inr DECIMAL(8,2) NOT NULL DEFAULT 1245.00, -- ₹1245/hour (15*83)
    balance_before DECIMAL(10,2), -- Account balance before session
    balance_after DECIMAL(10,2), -- Account balance after session
    generations_count INTEGER DEFAULT 0, -- Number of AI generations in this session
    metadata JSONB, -- Store session details, pause/resume times
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create hourly_account_balance table (separate from credits)
CREATE TABLE IF NOT EXISTS public.hourly_account_balance (
    user_id TEXT PRIMARY KEY,
    balance_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    balance_inr DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_spent_usd DECIMAL(10,2) DEFAULT 0.00,
    total_spent_inr DECIMAL(12,2) DEFAULT 0.00,
    last_topup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create hourly_topup_transactions table
CREATE TABLE IF NOT EXISTS public.hourly_topup_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    amount_usd DECIMAL(6,2) NOT NULL, -- Amount in USD
    amount_inr DECIMAL(8,2) NOT NULL, -- Amount in INR
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add new plan types to plan_pricing
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
) VALUES
    (
        'one_max', 
        15.00, 
        1245.00, 
        0, 
        'ONE MAX - Unlimited AI generations at $15/hour with ultra-fast processing',
        7, -- 7 seconds per image (4x faster)
        150, -- 150 seconds (2.5 mins) per video (3x faster)
        NULL, -- Unlimited during active session
        NULL, -- Unlimited during active session
        '["Unlimited generations during session", "7s per image generation (4x faster)", "150s per video generation (3x faster)", "Premium AI models", "Priority processing", "Pause/Resume anytime", "24/7 dedicated support"]'::jsonb,
        'hourly',
        'hourly'
    ),
    (
        'hourly_topup_100', 
        100.00, 
        8300.00, 
        0, 
        'Top-up $100 for hourly usage',
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups
        '["$100 balance credit", "~6.7 hours of ONE MAX usage", "Fast processing speeds"]'::jsonb,
        'topup',
        'one-time'
    ),
    (
        'hourly_topup_200', 
        200.00, 
        16600.00, 
        0, 
        'Top-up $200 for hourly usage',
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups  
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups
        '["$200 balance credit", "~13.3 hours of ONE MAX usage", "Fast processing speeds", "Best value for power users"]'::jsonb,
        'topup',
        'one-time'
    ),
    (
        'hourly_topup_500', 
        500.00, 
        41500.00, 
        0, 
        'Top-up $500 for hourly usage',
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups
        NULL, -- Not applicable for top-ups
        '["$500 balance credit", "~33.3 hours of ONE MAX usage", "Fast processing speeds", "Enterprise level access"]'::jsonb,
        'topup',
        'one-time'
    )
ON CONFLICT (plan) DO UPDATE SET
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

-- 5. Create RPC function to start hourly session
CREATE OR REPLACE FUNCTION public.start_hourly_session(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  current_balance DECIMAL(10,2);
  session_id UUID;
  result JSON;
BEGIN
  -- Check if user has sufficient balance ($15 minimum for 1 hour)
  SELECT balance_usd INTO current_balance 
  FROM public.hourly_account_balance 
  WHERE user_id = p_user_id;
  
  -- If no account exists or insufficient balance
  IF current_balance IS NULL OR current_balance < 15.00 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient balance. Minimum $15 required to start hourly session.',
      'current_balance', COALESCE(current_balance, 0),
      'required_balance', 15.00
    );
  END IF;
  
  -- Check if user already has an active session
  IF EXISTS (
    SELECT 1 FROM public.hourly_usage_sessions 
    WHERE user_id = p_user_id AND status = 'active'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You already have an active hourly session running.'
    );
  END IF;
  
  -- Create new session
  INSERT INTO public.hourly_usage_sessions(
    user_id, 
    session_start, 
    balance_before,
    metadata
  ) VALUES (
    p_user_id, 
    NOW(), 
    current_balance,
    json_build_object('session_type', 'hourly_unlimited')
  ) RETURNING id INTO session_id;
  
  -- Deduct first hour cost immediately
  UPDATE public.hourly_account_balance 
  SET 
    balance_usd = balance_usd - 15.00,
    balance_inr = balance_inr - 1245.00,
    total_spent_usd = total_spent_usd + 15.00,
    total_spent_inr = total_spent_inr + 1245.00,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Get updated balance
  SELECT balance_usd INTO current_balance 
  FROM public.hourly_account_balance 
  WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', session_id,
    'message', 'Hourly session started! First hour charged: $15',
    'balance_before', current_balance + 15.00,
    'balance_after', current_balance,
    'hourly_rate', 15.00
  );
END$$;

-- 6. Create RPC function to pause/resume hourly session
CREATE OR REPLACE FUNCTION public.toggle_hourly_session(p_user_id TEXT, p_action TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  session_record RECORD;
  result JSON;
BEGIN
  -- Get active session
  SELECT * INTO session_record 
  FROM public.hourly_usage_sessions 
  WHERE user_id = p_user_id AND status IN ('active', 'paused')
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No active hourly session found.'
    );
  END IF;
  
  -- Handle pause
  IF p_action = 'pause' AND session_record.status = 'active' THEN
    UPDATE public.hourly_usage_sessions 
    SET 
      status = 'paused',
      metadata = COALESCE(metadata, '{}'::jsonb) || 
        json_build_object('paused_at', NOW())::jsonb,
      updated_at = NOW()
    WHERE id = session_record.id;
    
    RETURN json_build_object(
      'success', true,
      'action', 'paused',
      'session_id', session_record.id
    );
  END IF;
  
  -- Handle resume
  IF p_action = 'resume' AND session_record.status = 'paused' THEN
    UPDATE public.hourly_usage_sessions 
    SET 
      status = 'active',
      metadata = COALESCE(metadata, '{}'::jsonb) || 
        json_build_object('resumed_at', NOW())::jsonb,
      updated_at = NOW()
    WHERE id = session_record.id;
    
    RETURN json_build_object(
      'success', true,
      'action', 'resumed',
      'session_id', session_record.id
    );
  END IF;
  
  RETURN json_build_object(
    'success', false,
    'error', 'Invalid action or session state.'
  );
END$$;

-- 7. Create RPC function to end hourly session
CREATE OR REPLACE FUNCTION public.end_hourly_session(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  session_record RECORD;
  current_balance DECIMAL(10,2);
  result JSON;
BEGIN
  -- Get active session
  SELECT * INTO session_record 
  FROM public.hourly_usage_sessions 
  WHERE user_id = p_user_id AND status IN ('active', 'paused')
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No active hourly session found.'
    );
  END IF;
  
  -- Get current balance
  SELECT balance_usd INTO current_balance 
  FROM public.hourly_account_balance 
  WHERE user_id = p_user_id;
  
  -- Update session as completed
  UPDATE public.hourly_usage_sessions 
  SET 
    status = 'completed',
    session_end = NOW(),
    balance_after = current_balance,
    updated_at = NOW()
  WHERE id = session_record.id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', session_record.id,
    'total_cost_usd', session_record.total_cost_usd,
    'session_duration', EXTRACT(EPOCH FROM (NOW() - session_record.session_start))/3600,
    'balance_remaining', current_balance
  );
END$$;

-- 8. Create RPC function to add balance
CREATE OR REPLACE FUNCTION public.add_hourly_balance(
  p_user_id TEXT, 
  p_amount_usd DECIMAL(6,2),
  p_payment_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  new_balance_usd DECIMAL(10,2);
  new_balance_inr DECIMAL(12,2);
  amount_inr DECIMAL(8,2);
BEGIN
  amount_inr := p_amount_usd * 83.00; -- USD to INR conversion
  
  -- Insert or update balance
  INSERT INTO public.hourly_account_balance(
    user_id, 
    balance_usd, 
    balance_inr,
    last_topup_at,
    updated_at
  ) VALUES (
    p_user_id, 
    p_amount_usd, 
    amount_inr,
    NOW(),
    NOW()
  ) ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance_usd = hourly_account_balance.balance_usd + p_amount_usd,
    balance_inr = hourly_account_balance.balance_inr + amount_inr,
    last_topup_at = NOW(),
    updated_at = NOW()
  RETURNING balance_usd, balance_inr INTO new_balance_usd, new_balance_inr;
  
  -- Record transaction if payment ID provided
  IF p_payment_id IS NOT NULL THEN
    INSERT INTO public.hourly_topup_transactions(
      user_id,
      amount_usd,
      amount_inr,
      razorpay_payment_id,
      status
    ) VALUES (
      p_user_id,
      p_amount_usd,
      amount_inr,
      p_payment_id,
      'completed'
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'amount_added_usd', p_amount_usd,
    'amount_added_inr', amount_inr,
    'new_balance_usd', new_balance_usd,
    'new_balance_inr', new_balance_inr
  );
END$$;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hourly_sessions_user_status ON public.hourly_usage_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_hourly_sessions_active ON public.hourly_usage_sessions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_hourly_balance_user ON public.hourly_account_balance(user_id);
CREATE INDEX IF NOT EXISTS idx_hourly_topups_user ON public.hourly_topup_transactions(user_id);

-- 10. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.hourly_usage_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hourly_account_balance TO authenticated;
GRANT SELECT ON public.hourly_topup_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_hourly_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_hourly_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_hourly_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_hourly_balance TO authenticated;

-- Grant service_role permissions for webhooks
GRANT ALL ON public.hourly_usage_sessions TO service_role;
GRANT ALL ON public.hourly_account_balance TO service_role;
GRANT ALL ON public.hourly_topup_transactions TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 11. Test the setup
SELECT 'Hourly usage model setup completed!' as status;

-- Show available hourly plans
SELECT plan, usd_price, inr_price, description 
FROM public.plan_pricing 
WHERE plan LIKE 'hourly%'
ORDER BY usd_price;
