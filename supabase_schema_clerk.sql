-- 101 World - Clerk-based AI Chat Schema (paste in Supabase SQL Editor)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core tables (Clerk user_id is TEXT)
CREATE TABLE IF NOT EXISTS public.chat_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES public.chat_topics(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES public.chat_topics(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT,
  result_url TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_daily_topup_at TIMESTAMPTZ
);

-- Projects (saved grids)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  data JSONB NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media folders for organizing generated media
CREATE TABLE IF NOT EXISTS public.media_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.media_folder_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  folder_id UUID NOT NULL REFERENCES public.media_folders(id) ON DELETE CASCADE,
  media_id UUID NULL REFERENCES public.media_generations(id) ON DELETE SET NULL,
  media_url TEXT,
  type TEXT, -- image | video
  prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.chat_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_folder_items ENABLE ROW LEVEL SECURITY;

-- Clerk JWT subject (sub) based access
CREATE POLICY "topics_own_clerk" ON public.chat_topics
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "messages_own_clerk" ON public.chat_messages
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "media_own_clerk" ON public.media_generations
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "credits_own_clerk" ON public.user_credits
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "projects_own_clerk" ON public.projects
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "media_folders_own_clerk" ON public.media_folders
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "media_folder_items_own_clerk" ON public.media_folder_items
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folder_items TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topics_user ON public.chat_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_msgs_topic ON public.chat_messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_msgs_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_media_topic ON public.media_generations(topic_id);
CREATE INDEX IF NOT EXISTS idx_media_user ON public.media_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_media_folders_user ON public.media_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_media_folder_items_folder ON public.media_folder_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_folder_items_user ON public.media_folder_items(user_id);

-- Simple credit RPC helpers (atomic)
CREATE OR REPLACE FUNCTION public.add_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE new_balance INTEGER;
BEGIN
  INSERT INTO public.user_credits(user_id, credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET credits = public.user_credits.credits + EXCLUDED.credits,
                                      updated_at = NOW()
  RETURNING credits INTO new_balance;
  RETURN new_balance;
END$$;

CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE public.user_credits
  SET credits = credits - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND credits >= p_amount
  RETURNING credits INTO new_balance;

  IF NOT FOUND THEN
    RETURN NULL; -- insufficient credits or no row
  END IF;

  RETURN new_balance;
END$$;

-- Daily grant: add p_amount once per calendar day
CREATE OR REPLACE FUNCTION public.grant_daily_credits_if_needed(p_user_id TEXT, p_amount INTEGER)
RETURNS TABLE(granted BOOLEAN, new_balance INTEGER, last_grant_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE last_ts TIMESTAMPTZ;
BEGIN
  -- Ensure row exists
  INSERT INTO public.user_credits(user_id, credits, updated_at, last_daily_topup_at)
  VALUES (p_user_id, 0, NOW(), NULL)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_daily_topup_at INTO last_ts
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF last_ts IS NULL OR last_ts::date < CURRENT_DATE THEN
    UPDATE public.user_credits
    SET credits = credits + p_amount,
        updated_at = NOW(),
        last_daily_topup_at = NOW()
    WHERE user_id = p_user_id
    RETURNING credits, last_daily_topup_at INTO new_balance, last_grant_at;
    RETURN QUERY SELECT TRUE, new_balance, last_grant_at;
  ELSE
    SELECT credits, last_daily_topup_at INTO new_balance, last_grant_at
    FROM public.user_credits WHERE user_id = p_user_id;
    RETURN QUERY SELECT FALSE, new_balance, last_grant_at;
  END IF;
END$$;

-- REMOVED: Stripe integration (using Razorpay instead)
-- CREATE TABLE IF NOT EXISTS public.stripe_price_to_credits (
  price_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL
);


