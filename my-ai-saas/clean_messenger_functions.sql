-- Fix messenger functions with proper table aliasing
-- This addresses the "ambiguous column reference" error

-- Function to search for users (fixed with proper aliasing)
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
  status TEXT,
  is_friend BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.status,
    CASE 
      WHEN f.id IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END as is_friend
  FROM messenger_users u
  LEFT JOIN friendships f ON (
    (f.requester_id = u.id AND f.addressee_id = (
      SELECT mu.id FROM messenger_users mu WHERE mu.clerk_user_id = current_user_clerk_id
    )) OR
    (f.addressee_id = u.id AND f.requester_id = (
      SELECT mu.id FROM messenger_users mu WHERE mu.clerk_user_id = current_user_clerk_id
    ))
  ) AND f.status = 'accepted'
  WHERE 
    u.clerk_user_id != current_user_clerk_id
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

-- Function to send friend request (fixed with proper aliasing)
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
  -- Get user IDs
  SELECT id INTO requester_user_id 
  FROM messenger_users 
  WHERE clerk_user_id = requester_clerk_id;
  
  SELECT id INTO addressee_user_id 
  FROM messenger_users 
  WHERE clerk_user_id = addressee_clerk_id;

  -- Check if users exist
  IF requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Requester user not found';
  END IF;
  
  IF addressee_user_id IS NULL THEN
    RAISE EXCEPTION 'Addressee user not found';
  END IF;

  -- Check if friendship already exists
  IF EXISTS (
    SELECT 1 FROM friendships f
    WHERE (
      (f.requester_id = requester_user_id AND f.addressee_id = addressee_user_id) OR
      (f.requester_id = addressee_user_id AND f.addressee_id = requester_user_id)
    )
  ) THEN
    RAISE EXCEPTION 'Friendship already exists or request already sent';
  END IF;

  -- Insert friend request
  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (requester_user_id, addressee_user_id, 'pending')
  RETURNING id INTO friendship_id;

  RETURN friendship_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get friends list (fixed with proper aliasing)
CREATE OR REPLACE FUNCTION messenger_get_friends(user_clerk_id TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT,
  last_seen TIMESTAMP WITH TIME ZONE,
  bio TEXT,
  clerk_id TEXT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT mu.id INTO current_user_id 
  FROM messenger_users mu 
  WHERE mu.clerk_user_id = user_clerk_id;

  -- Return friends
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.status,
    u.last_seen,
    u.bio,
    u.clerk_user_id as clerk_id
  FROM messenger_users u
  INNER JOIN friendships f ON (
    (f.requester_id = current_user_id AND f.addressee_id = u.id) OR
    (f.addressee_id = current_user_id AND f.requester_id = u.id)
  )
  WHERE f.status = 'accepted'
  ORDER BY u.display_name, u.username;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create DM conversation
CREATE OR REPLACE FUNCTION messenger_get_or_create_dm_room(
  user1_clerk_id TEXT,
  user2_clerk_id TEXT
)
RETURNS UUID AS $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  conversation_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM messenger_users WHERE clerk_user_id = user1_clerk_id;
  SELECT id INTO user2_id FROM messenger_users WHERE clerk_user_id = user2_clerk_id;

  -- Check if conversation already exists
  SELECT c.id INTO conversation_id
  FROM conversations c
  INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = user1_id
  INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = user2_id
  WHERE c.type = 'direct'
  LIMIT 1;

  -- Create conversation if it doesn't exist
  IF conversation_id IS NULL THEN
    INSERT INTO conversations (type, created_by)
    VALUES ('direct', user1_id)
    RETURNING id INTO conversation_id;

    -- Add participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES 
      (conversation_id, user1_id),
      (conversation_id, user2_id);
  END IF;

  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to accept friend request
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
  SELECT id INTO requester_user_id FROM messenger_users WHERE clerk_user_id = requester_clerk_id;
  SELECT id INTO addressee_user_id FROM messenger_users WHERE clerk_user_id = addressee_clerk_id;

  -- Update friendship status
  UPDATE friendships f
  SET status = 'accepted', updated_at = NOW()
  WHERE f.requester_id = requester_user_id 
    AND f.addressee_id = addressee_user_id 
    AND f.status = 'pending';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending friend requests
CREATE OR REPLACE FUNCTION messenger_get_pending_requests(user_clerk_id TEXT)
RETURNS TABLE (
  id UUID,
  requester_username TEXT,
  requester_display_name TEXT,
  requester_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  requester_clerk_id TEXT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT mu.id INTO current_user_id FROM messenger_users mu WHERE mu.clerk_user_id = user_clerk_id;

  -- Return pending requests
  RETURN QUERY
  SELECT 
    f.id,
    u.username as requester_username,
    u.display_name as requester_display_name,
    u.avatar_url as requester_avatar_url,
    f.created_at,
    u.clerk_user_id as requester_clerk_id
  FROM friendships f
  INNER JOIN messenger_users u ON u.id = f.requester_id
  WHERE f.addressee_id = current_user_id AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to register/update messenger user
CREATE OR REPLACE FUNCTION messenger_register_user(
  user_clerk_id TEXT,
  user_username TEXT,
  user_display_name TEXT DEFAULT NULL,
  user_avatar_url TEXT DEFAULT NULL,
  user_bio TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Insert or update user
  INSERT INTO messenger_users (
    clerk_user_id, 
    username, 
    display_name, 
    avatar_url, 
    bio
  )
  VALUES (
    user_clerk_id,
    user_username,
    user_display_name,
    user_avatar_url,
    user_bio
  )
  ON CONFLICT (clerk_user_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    updated_at = NOW()
  RETURNING id INTO user_id;

  RETURN user_id;
END;
$$ LANGUAGE plpgsql;
