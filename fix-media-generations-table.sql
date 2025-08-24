-- Fix media_generations table structure
-- Run this in your Supabase SQL editor

-- First, let's make topic_id nullable since it's not always required
ALTER TABLE public.media_generations 
ALTER COLUMN topic_id DROP NOT NULL;

-- Ensure the table has all required columns
ALTER TABLE public.media_generations 
ADD COLUMN IF NOT EXISTS generation_params JSONB;

ALTER TABLE public.media_generations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE public.media_generations 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE public.media_generations 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.media_generations 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Ensure RLS is enabled but allow inserts
ALTER TABLE public.media_generations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and create new ones
DROP POLICY IF EXISTS "media_generations_own" ON public.media_generations;
DROP POLICY IF EXISTS "media_own_clerk" ON public.media_generations;
DROP POLICY IF EXISTS "Users can manage their own media generations" ON public.media_generations;

-- Create a simple policy that allows users to manage their own records
CREATE POLICY "Users can manage their own media generations" 
ON public.media_generations
FOR ALL
USING (user_id = auth.jwt()->>'sub' OR user_id = auth.jwt()->>'user_id' OR user_id = COALESCE(auth.jwt()->>'sub', auth.jwt()->>'user_id'));

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_generations TO service_role;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_generations_user_id ON public.media_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_media_generations_status ON public.media_generations(status);
CREATE INDEX IF NOT EXISTS idx_media_generations_created_at ON public.media_generations(created_at);

-- Test insert to verify structure works (with topic_id as null)
INSERT INTO public.media_generations (
    user_id, 
    type, 
    prompt, 
    status, 
    generation_params,
    topic_id
) VALUES (
    'test_user', 
    'image', 
    'test prompt', 
    'pending', 
    '{"cost": 5, "batch_size": 1}'::jsonb,
    null
) ON CONFLICT DO NOTHING;

-- Clean up test record
DELETE FROM public.media_generations WHERE user_id = 'test_user';

SELECT 'media_generations table structure fixed successfully' as result;
