-- ===================================================================
-- COMPLETE FIX: "Failed to create generation record" Error
-- This creates the EXACT table structure that your API expects
-- ===================================================================

-- Create the complete generations table with ALL required columns
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT,
  result_url TEXT,
  content TEXT,
  duration_seconds INTEGER, -- CRITICAL: This was missing!
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

-- Grant permissions
GRANT SELECT ON public.generations TO authenticated;

-- ===================================================================
-- VERIFICATION: Check the table structure matches API expectations
-- ===================================================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'user_id' THEN '🔑 User Key - Required for RLS'
        WHEN column_name = 'duration_seconds' THEN '⏱️ Duration - Critical for video tracking'
        WHEN column_name = 'metadata' THEN '📊 Metadata - Stores cost and runpod info'
        WHEN column_name LIKE '%_at' THEN '📅 Timestamp'
        WHEN column_name = 'id' THEN '🆔 Primary Key'
        ELSE '📝 Data Field'
    END as "Purpose"
FROM information_schema.columns 
WHERE table_name = 'generations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected columns for API compatibility:
-- ✅ id (UUID, Primary Key)
-- ✅ user_id (TEXT, for RLS)  
-- ✅ type (TEXT, for generation type)
-- ✅ prompt (TEXT, user prompt)
-- ✅ result_url (TEXT, generated content URL)
-- ✅ content (TEXT, AI response text)
-- ✅ duration_seconds (INTEGER, for video duration) ← This was missing!
-- ✅ metadata (JSONB, cost/runpod info)
-- ✅ created_at (TIMESTAMPTZ, timestamp)
-- ✅ updated_at (TIMESTAMPTZ, timestamp)
