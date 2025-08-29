-- CORRECT FIX based on your actual database schema
-- Your tables use clerk_id, not clerk_user_id

DROP FUNCTION IF EXISTS messenger_search_users(text,text,integer);
DROP FUNCTION IF EXISTS messenger_send_friend_request(text,text,text);
DROP FUNCTION IF EXISTS messenger_get_friends(text);
DROP FUNCTION IF EXISTS messenger_get_or_create_dm_room(text,text);
DROP FUNCTION IF EXISTS messenger_accept_friend_request(text,text);
DROP FUNCTION IF EXISTS messenger_get_pending_requests(text);
DROP FUNCTION IF EXISTS messenger_register_user(text,text,text,text,text);

-- Function 1: Register user (using your actual column names)
CREATE OR REPLACE FUNCTION messenger_register_user(
  user_clerk_id TEXT,
  user_username TEXT,
  user_display_name TEXT DEFAULT NULL,
  user_email TEXT DEFAULT NULL,
  user_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO messenger_users (
    clerk_id,  -- Your actual column name
    username, 
    display_name,
    email,
    avatar_url
  )
  VALUES (
    user_clerk_id,
    user_username,
    user_display_name,
    user_email,
    user_avatar_url
  )
  ON CONFLICT (clerk_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url
  RETURNING id INTO user_id;

  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Search users by username
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
  is_online BOOLEAN,
  is_friend BOOLEAN
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID using correct column name
  SELECT u.id INTO current_user_id 
  FROM messenger_users u 
  WHERE u.clerk_id = current_user_clerk_id;

  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.is_online,
    CASE 
      WHEN f.id IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END as is_friend
  FROM messenger_users u
  LEFT JOIN messenger_friendships f ON (
    (f.requester_id = current_user_id AND f.addressee_id = u.id) OR
    (f.addressee_id = current_user_id AND f.requester_id = u.id)
  ) AND f.status = 'accepted'
  WHERE 
    u.clerk_id != current_user_clerk_id
    AND (
      u.username ILIKE '%' || search_term || '%' OR
      u.display_name ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE WHEN f.id IS NOT NULL THEN 0 ELSE 1 END,
    u.username
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Send friend request
CREATE OR REPLACE FUNCTION messenger_send_friend_request(
  requester_clerk_id TEXT,
  addressee_clerk_id TEXT,
  request_message TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  requester_user_id UUID;
  addressee_user_id UUID;
  friendship_id UUID;
BEGIN
  -- Get user IDs using correct column name
  SELECT id INTO requester_user_id 
  FROM messenger_users 
  WHERE clerk_id = requester_clerk_id;
  
  SELECT id INTO addressee_user_id 
  FROM messenger_users 
  WHERE clerk_id = addressee_clerk_id;

  -- Check if users exist
  IF requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Requester user not found';
  END IF;
  
  IF addressee_user_id IS NULL THEN
    RAISE EXCEPTION 'Addressee user not found';
  END IF;

  -- Check if friendship already exists
  IF EXISTS (
    SELECT 1 FROM messenger_friendships f
    WHERE (
      (f.requester_id = requester_user_id AND f.addressee_id = addressee_user_id) OR
      (f.requester_id = addressee_user_id AND f.addressee_id = requester_user_id)
    )
  ) THEN
    RAISE EXCEPTION 'Friendship already exists or request already sent';
  END IF;

  -- Insert friend request
  INSERT INTO messenger_friendships (requester_id, addressee_id, status, request_message)
  VALUES (requester_user_id, addressee_user_id, 'pending', request_message)
  RETURNING id INTO friendship_id;

  RETURN friendship_id;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Get friends list
CREATE OR REPLACE FUNCTION messenger_get_friends(user_clerk_id TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE,
  clerk_id TEXT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT u.id INTO current_user_id 
  FROM messenger_users u 
  WHERE u.clerk_id = user_clerk_id;

  -- Return friends
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.is_online,
    u.last_seen,
    u.clerk_id
  FROM messenger_users u
  INNER JOIN messenger_friendships f ON (
    (f.requester_id = current_user_id AND f.addressee_id = u.id) OR
    (f.addressee_id = current_user_id AND f.requester_id = u.id)
  )
  WHERE f.status = 'accepted'
  ORDER BY u.display_name, u.username;
END;
$$ LANGUAGE plpgsql;

-- Function 5: Get pending friend requests
CREATE OR REPLACE FUNCTION messenger_get_pending_requests(user_clerk_id TEXT)
RETURNS TABLE (
  id UUID,
  requester_username TEXT,
  requester_display_name TEXT,
  requester_avatar_url TEXT,
  request_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  requester_clerk_id TEXT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT u.id INTO current_user_id FROM messenger_users u WHERE u.clerk_id = user_clerk_id;

  -- Return pending requests
  RETURN QUERY
  SELECT 
    f.id,
    u.username as requester_username,
    u.display_name as requester_display_name,
    u.avatar_url as requester_avatar_url,
    f.request_message,
    f.created_at,
    u.clerk_id as requester_clerk_id
  FROM messenger_friendships f
  INNER JOIN messenger_users u ON u.id = f.requester_id
  WHERE f.addressee_id = current_user_id AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function 6: Accept friend request
CREATE OR REPLACE FUNCTION messenger_accept_friend_request(
  requester_clerk_id TEXT,
  addressee_clerk_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  requester_user_id UUID;
  addressee_user_id UUID;
  rows_updated INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO requester_user_id FROM messenger_users WHERE clerk_id = requester_clerk_id;
  SELECT id INTO addressee_user_id FROM messenger_users WHERE clerk_id = addressee_clerk_id;

  -- Update friendship status
  UPDATE messenger_friendships f
  SET status = 'accepted', updated_at = NOW()
  WHERE f.requester_id = requester_user_id 
    AND f.addressee_id = addressee_user_id 
    AND f.status = 'pending';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Function 7: Get or create DM room (using your chat_rooms structure)
CREATE OR REPLACE FUNCTION messenger_get_or_create_dm_room(
  user1_clerk_id TEXT,
  user2_clerk_id TEXT
)
RETURNS UUID AS $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  room_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM messenger_users WHERE clerk_id = user1_clerk_id;
  SELECT id INTO user2_id FROM messenger_users WHERE clerk_id = user2_clerk_id;

  -- Check if DM room already exists
  SELECT r.id INTO room_id
  FROM messenger_chat_rooms r
  INNER JOIN messenger_room_participants p1 ON p1.room_id = r.id AND p1.user_id = user1_id
  INNER JOIN messenger_room_participants p2 ON p2.room_id = r.id AND p2.user_id = user2_id
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
$$ LANGUAGE plpgsql;
