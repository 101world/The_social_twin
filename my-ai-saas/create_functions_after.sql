-- STEP 4: Create the functions AFTER tables exist
-- Run this AFTER creating the tables

-- Drop any existing functions first
DROP FUNCTION IF EXISTS messenger_search_users(text,text,integer);
DROP FUNCTION IF EXISTS messenger_send_friend_request(text,text,text);
DROP FUNCTION IF EXISTS messenger_get_friends(text);
DROP FUNCTION IF EXISTS messenger_get_or_create_dm_room(text,text);
DROP FUNCTION IF EXISTS messenger_accept_friend_request(text,text);
DROP FUNCTION IF EXISTS messenger_get_pending_requests(text);
DROP FUNCTION IF EXISTS messenger_register_user(text,text,text,text,text);

-- Simple user registration function
CREATE OR REPLACE FUNCTION messenger_register_user(
  user_clerk_id TEXT,
  user_username TEXT
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO messenger_users (clerk_user_id, username, display_name)
  VALUES (user_clerk_id, user_username, user_username)
  ON CONFLICT (clerk_user_id) DO UPDATE SET
    username = EXCLUDED.username,
    updated_at = NOW()
  RETURNING id INTO user_id;
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- Simple user search function
CREATE OR REPLACE FUNCTION messenger_search_users(
  search_term TEXT,
  current_user_clerk_id TEXT
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  clerk_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.clerk_user_id as clerk_id
  FROM messenger_users u
  WHERE 
    u.clerk_user_id != current_user_clerk_id
    AND u.username ILIKE '%' || search_term || '%'
  ORDER BY u.username
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Simple friend request function
CREATE OR REPLACE FUNCTION messenger_send_friend_request(
  requester_clerk_id TEXT,
  addressee_clerk_id TEXT
)
RETURNS UUID AS $$
DECLARE
  requester_user_id UUID;
  addressee_user_id UUID;
  friendship_id UUID;
BEGIN
  SELECT id INTO requester_user_id FROM messenger_users WHERE clerk_user_id = requester_clerk_id;
  SELECT id INTO addressee_user_id FROM messenger_users WHERE clerk_user_id = addressee_clerk_id;

  IF requester_user_id IS NULL OR addressee_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (requester_user_id, addressee_user_id, 'pending')
  ON CONFLICT (requester_id, addressee_id) DO NOTHING
  RETURNING id INTO friendship_id;

  RETURN friendship_id;
END;
$$ LANGUAGE plpgsql;
