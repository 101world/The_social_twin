-- Add missing messenger functions that the component needs

-- 1. messenger_upsert_user function (CRITICAL - component is calling this)
CREATE OR REPLACE FUNCTION messenger_upsert_user(
  p_clerk_id TEXT,
  p_username TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- First try to update existing user
  UPDATE messenger_users 
  SET 
    username = p_username,
    display_name = COALESCE(p_display_name, display_name),
    email = COALESCE(p_email, email),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = NOW()
  WHERE clerk_id = p_clerk_id
  RETURNING id INTO user_id;
  
  -- If no user found, insert new one
  IF user_id IS NULL THEN
    INSERT INTO messenger_users (
      clerk_id,
      username,
      display_name,
      email,
      avatar_url,
      is_online,
      last_seen,
      created_at,
      updated_at
    ) VALUES (
      p_clerk_id,
      p_username,
      p_display_name,
      p_email,
      p_avatar_url,
      true,
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO user_id;
  END IF;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. messenger_get_or_create_dm_room function (for starting direct messages)
CREATE OR REPLACE FUNCTION messenger_get_or_create_dm_room(
  user1_clerk_id TEXT,
  user2_clerk_id TEXT
) RETURNS UUID AS $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  room_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM messenger_users WHERE clerk_id = user1_clerk_id;
  SELECT id INTO user2_id FROM messenger_users WHERE clerk_id = user2_clerk_id;
  
  IF user1_id IS NULL OR user2_id IS NULL THEN
    RAISE EXCEPTION 'One or both users not found';
  END IF;
  
  -- Check if DM room already exists between these users
  SELECT r.id INTO room_id
  FROM messenger_chat_rooms r
  WHERE r.room_type = 'direct'
    AND EXISTS (
      SELECT 1 FROM messenger_room_participants p1 
      WHERE p1.room_id = r.id AND p1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM messenger_room_participants p2 
      WHERE p2.room_id = r.id AND p2.user_id = user2_id
    )
    AND (
      SELECT COUNT(*) FROM messenger_room_participants p 
      WHERE p.room_id = r.id AND p.is_active = true
    ) = 2;
  
  -- If no room exists, create one
  IF room_id IS NULL THEN
    INSERT INTO messenger_chat_rooms (
      room_type,
      name,
      is_private,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      'direct',
      NULL,
      true,
      user1_id,
      NOW(),
      NOW()
    ) RETURNING id INTO room_id;
    
    -- Add both users as participants
    INSERT INTO messenger_room_participants (room_id, user_id, role, is_active, joined_at)
    VALUES 
      (room_id, user1_id, 'member', true, NOW()),
      (room_id, user2_id, 'member', true, NOW());
  END IF;
  
  RETURN room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. messenger_send_message function (for sending messages)
CREATE OR REPLACE FUNCTION messenger_send_message(
  sender_clerk_id TEXT,
  room_id UUID,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  ai_generation_data JSONB DEFAULT NULL,
  media_urls TEXT[] DEFAULT NULL,
  reply_to_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  sender_id UUID;
  message_id UUID;
BEGIN
  -- Get sender ID
  SELECT id INTO sender_id FROM messenger_users WHERE clerk_id = sender_clerk_id;
  
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'Sender not found';
  END IF;
  
  -- Insert message
  INSERT INTO messenger_messages (
    room_id,
    sender_id,
    content,
    message_type,
    ai_generation_data,
    media_urls,
    reply_to_id,
    created_at,
    updated_at
  ) VALUES (
    room_id,
    sender_id,
    content,
    message_type,
    ai_generation_data,
    media_urls,
    reply_to_id,
    NOW(),
    NOW()
  ) RETURNING id INTO message_id;
  
  -- Update room's last activity
  UPDATE messenger_chat_rooms 
  SET updated_at = NOW() 
  WHERE id = room_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. messenger_search_users function (for finding users to add as friends)
CREATE OR REPLACE FUNCTION messenger_search_users(
  search_term TEXT,
  current_user_clerk_id TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 10
) RETURNS TABLE(
  id UUID,
  clerk_id TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  custom_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mu.id,
    mu.clerk_id,
    mu.username,
    mu.display_name,
    mu.avatar_url,
    mu.is_online,
    mu.custom_status
  FROM messenger_users mu
  WHERE (
    LOWER(mu.username) LIKE LOWER('%' || search_term || '%') OR
    LOWER(mu.display_name) LIKE LOWER('%' || search_term || '%') OR
    LOWER(mu.email) LIKE LOWER('%' || search_term || '%')
  )
  AND (current_user_clerk_id IS NULL OR mu.clerk_id != current_user_clerk_id)
  ORDER BY 
    CASE WHEN LOWER(mu.username) = LOWER(search_term) THEN 1 ELSE 2 END,
    mu.is_online DESC,
    mu.username
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. messenger_send_friend_request function
CREATE OR REPLACE FUNCTION messenger_send_friend_request(
  requester_clerk_id TEXT,
  addressee_clerk_id TEXT,
  request_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  requester_id UUID;
  addressee_id UUID;
  friendship_id UUID;
  existing_friendship UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO requester_id FROM messenger_users WHERE clerk_id = requester_clerk_id;
  SELECT id INTO addressee_id FROM messenger_users WHERE clerk_id = addressee_clerk_id;
  
  IF requester_id IS NULL OR addressee_id IS NULL THEN
    RAISE EXCEPTION 'One or both users not found';
  END IF;
  
  IF requester_id = addressee_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;
  
  -- Check if friendship already exists
  SELECT id INTO existing_friendship 
  FROM messenger_friendships 
  WHERE (
    (requester_id = requester_id AND addressee_id = addressee_id) OR
    (requester_id = addressee_id AND addressee_id = requester_id)
  );
  
  IF existing_friendship IS NOT NULL THEN
    RAISE EXCEPTION 'Friendship already exists or request already sent';
  END IF;
  
  -- Create friend request
  INSERT INTO messenger_friendships (
    requester_id,
    addressee_id,
    status,
    request_message,
    created_at,
    updated_at
  ) VALUES (
    requester_id,
    addressee_id,
    'pending',
    request_message,
    NOW(),
    NOW()
  ) RETURNING id INTO friendship_id;
  
  RETURN friendship_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. messenger_accept_friend_request function
CREATE OR REPLACE FUNCTION messenger_accept_friend_request(
  friendship_id UUID,
  user_clerk_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
  friendship_record RECORD;
BEGIN
  -- Get user ID
  SELECT id INTO user_id FROM messenger_users WHERE clerk_id = user_clerk_id;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get friendship record
  SELECT * INTO friendship_record 
  FROM messenger_friendships 
  WHERE id = friendship_id AND status = 'pending';
  
  IF friendship_record IS NULL THEN
    RAISE EXCEPTION 'Friend request not found or already processed';
  END IF;
  
  -- Check if user is the addressee
  IF friendship_record.addressee_id != user_id THEN
    RAISE EXCEPTION 'You can only accept requests sent to you';
  END IF;
  
  -- Accept the request
  UPDATE messenger_friendships 
  SET 
    status = 'accepted',
    friend_since = NOW(),
    updated_at = NOW()
  WHERE id = friendship_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. messenger_get_pending_requests function (get incoming friend requests)
CREATE OR REPLACE FUNCTION messenger_get_pending_requests(
  user_clerk_id TEXT
) RETURNS TABLE(
  id UUID,
  requester_id UUID,
  requester_clerk_id TEXT,
  requester_username TEXT,
  requester_display_name TEXT,
  requester_avatar_url TEXT,
  request_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get user ID
  SELECT messenger_users.id INTO user_id FROM messenger_users WHERE clerk_id = user_clerk_id;
  
  RETURN QUERY
  SELECT 
    mf.id,
    mf.requester_id,
    mu.clerk_id,
    mu.username,
    mu.display_name,
    mu.avatar_url,
    mf.request_message,
    mf.created_at
  FROM messenger_friendships mf
  JOIN messenger_users mu ON mu.id = mf.requester_id
  WHERE mf.addressee_id = user_id 
    AND mf.status = 'pending'
  ORDER BY mf.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '🔧 Missing messenger functions added!';
  RAISE NOTICE '✅ messenger_upsert_user - User registration/update';
  RAISE NOTICE '✅ messenger_get_or_create_dm_room - Direct message rooms';
  RAISE NOTICE '✅ messenger_send_message - Send messages';
  RAISE NOTICE '✅ messenger_search_users - Find users to add';
  RAISE NOTICE '✅ messenger_send_friend_request - Send friend requests';
  RAISE NOTICE '✅ messenger_accept_friend_request - Accept requests';
  RAISE NOTICE '✅ messenger_get_pending_requests - Get incoming requests';
  RAISE NOTICE '🎉 Messenger should now work properly!';
END $$;
