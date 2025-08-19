-- ============================================================================
-- COMPLETE SUPABASE SETUP - EVERYTHING YOUR APP NEEDS
-- This creates ALL tables for: Chat + Billing + Media + Credits + Razorpay
-- User → Clerk → Supabase → Razorpay → Credits → Chat History → Everything!
-- ============================================================================

-- Extensions needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE CHAT SYSTEM TABLES (Your app foundation)
-- ============================================================================

-- Chat topics (conversation organization)
CREATE TABLE IF NOT EXISTS public.chat_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat messages (individual messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES public.chat_topics(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media generations (AI generated content)
CREATE TABLE IF NOT EXISTS public.media_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES public.chat_topics(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'image-modify', 'text')),
  prompt TEXT,
  result_url TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  generation_params JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Projects (saved chat conversations)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  data JSONB NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CREDIT SYSTEM TABLES
-- ============================================================================

-- User credits (current balance)
CREATE TABLE IF NOT EXISTS public.user_credits (
    user_id TEXT PRIMARY KEY,
    credits INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_daily_topup_at TIMESTAMPTZ
);

-- ============================================================================
-- 3. BILLING SYSTEM TABLES (Razorpay integration)
-- ============================================================================

-- User billing (subscription management)
CREATE TABLE IF NOT EXISTS public.user_billing (
    user_id TEXT PRIMARY KEY,
    plan TEXT,
    status TEXT DEFAULT 'inactive',
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    razorpay_plan_id TEXT,
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'INR',
    next_billing_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment history
CREATE TABLE IF NOT EXISTS public.user_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    payment_id TEXT,
    subscription_id TEXT,
    plan_id TEXT,
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'INR',
    status TEXT,
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    razorpay_signature TEXT,
    credits_granted INTEGER DEFAULT 0,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan pricing (your subscription plans)
CREATE TABLE IF NOT EXISTS public.plan_pricing (
    plan TEXT PRIMARY KEY,
    usd_price DECIMAL(6,2) NOT NULL,
    inr_price DECIMAL(8,2) NOT NULL,
    monthly_credits INTEGER NOT NULL,
    description TEXT,
    image_generation_time INTEGER DEFAULT 30,
    video_generation_time INTEGER DEFAULT 450,
    max_images_per_month INTEGER,
    max_videos_per_month INTEGER,
    features JSONB DEFAULT '[]'::jsonb,
    plan_type TEXT DEFAULT 'monthly',
    billing_cycle TEXT DEFAULT 'monthly'
);

-- Plan credits lookup (for daily grants)
CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan TEXT PRIMARY KEY,
  monthly_credits INTEGER NOT NULL,
  daily_grant INTEGER NOT NULL
);

-- Webhook tracking (prevent duplicates)
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. HOURLY BILLING SYSTEM TABLES (ONE MAX)
-- ============================================================================

-- Hourly usage sessions
CREATE TABLE IF NOT EXISTS public.hourly_usage_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_start TIMESTAMPTZ DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    hourly_rate DECIMAL(6,2) DEFAULT 15.00,
    total_cost DECIMAL(8,2) DEFAULT 0,
    balance_before DECIMAL(8,2),
    balance_after DECIMAL(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly usage events
CREATE TABLE IF NOT EXISTS public.hourly_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.hourly_usage_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('start', 'pause', 'resume', 'end', 'generation')),
    generation_type TEXT CHECK (generation_type IN ('image', 'video', 'text')),
    generation_count INTEGER DEFAULT 0,
    hourly_cost DECIMAL(6,2) DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly user balances
CREATE TABLE IF NOT EXISTS public.hourly_user_balances (
    user_id TEXT PRIMARY KEY,
    balance DECIMAL(8,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. INSERT YOUR PLAN DATA
-- ============================================================================

-- Insert your exact plan specifications
INSERT INTO public.plan_pricing (
    plan, usd_price, inr_price, monthly_credits, description,
    image_generation_time, video_generation_time, max_images_per_month, max_videos_per_month,
    features, plan_type, billing_cycle
) VALUES
    (
        'one_t', 19.00, 1577.00, 1120, 
        '1,120 AI credits monthly (200 images, 12 videos)',
        30, 450, 200, 12,
        '["1,120 monthly credits", "200 images per month", "12 videos per month", "30s per image generation", "450s per video generation", "Basic AI models", "Email support"]'::jsonb,
        'monthly', 'monthly'
    ),
    (
        'one_z', 79.00, 6557.00, 4050, 
        '4,050 AI credits monthly (700 images, 55 videos)',
        30, 450, 700, 55,
        '["4,050 monthly credits", "700 images per month", "55 videos per month", "30s per image generation", "450s per video generation", "Premium AI models", "Priority support", "Advanced features"]'::jsonb,
        'monthly', 'monthly'
    ),
    (
        'one_pro', 149.00, 12367.00, 8700, 
        '8,700 AI credits monthly (1,500 images, 120 videos)',
        30, 450, 1500, 120,
        '["8,700 monthly credits", "1,500 images per month", "120 videos per month", "30s per image generation", "450s per video generation", "Premium AI models", "Priority support", "Advanced features", "API access", "White-label options"]'::jsonb,
        'monthly', 'monthly'
    ),
    (
        'one_max', 15.00, 1245.00, 0, 
        'Unlimited generations at $15/hour with ultra-fast processing',
        7, 150, 999999, 999999,
        '["Unlimited generations", "Ultra-fast: 7s per image", "Ultra-fast: 150s per video", "4x faster than monthly plans", "Premium AI models", "Priority support", "Session pause/resume", "Minimum $100 balance"]'::jsonb,
        'hourly', 'hourly'
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

-- Insert plan credits data
INSERT INTO public.plan_credits (plan, monthly_credits, daily_grant) VALUES
    ('one t', 1120, 37),
    ('one z', 4050, 135),
    ('one pro', 8700, 290)
ON CONFLICT (plan) DO UPDATE SET
    monthly_credits = EXCLUDED.monthly_credits,
    daily_grant = EXCLUDED.daily_grant;

-- ============================================================================
-- 6. ESSENTIAL RPC FUNCTIONS
-- ============================================================================

-- Deduct credits (for generations)
CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  SELECT credits INTO current_balance 
  FROM public.user_credits 
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL THEN
    INSERT INTO public.user_credits(user_id, credits, updated_at)
    VALUES (p_user_id, 0, NOW());
    current_balance := 0;
  END IF;
  
  IF current_balance < p_amount THEN
    RETURN -1; -- Insufficient credits
  END IF;
  
  new_balance := current_balance - p_amount;
  
  UPDATE public.user_credits 
  SET credits = new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN new_balance;
END$$;

-- Add credits (for payments)
CREATE OR REPLACE FUNCTION public.add_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  new_balance INTEGER;
BEGIN
  INSERT INTO public.user_credits(user_id, credits, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    credits = public.user_credits.credits + EXCLUDED.credits,
    updated_at = NOW()
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END$$;

-- Set monthly credits (for subscriptions)
CREATE OR REPLACE FUNCTION public.set_monthly_credits(p_user_id TEXT, p_credits INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE 
  new_balance INTEGER;
BEGIN
  INSERT INTO public.user_credits(user_id, credits, updated_at)
  VALUES (p_user_id, p_credits, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    credits = p_credits,
    updated_at = NOW()
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END$$;

-- Get user subscription info
CREATE OR REPLACE FUNCTION public.get_user_subscription_info(p_user_id TEXT)
RETURNS TABLE(
  plan TEXT,
  status TEXT,
  monthly_credits INTEGER,
  current_credits INTEGER,
  next_billing_at TIMESTAMPTZ,
  subscription_active BOOLEAN,
  razorpay_subscription_id TEXT
)
LANGUAGE sql
STABLE AS $$
  SELECT 
    ub.plan,
    ub.status,
    pp.monthly_credits,
    uc.credits as current_credits,
    ub.next_billing_at,
    (ub.status = 'active') as subscription_active,
    ub.razorpay_subscription_id
  FROM public.user_billing ub
  LEFT JOIN public.plan_pricing pp ON pp.plan = ub.plan
  LEFT JOIN public.user_credits uc ON uc.user_id = ub.user_id
  WHERE ub.user_id = p_user_id;
$$;

-- ============================================================================
-- 7. HOURLY BILLING FUNCTIONS
-- ============================================================================

-- Start hourly session
CREATE OR REPLACE FUNCTION public.start_hourly_session(p_user_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  session_id UUID;
  current_balance DECIMAL(8,2);
BEGIN
  -- Check minimum balance ($100)
  SELECT balance INTO current_balance 
  FROM public.hourly_user_balances 
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL OR current_balance < 100.00 THEN
    RAISE EXCEPTION 'Minimum balance of $100 required';
  END IF;
  
  -- End any active sessions
  UPDATE public.hourly_usage_sessions 
  SET is_active = FALSE, session_end = NOW(), updated_at = NOW()
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  -- Create new session
  INSERT INTO public.hourly_usage_sessions (user_id, balance_before)
  VALUES (p_user_id, current_balance)
  RETURNING id INTO session_id;
  
  -- Log start event
  INSERT INTO public.hourly_usage_events (session_id, user_id, event_type)
  VALUES (session_id, p_user_id, 'start');
  
  RETURN session_id;
END$$;

-- Add hourly balance
CREATE OR REPLACE FUNCTION public.add_hourly_balance(p_user_id TEXT, p_amount DECIMAL(8,2))
RETURNS DECIMAL(8,2)
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  new_balance DECIMAL(8,2);
BEGIN
  INSERT INTO public.hourly_user_balances (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = hourly_user_balances.balance + EXCLUDED.balance,
    updated_at = NOW()
  RETURNING balance INTO new_balance;
  
  RETURN new_balance;
END$$;

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Chat system indexes
CREATE INDEX IF NOT EXISTS idx_topics_user ON public.chat_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_created ON public.chat_topics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msgs_topic ON public.chat_messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_msgs_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_msgs_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_topic ON public.media_generations(topic_id);
CREATE INDEX IF NOT EXISTS idx_media_user ON public.media_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON public.media_generations(status);
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);

-- Billing system indexes
CREATE INDEX IF NOT EXISTS idx_user_billing_subscription_id ON public.user_billing(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_subscription_id ON public.user_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_user_id ON public.user_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_status ON public.user_billing(status);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_source ON public.processed_webhooks(source);

-- Hourly billing indexes
CREATE INDEX IF NOT EXISTS idx_hourly_sessions_user ON public.hourly_usage_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_hourly_sessions_active ON public.hourly_usage_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_hourly_events_session ON public.hourly_usage_events(session_id);
CREATE INDEX IF NOT EXISTS idx_hourly_events_user ON public.hourly_usage_events(user_id);

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.chat_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_usage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_user_balances ENABLE ROW LEVEL SECURITY;

-- Create Clerk-based policies (using auth.jwt() ->> 'sub')
CREATE POLICY "chat_topics_own" ON public.chat_topics
    FOR ALL USING (user_id = auth.jwt() ->> 'sub')
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "chat_messages_own" ON public.chat_messages
    FOR ALL USING (user_id = auth.jwt() ->> 'sub')
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "media_generations_own" ON public.media_generations
    FOR ALL USING (user_id = auth.jwt() ->> 'sub')
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "projects_own" ON public.projects
    FOR ALL USING (user_id = auth.jwt() ->> 'sub')
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "user_credits_own" ON public.user_credits
    FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "user_billing_own" ON public.user_billing
    FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "user_payments_own" ON public.user_payments
    FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "hourly_sessions_own" ON public.hourly_usage_sessions
    FOR ALL USING (user_id = auth.jwt() ->> 'sub')
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "hourly_events_own" ON public.hourly_usage_events
    FOR ALL USING (user_id = auth.jwt() ->> 'sub')
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "hourly_balances_own" ON public.hourly_user_balances
    FOR ALL USING (user_id = auth.jwt() ->> 'sub')
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

-- ============================================================================
-- 10. PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_credits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_billing TO authenticated;
GRANT SELECT ON public.user_payments TO authenticated;
GRANT SELECT ON public.plan_pricing TO authenticated;
GRANT SELECT ON public.plan_credits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hourly_usage_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hourly_usage_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hourly_user_balances TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.deduct_credits_simple TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits_simple TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_monthly_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_info TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_hourly_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_hourly_balance TO authenticated;

-- Grant service_role permissions for webhooks
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================================
-- 11. VERIFICATION
-- ============================================================================

SELECT 'COMPLETE SETUP SUCCESSFUL! 🎉' as status;

-- Show created tables
SELECT 
    'CHAT SYSTEM: chat_topics, chat_messages, media_generations, projects' as chat_tables,
    'BILLING SYSTEM: user_credits, user_billing, user_payments, plan_pricing' as billing_tables,
    'HOURLY SYSTEM: hourly_usage_sessions, hourly_usage_events, hourly_user_balances' as hourly_tables;

-- Show your plans
SELECT plan, usd_price, monthly_credits, max_images_per_month, max_videos_per_month 
FROM public.plan_pricing 
ORDER BY usd_price;

-- Show functions created
SELECT 'FUNCTIONS: deduct_credits_simple, add_credits_simple, set_monthly_credits, get_user_subscription_info, start_hourly_session, add_hourly_balance' as functions_created;

-- ============================================================================
-- READY FOR PRODUCTION! 🚀
-- Your complete User → Clerk → Supabase → Razorpay system is now set up!
-- ============================================================================
