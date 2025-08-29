-- Fix: Align messenger_send_message to API contract and messenger_* schema

-- Drop ambiguous/old variants
DROP FUNCTION IF EXISTS messenger_send_message(TEXT, UUID, TEXT, TEXT, UUID, JSONB, TEXT[]);
DROP FUNCTION IF EXISTS messenger_send_message(TEXT, UUID, TEXT, TEXT, JSONB, TEXT[], UUID);
DROP FUNCTION IF EXISTS messenger_send_message(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS messenger_send_message(UUID, TEXT, TEXT);

-- Create canonical function expected by app/api/messenger/send-message/route.ts
CREATE OR REPLACE FUNCTION messenger_send_message(
  sender_clerk_id TEXT,
  room_id UUID,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  ai_generation_data JSONB DEFAULT NULL,
  media_urls TEXT[] DEFAULT NULL,
  reply_to_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_id UUID;
  message_id UUID;
BEGIN
  -- Resolve sender by Clerk ID
  SELECT id INTO sender_id FROM messenger_users WHERE clerk_id = sender_clerk_id;
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'Sender not found';
  END IF;

  -- Ensure sender is active participant of room
  IF NOT EXISTS (
    SELECT 1 FROM messenger_room_participants
    WHERE room_id = messenger_send_message.room_id
      AND user_id = sender_id
      AND COALESCE(is_active, true)
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this room';
  END IF;

  -- Insert message
  INSERT INTO messenger_messages (
    room_id,
    sender_id,
    content,
    message_type,
    ai_generation_data,
    media_urls,
    reply_to_id
  ) VALUES (
    messenger_send_message.room_id,
    sender_id,
    TRIM(content),
    COALESCE(NULLIF(message_type, ''), 'text'),
    ai_generation_data,
    media_urls,
    reply_to_id
  ) RETURNING id INTO message_id;

  -- Bump room timestamp
  UPDATE messenger_chat_rooms SET updated_at = NOW() WHERE id = messenger_send_message.room_id;

  RETURN message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION messenger_send_message(TEXT, UUID, TEXT, TEXT, JSONB, TEXT[], UUID) TO anon, authenticated, service_role;
