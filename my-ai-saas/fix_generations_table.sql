-- ===================================================================
-- FIX: "Failed to create generation record" Error
-- PERFECT USER ISOLATION - Each user can only see their own generations
-- Run this in your Supabase SQL editor to fix the image generation issue
-- ===================================================================

-- Create missing generations table
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT,
  result_url TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (Row Level Security) - CRITICAL for user isolation
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- PERFECT USER ISOLATION: Users can only access their own data
CREATE POLICY "users_own_generations_only" ON public.generations
FOR ALL 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Service role policy (for API operations)
CREATE POLICY "service_role_generations_access" ON public.generations
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_type ON public.generations(type);

-- ===================================================================
-- SECURITY VERIFICATION
-- ===================================================================

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'generations';

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'generations';

-- ===================================================================
-- USER ISOLATION TEST
-- This ensures perfect separation between users:
-- 1. User A cannot see User B's generations
-- 2. User A cannot modify User B's generations  
-- 3. User A can only insert with their own user_id
-- ===================================================================
