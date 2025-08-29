-- Simplified 101Messenger with Clerk Integration
-- Keep user IDs and chat history but simplified architecture

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Simple users table with Clerk integration
CREATE TABLE IF NOT EXISTS messenger_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL, -- Clerk user ID for authentication
  username TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  
  -- Privacy settings (simplified)
  privacy_mode BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat rooms (direct messages and groups)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_type TEXT CHECK (room_type IN ('direct', 'group')) DEFAULT 'direct',
  name TEXT, -- NULL for direct messages
  description TEXT,
  avatar_url TEXT,
  
  -- Privacy
  is_private BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES messenger_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room participants
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(room_id, user_id)
);

-- Messages with history (simplified but complete)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'file', 'voice', 'system')) DEFAULT 'text',
  
  -- Optional privacy features
  is_encrypted BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE, -- For ephemeral messages (optional)
  
  -- Message threading
  reply_to_id UUID REFERENCES messages(id),
  
  -- Status
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friend relationships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(requester_id, addressee_id)
);

-- Message read status
CREATE TABLE IF NOT EXISTS message_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_messenger_users_clerk_id ON messenger_users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

-- Enable RLS
ALTER TABLE messenger_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view themselves and friends" ON messenger_users
  FOR SELECT USING (
    clerk_id = auth.jwt() ->> 'sub' OR
    id IN (
      SELECT CASE 
        WHEN requester_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') 
        THEN addressee_id 
        ELSE requester_id 
      END
      FROM friendships 
      WHERE status = 'accepted' AND (
        requester_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
        addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "Users can update their own profile" ON messenger_users
  FOR UPDATE USING (clerk_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can see their chat rooms" ON chat_rooms
  FOR SELECT USING (
    id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

CREATE POLICY "Users can see room participants" ON room_participants
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

CREATE POLICY "Users can see messages in their rooms" ON messages
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

CREATE POLICY "Users can send messages to their rooms" ON messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') AND
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

CREATE POLICY "Users can see their friendships" ON friendships
  FOR SELECT USING (
    requester_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
  );

-- Helper Functions

-- Upsert user on login (called from your app)
CREATE OR REPLACE FUNCTION upsert_messenger_user(
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
$$ LANGUAGE plpgsql;

-- Get or create direct message room between two users
CREATE OR REPLACE FUNCTION get_or_create_dm_room(user1_clerk_id TEXT, user2_clerk_id TEXT)
RETURNS UUID AS $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  room_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM messenger_users WHERE clerk_id = user1_clerk_id;
  SELECT id INTO user2_id FROM messenger_users WHERE clerk_id = user2_clerk_id;
  
  -- Check if room already exists
  SELECT cr.id INTO room_id
  FROM chat_rooms cr
  WHERE cr.room_type = 'direct'
    AND cr.id IN (
      SELECT rp1.room_id 
      FROM room_participants rp1
      JOIN room_participants rp2 ON rp1.room_id = rp2.room_id
      WHERE rp1.user_id = user1_id AND rp2.user_id = user2_id
        AND rp1.is_active = true AND rp2.is_active = true
    );
  
  -- Create room if it doesn't exist
  IF room_id IS NULL THEN
    INSERT INTO chat_rooms (room_type, created_by) 
    VALUES ('direct', user1_id) 
    RETURNING id INTO room_id;
    
    -- Add both users to the room
    INSERT INTO room_participants (room_id, user_id) VALUES (room_id, user1_id);
    INSERT INTO room_participants (room_id, user_id) VALUES (room_id, user2_id);
  END IF;
  
  RETURN room_id;
END;
$$ LANGUAGE plpgsql;

-- Send a message
CREATE OR REPLACE FUNCTION send_message(
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
  
  -- Insert message
  INSERT INTO messages (room_id, sender_id, content, message_type, reply_to_id)
  VALUES (room_id, sender_id, content, message_type, reply_to_id)
  RETURNING id INTO message_id;
  
  -- Update room timestamp
  UPDATE chat_rooms SET updated_at = NOW() WHERE id = room_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup expired messages (if using ephemeral messages)
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM messages 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Test data
INSERT INTO messenger_users (clerk_id, username, display_name, email) VALUES
('user_test1', 'alice', 'Alice Crypto', 'alice@test.com'),
('user_test2', 'bob', 'Bob Secure', 'bob@test.com')
ON CONFLICT (clerk_id) DO NOTHING;

-- Success
SELECT 'Simplified 101Messenger with Clerk Integration deployed successfully!' AS status;
