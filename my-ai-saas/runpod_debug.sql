-- ===================================================================
-- RUNPOD DEBUGGING SCRIPT
-- Test your RunPod endpoint to see what it's actually returning
-- ===================================================================

-- First, let's run the complete generations table fix:
DROP TABLE IF EXISTS public.generations CASCADE;

CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT,
  result_url TEXT,
  content TEXT,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_generations_only" ON public.generations
FOR ALL 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "service_role_generations_access" ON public.generations
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX idx_generations_type ON public.generations(type);
