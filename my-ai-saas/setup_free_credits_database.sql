-- ===================================================================
-- FREE CREDITS SYSTEM - Database Setup
-- Run this in your Supabase SQL editor to enable the free credits feature
-- ===================================================================

-- Create free_credit_claims table to track one-time free credit claims
CREATE TABLE IF NOT EXISTS public.free_credit_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    credits_added INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id) -- Ensures one claim per user
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_free_credit_claims_user_id ON public.free_credit_claims(user_id);

-- Enable RLS
ALTER TABLE public.free_credit_claims ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own claims
CREATE POLICY "Users can view their own free credit claims" ON public.free_credit_claims
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Admin policy for service role
CREATE POLICY "Service role can manage free credit claims" ON public.free_credit_claims
    FOR ALL
    USING (true);

-- Add comment
COMMENT ON TABLE public.free_credit_claims IS 'Tracks one-time free credit claims by users for user acquisition';

-- ===================================================================
-- VERIFICATION QUERIES (run these to confirm setup)
-- ===================================================================

-- Check if table was created successfully
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'free_credit_claims' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'free_credit_claims';

-- Check if indexes were created
SELECT indexname, indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'free_credit_claims';
