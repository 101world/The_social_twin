-- Fix: Robust DM room creation aligned to messenger_* schema
-- Safe to run in Supabase SQL editor

-- Prereqs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Lightweight discoverability additions
-- 1) Add a shareable code (PIN) and helpful indexes
ALTER TABLE IF EXISTS messenger_users
  ADD COLUMN IF NOT EXISTS share_code TEXT;

CREATE INDEX IF NOT EXISTS idx_m_users_clerk_id ON messenger_users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_m_users_username_ci ON messenger_users((lower(username)));
CREATE INDEX IF NOT EXISTS idx_m_users_email_ci ON messenger_users((lower(email)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_m_users_share_code ON messenger_users(share_code);

-- 2) Helper to generate short share codes
DROP FUNCTION IF EXISTS messenger_generate_share_code();
CREATE OR REPLACE FUNCTION messenger_generate_share_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
BEGIN
  -- 8-hex code; very low collision probability; protected by UNIQUE index
  code := lower(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
  RETURN code;
END;
$$;

DROP FUNCTION IF EXISTS messenger_get_or_create_dm_room(text, text);
DROP FUNCTION IF EXISTS messenger_get_or_create_dm_room(varchar, varchar);

CREATE OR REPLACE FUNCTION messenger_get_or_create_dm_room(
  user1_clerk_id TEXT,
  user2_clerk_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  room_id UUID;
BEGIN
  -- Resolve users by clerk_id (actual column in messenger_users)
  SELECT id INTO user1_id FROM messenger_users WHERE clerk_id = user1_clerk_id;
  IF user1_id IS NULL THEN
    RAISE EXCEPTION 'user1 not found';
  END IF;

  SELECT id INTO user2_id FROM messenger_users WHERE clerk_id = user2_clerk_id;
  IF user2_id IS NULL THEN
    RAISE EXCEPTION 'user2 not found';
  END IF;

  IF user1_id = user2_id THEN
    RAISE EXCEPTION 'cannot create dm with yourself';
  END IF;

  -- Try find existing direct room with both active participants
  SELECT r.id INTO room_id
  FROM messenger_chat_rooms r
  JOIN messenger_room_participants p1 ON p1.room_id = r.id AND p1.user_id = user1_id AND COALESCE(p1.is_active, true)
  JOIN messenger_room_participants p2 ON p2.room_id = r.id AND p2.user_id = user2_id AND COALESCE(p2.is_active, true)
  WHERE r.room_type = 'direct'
  LIMIT 1;

  -- Create room if it doesn't exist
  IF room_id IS NULL THEN
    INSERT INTO messenger_chat_rooms (room_type, name, is_private, created_by)
    VALUES ('direct', NULL, true, user1_id)
    RETURNING id INTO room_id;

    -- Add participants
    INSERT INTO messenger_room_participants (room_id, user_id, role, is_active)
    VALUES 
      (room_id, user1_id, 'member', true),
      (room_id, user2_id, 'member', true);
  END IF;

  RETURN room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION messenger_get_or_create_dm_room(text, text) TO anon, authenticated, service_role;

-- -------------------------------------------------------------------
-- Extras: Core functions needed by the app for user discovery & friends
-- All standardized on messenger_users.clerk_id
-- Safe to re-run; uses DROP IF EXISTS guards
-- -------------------------------------------------------------------

-- Upsert/register a messenger user by Clerk ID (no UNIQUE needed)
DROP FUNCTION IF EXISTS messenger_upsert_user(text, text, text, text, text);
CREATE OR REPLACE FUNCTION messenger_upsert_user(
  p_clerk_id TEXT,
  p_username TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_share_code TEXT;
BEGIN
  -- Try fetch existing
  SELECT id INTO v_user_id FROM messenger_users WHERE clerk_id = p_clerk_id LIMIT 1;

  IF v_user_id IS NULL THEN
    v_share_code := messenger_generate_share_code();
    INSERT INTO messenger_users (clerk_id, username, display_name, email, avatar_url, share_code)
    VALUES (p_clerk_id, p_username, p_display_name, p_email, p_avatar_url, v_share_code)
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE messenger_users
    SET 
      username = COALESCE(p_username, username),
      display_name = COALESCE(p_display_name, display_name),
      email = COALESCE(p_email, email),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = NOW()
    WHERE id = v_user_id;

    -- Ensure share_code exists
    UPDATE messenger_users
    SET share_code = COALESCE(share_code, messenger_generate_share_code())
    WHERE id = v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION messenger_upsert_user(text, text, text, text, text) TO anon, authenticated, service_role;

-- Get accepted friends for a Clerk user
DROP FUNCTION IF EXISTS messenger_get_friends(text);
CREATE OR REPLACE FUNCTION messenger_get_friends(user_clerk_id TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMPTZ,
  clerk_id TEXT,
  custom_status TEXT,
  is_favorite BOOLEAN,
  custom_nickname TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  SELECT u.id INTO current_user_id
  FROM messenger_users u
  WHERE u.clerk_id = user_clerk_id;

  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    COALESCE(u.is_online, FALSE) AS is_online,
    COALESCE(u.last_seen, NOW()) AS last_seen,
    u.clerk_id,
    COALESCE(u.custom_status, NULL) AS custom_status,
    FALSE AS is_favorite,
    NULL::TEXT AS custom_nickname
  FROM messenger_users u
  JOIN messenger_friendships f ON (
    (f.requester_id = current_user_id AND f.addressee_id = u.id) OR
    (f.addressee_id = current_user_id AND f.requester_id = u.id)
  )
  WHERE f.status = 'accepted'
  ORDER BY COALESCE(u.display_name, u.username);
END;
$$;
GRANT EXECUTE ON FUNCTION messenger_get_friends(text) TO anon, authenticated, service_role;

-- Search users by name/username; mark if they are already friends
DROP FUNCTION IF EXISTS messenger_search_users(text, text, integer);
CREATE OR REPLACE FUNCTION messenger_search_users(
  search_term TEXT,
  current_user_clerk_id TEXT,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  clerk_id TEXT,
  is_friend BOOLEAN,
  share_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  SELECT id INTO current_user_id FROM messenger_users WHERE clerk_id = current_user_clerk_id;
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH rel AS (
    SELECT 
      CASE WHEN f.status = 'accepted' THEN 1 ELSE 0 END AS is_friend,
      CASE 
        WHEN f.requester_id = current_user_id THEN f.addressee_id
        WHEN f.addressee_id = current_user_id THEN f.requester_id
      END AS other_id
    FROM messenger_friendships f
    WHERE (f.requester_id = current_user_id OR f.addressee_id = current_user_id)
  )
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.clerk_id,
    COALESCE((SELECT r.is_friend FROM rel r WHERE r.other_id = u.id LIMIT 1), 0) = 1 AS is_friend,
    u.share_code
  FROM messenger_users u
  WHERE u.clerk_id <> current_user_clerk_id
    AND (
      u.username ILIKE '%' || search_term || '%'
      OR COALESCE(u.display_name, '') ILIKE '%' || search_term || '%'
      OR (position('@' in search_term) > 0 AND COALESCE(u.email, '') ILIKE '%' || search_term || '%')
      OR COALESCE(u.share_code, '') ILIKE '%' || search_term || '%'
    )
  ORDER BY is_friend DESC, LOWER(u.username)
  LIMIT GREATEST(limit_count, 1);
END;
$$;
GRANT EXECUTE ON FUNCTION messenger_search_users(text, text, integer) TO anon, authenticated, service_role;

-- 3) RLS policies to allow discovery (read-only)
-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS messenger_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messenger_friendships ENABLE ROW LEVEL SECURITY;

-- Allow authenticated to read basic messenger_users (for discovery)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messenger_users' AND policyname = 'messenger_users_read_profiles'
  ) THEN
    CREATE POLICY messenger_users_read_profiles
      ON messenger_users
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END$$;

-- Allow authenticated to read friendships where they are a participant (for is_friend flag)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messenger_friendships' AND policyname = 'messenger_friendships_read_own'
  ) THEN
    CREATE POLICY messenger_friendships_read_own
      ON messenger_friendships
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM messenger_users mu 
          WHERE (mu.id = messenger_friendships.requester_id OR mu.id = messenger_friendships.addressee_id)
            AND mu.clerk_id = auth.uid()::text
        )
      );
  END IF;
END$$;

-- End of fix pack
