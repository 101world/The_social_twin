-- 101Messenger - Compatible with Existing System
-- Safe to deploy without breaking AI generation or existing functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MESSENGER TABLES (Safe - Won't conflict with existing system)
-- ============================================================================

-- Messenger users table (separate from existing users to avoid conflicts)
CREATE TABLE IF NOT EXISTS messenger_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL, -- Links to your Clerk authentication
  username TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  
  -- Status
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Privacy (optional)
  privacy_mode BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat rooms for messaging
CREATE TABLE IF NOT EXISTS messenger_chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_type TEXT CHECK (room_type IN ('direct', 'group')) DEFAULT 'direct',
  name TEXT, -- NULL for direct messages, set for groups
  description TEXT,
  avatar_url TEXT,
  
  -- Settings
  is_private BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES messenger_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Who's in which room
CREATE TABLE IF NOT EXISTS messenger_room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES messenger_chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(room_id, user_id)
);

-- Messages (keeps full history as requested)
CREATE TABLE IF NOT EXISTS messenger_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES messenger_chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'file', 'voice', 'system')) DEFAULT 'text',
  
  -- Optional features
  is_encrypted BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE, -- For ephemeral messages (optional)
  
  -- Threading
  reply_to_id UUID REFERENCES messenger_messages(id),
  
  -- Status
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friends system
CREATE TABLE IF NOT EXISTS messenger_friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(requester_id, addressee_id)
);

-- Message read status
CREATE TABLE IF NOT EXISTS messenger_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_messenger_users_clerk_id ON messenger_users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_messenger_users_username ON messenger_users(username);
CREATE INDEX IF NOT EXISTS idx_messenger_room_participants_room ON messenger_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_messenger_room_participants_user ON messenger_room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_room ON messenger_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_sender ON messenger_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messenger_friendships_req ON messenger_friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_messenger_friendships_addr ON messenger_friendships(addressee_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - SAFE POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE messenger_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_read_status ENABLE ROW LEVEL SECURITY;

-- Users can see themselves and friends
CREATE POLICY "messenger_users_policy" ON messenger_users
  FOR ALL USING (
    clerk_id = auth.jwt() ->> 'sub' OR
    id IN (
      SELECT CASE 
        WHEN requester_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') 
        THEN addressee_id 
        ELSE requester_id 
      END
      FROM messenger_friendships 
      WHERE status = 'accepted' AND (
        requester_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
        addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      )
    )
  );

-- Chat rooms - only participants can see
CREATE POLICY "messenger_chat_rooms_policy" ON messenger_chat_rooms
  FOR ALL USING (
    id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- Room participants
CREATE POLICY "messenger_room_participants_policy" ON messenger_room_participants
  FOR ALL USING (
    room_id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- Messages - only room participants can see
CREATE POLICY "messenger_messages_policy" ON messenger_messages
  FOR ALL USING (
    room_id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- Messages insert - only room participants can send
CREATE POLICY "messenger_messages_insert_policy" ON messenger_messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') AND
    room_id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- Friendships
CREATE POLICY "messenger_friendships_policy" ON messenger_friendships
  FOR ALL USING (
    requester_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
  );

-- Read status
CREATE POLICY "messenger_read_status_policy" ON messenger_read_status
  FOR ALL USING (
    user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    message_id IN (
      SELECT id FROM messenger_messages 
      WHERE sender_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS (Safe - Won't conflict with existing functions)
-- ============================================================================

-- Function to add/update user when they sign in with Clerk
CREATE OR REPLACE FUNCTION messenger_upsert_user(
  p_clerk_id TEXT,
  p_username TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO messenger_users (clerk_id, username, display_name, email, avatar_url)
  VALUES (p_clerk_id, p_username, p_display_name, p_email, p_avatar_url)
  ON CONFLICT (clerk_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
  RETURNING id INTO user_id;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create direct message room between two users
CREATE OR REPLACE FUNCTION messenger_get_or_create_dm_room(user1_clerk_id TEXT, user2_clerk_id TEXT)
RETURNS UUID AS $$
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
  
  -- Check if room already exists
  SELECT cr.id INTO room_id
  FROM messenger_chat_rooms cr
  WHERE cr.room_type = 'direct'
    AND cr.id IN (
      SELECT rp1.room_id 
      FROM messenger_room_participants rp1
      JOIN messenger_room_participants rp2 ON rp1.room_id = rp2.room_id
      WHERE rp1.user_id = user1_id AND rp2.user_id = user2_id
        AND rp1.is_active = true AND rp2.is_active = true
    );
  
  -- Create room if it doesn't exist
  IF room_id IS NULL THEN
    INSERT INTO messenger_chat_rooms (room_type, created_by) 
    VALUES ('direct', user1_id) 
    RETURNING id INTO room_id;
    
    -- Add both users to the room
    INSERT INTO messenger_room_participants (room_id, user_id) VALUES (room_id, user1_id);
    INSERT INTO messenger_room_participants (room_id, user_id) VALUES (room_id, user2_id);
  END IF;
  
  RETURN room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send a message
CREATE OR REPLACE FUNCTION messenger_send_message(
  sender_clerk_id TEXT,
  room_id UUID,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  reply_to_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
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
  INSERT INTO messenger_messages (room_id, sender_id, content, message_type, reply_to_id)
  VALUES (room_id, sender_id, content, message_type, reply_to_id)
  RETURNING id INTO message_id;
  
  -- Update room timestamp
  UPDATE messenger_chat_rooms SET updated_at = NOW() WHERE id = room_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's friends
CREATE OR REPLACE FUNCTION messenger_get_friends(user_clerk_id TEXT)
RETURNS TABLE(
  id UUID,
  clerk_id TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
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
    mu.last_seen
  FROM messenger_users mu
  WHERE mu.id IN (
    SELECT CASE 
      WHEN mf.requester_id = (SELECT id FROM messenger_users WHERE clerk_id = user_clerk_id) 
      THEN mf.addressee_id 
      ELSE mf.requester_id 
    END
    FROM messenger_friendships mf
    WHERE mf.status = 'accepted' AND (
      mf.requester_id = (SELECT id FROM messenger_users WHERE clerk_id = user_clerk_id) OR
      mf.addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = user_clerk_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup expired messages (optional)
CREATE OR REPLACE FUNCTION messenger_cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM messenger_messages 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TEST DATA (Optional - Remove in production)
-- ============================================================================

-- Insert some test users for development
INSERT INTO messenger_users (clerk_id, username, display_name, email) VALUES
('test_user_1', 'alice', 'Alice Crypto', 'alice@test.com'),
('test_user_2', 'bob', 'Bob Secure', 'bob@test.com')
ON CONFLICT (clerk_id) DO NOTHING;

-- Create a friendship between test users
INSERT INTO messenger_friendships (
  requester_id, 
  addressee_id, 
  status
) 
SELECT 
  (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_1'),
  (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_2'),
  'accepted'
WHERE NOT EXISTS (
  SELECT 1 FROM messenger_friendships 
  WHERE requester_id = (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_1')
  AND addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_2')
);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: 101Messenger database schema deployed successfully!';
  RAISE NOTICE 'Tables created: messenger_users, messenger_chat_rooms, messenger_room_participants, messenger_messages, messenger_friendships, messenger_read_status';
  RAISE NOTICE 'Functions created: messenger_upsert_user, messenger_get_or_create_dm_room, messenger_send_message, messenger_get_friends';
  RAISE NOTICE 'RLS policies enabled for security';
  RAISE NOTICE 'Ready for integration with your existing system!';
END $$;
