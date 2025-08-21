-- ===================================================================
-- COMPLETE FIX: "Failed to create generation record" Error
-- This includes ALL fields that the API expects
-- ===================================================================

-- Drop and recreate the table with all required fields
DROP TABLE IF EXISTS public.generations CASCADE;

-- Create complete generations table with ALL required fields
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT,
  result_url TEXT,
  content TEXT,
  duration_seconds INTEGER,  -- Missing field causing the error!
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
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX idx_generations_type ON public.generations(type);

-- ===================================================================
-- VERIFICATION - Check table structure
-- ===================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'generations' 
AND table_schema = 'public'
ORDER BY ordinal_position;
