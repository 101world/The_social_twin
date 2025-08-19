-- Migration: Per-type generation allowances and usage helpers
-- Adds allowances per plan for text/image/video, optionally time-based for video.

-- 1) Extend generations with optional duration for time-based allowances
ALTER TABLE IF EXISTS public.generations
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER; -- null for text/image

-- 2) Plan-level per-type allowances
CREATE TABLE IF NOT EXISTS public.plan_generation_allowances (
  plan TEXT NOT NULL,
  type TEXT NOT NULL, -- 'text' | 'image' | 'video'
  daily_count INTEGER NOT NULL DEFAULT 0,
  monthly_count INTEGER NOT NULL DEFAULT 0,
  daily_minutes INTEGER NOT NULL DEFAULT 0,     -- for video time-based limits
  monthly_minutes INTEGER NOT NULL DEFAULT 0,   -- for video time-based limits
  PRIMARY KEY (plan, type)
);

GRANT SELECT ON public.plan_generation_allowances TO authenticated;

-- Seed defaults; tweak as needed. Counts are examples aligned roughly to existing daily grants.
INSERT INTO public.plan_generation_allowances(plan, type, daily_count, monthly_count, daily_minutes, monthly_minutes) VALUES
  ('free',  'text',  50,   1500, 0,   0),
  ('free',  'image',  5,    150,  0,   0),
  ('free',  'video',  0,      0,  0,   0),
  ('one t', 'text',  33,   1000, 0,   0),
  ('one t', 'image',  8,    240,  0,   0),
  ('one t', 'video',  0,      0, 15, 450),
  ('one s', 'text', 166,   5000, 0,   0),
  ('one s', 'image', 25,    750,  0,   0),
  ('one s', 'video',  0,      0, 60, 1800),
  ('one xt','text', 333,  10000, 0,   0),
  ('one xt','image', 50,   1500,  0,   0),
  ('one xt','video',  0,      0,120, 3600),
  ('one z', 'text',1666,  50000, 0,   0),
  ('one z', 'image',150,   4500,  0,   0),
  ('one z', 'video',  0,      0,600,18000)
ON CONFLICT (plan, type) DO UPDATE SET
  daily_count = EXCLUDED.daily_count,
  monthly_count = EXCLUDED.monthly_count,
  daily_minutes = EXCLUDED.daily_minutes,
  monthly_minutes = EXCLUDED.monthly_minutes;

-- 3) Helper: get a user's plan (defaults to 'free' if not present)
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE AS $$
  SELECT COALESCE(LOWER(plan), 'free')
  FROM public.user_billing
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

-- 4) Helper: usage by user and type for current day and month
CREATE OR REPLACE FUNCTION public.get_user_generation_usage(p_user_id TEXT)
RETURNS TABLE(
  type TEXT,
  daily_count INTEGER,
  monthly_count INTEGER,
  daily_minutes INTEGER,
  monthly_minutes INTEGER
)
LANGUAGE sql
STABLE AS $$
  WITH base AS (
    SELECT
      LOWER(type) AS type,
      created_at,
      COALESCE(duration_seconds, 0) AS duration_seconds
    FROM public.generations
    WHERE user_id = p_user_id
  ), daily AS (
    SELECT type,
           COUNT(*)::INT AS daily_count,
           (SUM(COALESCE(duration_seconds,0)) / 60)::INT AS daily_minutes
    FROM base
    WHERE created_at::date = CURRENT_DATE
    GROUP BY type
  ), monthly AS (
    SELECT type,
           COUNT(*)::INT AS monthly_count,
           (SUM(COALESCE(duration_seconds,0)) / 60)::INT AS monthly_minutes
    FROM base
    WHERE date_trunc('month', created_at) = date_trunc('month', now())
    GROUP BY type
  ), types AS (
    SELECT unnest(ARRAY['text','image','video'])::TEXT AS type
  )
  SELECT
    t.type,
    COALESCE(d.daily_count, 0) AS daily_count,
    COALESCE(m.monthly_count, 0) AS monthly_count,
    COALESCE(d.daily_minutes, 0) AS daily_minutes,
    COALESCE(m.monthly_minutes, 0) AS monthly_minutes
  FROM types t
  LEFT JOIN daily d USING(type)
  LEFT JOIN monthly m USING(type)
  ORDER BY t.type;
$$;

-- 5) Helper: allowances enriched with usage and reset times
CREATE OR REPLACE FUNCTION public.get_user_allowances(p_user_id TEXT)
RETURNS TABLE(
  plan TEXT,
  type TEXT,
  allowed_daily_count INTEGER,
  used_daily_count INTEGER,
  allowed_monthly_count INTEGER,
  used_monthly_count INTEGER,
  allowed_daily_minutes INTEGER,
  used_daily_minutes INTEGER,
  allowed_monthly_minutes INTEGER,
  used_monthly_minutes INTEGER,
  daily_resets_at TIMESTAMPTZ,
  monthly_resets_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE AS $$
  WITH p AS (
    SELECT COALESCE(LOWER(plan), 'free') AS plan
    FROM public.user_billing
    WHERE user_id = p_user_id
    LIMIT 1
  ), plan_val AS (
    SELECT COALESCE((SELECT plan FROM p), 'free') AS plan
  ), a AS (
    SELECT plan, LOWER(type) AS type, daily_count, monthly_count, daily_minutes, monthly_minutes
    FROM public.plan_generation_allowances
    WHERE plan = (SELECT plan FROM plan_val)
  ), u AS (
    SELECT * FROM public.get_user_generation_usage(p_user_id)
  )
  SELECT
    (SELECT plan FROM plan_val) AS plan,
    a.type,
    a.daily_count AS allowed_daily_count,
    u.daily_count AS used_daily_count,
    a.monthly_count AS allowed_monthly_count,
    u.monthly_count AS used_monthly_count,
    a.daily_minutes AS allowed_daily_minutes,
    u.daily_minutes AS used_daily_minutes,
    a.monthly_minutes AS allowed_monthly_minutes,
    u.monthly_minutes AS used_monthly_minutes,
    date_trunc('day', now()) + interval '1 day' AS daily_resets_at,
    date_trunc('month', now()) + interval '1 month' AS monthly_resets_at
  FROM a
  LEFT JOIN u USING(type)
  ORDER BY a.type;
$$;
