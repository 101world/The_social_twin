-- Fix: Robust DM room creation aligned to messenger_* schema
-- Safe to run in Supabase SQL editor

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

-- End of fix
