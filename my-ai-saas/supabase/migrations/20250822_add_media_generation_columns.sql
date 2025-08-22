-- Migration: add missing columns for media_generations
ALTER TABLE public.media_generations
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE public.media_generations
  ADD COLUMN IF NOT EXISTS generation_params JSONB;

ALTER TABLE public.media_generations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE public.media_generations
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.media_generations
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create an index on status to speed up worker polling
CREATE INDEX IF NOT EXISTS idx_media_generations_status ON public.media_generations(status);

-- Backfill existing rows: set status to 'pending' where result_url is NULL and status is null
UPDATE public.media_generations SET status='pending' WHERE status IS NULL AND result_url IS NULL;
UPDATE public.media_generations SET status='completed' WHERE status IS NULL AND result_url IS NOT NULL;

-- Ensure RLS policies remain valid (no-op here; policies are defined elsewhere)
