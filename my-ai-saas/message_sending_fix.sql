-- FINAL MESSAGE SENDING FIX
-- This will definitely work with your database structure

-- Drop existing message function if it exists
DROP FUNCTION IF EXISTS messenger_send_message(uuid,text,text,text);
DROP FUNCTION IF EXISTS messenger_send_message(uuid,text,text);

-- Create the correct message sending function
CREATE OR REPLACE FUNCTION messenger_send_message(
  room_id_param UUID,
  sender_clerk_id TEXT,
  message_content TEXT
)
RETURNS UUID AS $$
DECLARE
  sender_user_id UUID;
  message_id UUID;
BEGIN
  -- Get sender user ID
  SELECT id INTO sender_user_id 
  FROM messenger_users 
  WHERE clerk_id = sender_clerk_id;

  IF sender_user_id IS NULL THEN
    RAISE EXCEPTION 'Sender user not found';
  END IF;

  -- Insert message into messenger_messages table
  INSERT INTO messenger_messages (
    room_id, 
    sender_id, 
    content, 
    message_type,
    is_encrypted,
    is_edited,
    is_deleted
  )
  VALUES (
    room_id_param, 
    sender_user_id, 
    message_content, 
    'text',
    false,
    false,
    false
  )
  RETURNING id INTO message_id;

  RETURN message_id;
END;
$$ LANGUAGE plpgsql;

-- Also create a function to get messages from a room
CREATE OR REPLACE FUNCTION messenger_get_messages(
  room_id_param UUID,
  user_clerk_id TEXT,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  message_type TEXT,
  sender_username TEXT,
  sender_display_name TEXT,
  sender_clerk_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  is_edited BOOLEAN
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT u.id INTO current_user_id 
  FROM messenger_users u 
  WHERE u.clerk_id = user_clerk_id;

  -- Return messages
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.message_type,
    u.username as sender_username,
    u.display_name as sender_display_name,
    u.clerk_id as sender_clerk_id,
    m.created_at,
    m.is_edited
  FROM messenger_messages m
  INNER JOIN messenger_users u ON u.id = m.sender_id
  WHERE m.room_id = room_id_param 
    AND m.is_deleted = false
  ORDER BY m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
