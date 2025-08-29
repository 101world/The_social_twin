-- Final missing functions for complete messenger functionality

-- Function to get pending friend requests (was missing)
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

-- Function to accept friend request (was missing)
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

-- Function to get friends list (was missing)
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

-- Function to send message
CREATE OR REPLACE FUNCTION messenger_send_message(
  room_id_param UUID,
  sender_clerk_id TEXT,
  message_content TEXT,
  message_type TEXT DEFAULT 'text'
)
RETURNS UUID AS $$
DECLARE
  sender_user_id UUID;
  message_id UUID;
BEGIN
  -- Get sender user ID
  SELECT id INTO sender_user_id FROM messenger_users WHERE clerk_id = sender_clerk_id;

  IF sender_user_id IS NULL THEN
    RAISE EXCEPTION 'Sender user not found';
  END IF;

  -- Check if user is participant in the room
  IF NOT EXISTS (
    SELECT 1 FROM messenger_room_participants 
    WHERE room_id = room_id_param AND user_id = sender_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this room';
  END IF;

  -- Insert message
  INSERT INTO messenger_messages (room_id, sender_id, content, message_type)
  VALUES (room_id_param, sender_user_id, message_content, message_type)
  RETURNING id INTO message_id;

  RETURN message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get messages from a room
CREATE OR REPLACE FUNCTION messenger_get_messages(
  room_id_param UUID,
  user_clerk_id TEXT,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  message_type TEXT,
  sender_username TEXT,
  sender_display_name TEXT,
  sender_avatar_url TEXT,
  sender_clerk_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  is_edited BOOLEAN
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT u.id INTO current_user_id FROM messenger_users u WHERE u.clerk_id = user_clerk_id;

  -- Check if user is participant in the room
  IF NOT EXISTS (
    SELECT 1 FROM messenger_room_participants 
    WHERE room_id = room_id_param AND user_id = current_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this room';
  END IF;

  -- Return messages
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.message_type,
    u.username as sender_username,
    u.display_name as sender_display_name,
    u.avatar_url as sender_avatar_url,
    u.clerk_id as sender_clerk_id,
    m.created_at,
    m.is_edited
  FROM messenger_messages m
  INNER JOIN messenger_users u ON u.id = m.sender_id
  WHERE m.room_id = room_id_param 
    AND m.is_deleted = false
  ORDER BY m.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;
