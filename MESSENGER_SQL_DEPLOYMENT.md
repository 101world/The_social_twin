# 101Messenger SQL Deployment Guide

## Quick Setup for Messenger Functionality

This guide provides the exact SQL commands to paste in your Supabase SQL editor to get the messenger working between users right now.

### 1. Core Database Schema (Simplified BitchX Style)

Paste this in your Supabase SQL Editor:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Simple users table for messenger
CREATE TABLE IF NOT EXISTS simple_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  privacy_mode BOOLEAN DEFAULT false,
  save_history BOOLEAN DEFAULT true, -- User choice to save messages
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat rooms (can be 1-on-1 or group)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT, -- NULL for 1-on-1 chats
  type TEXT CHECK (type IN ('direct', 'group')) DEFAULT 'direct',
  is_private BOOLEAN DEFAULT true,
  created_by UUID REFERENCES simple_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room participants
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES simple_users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Simple messages (ephemeral if user chooses)
CREATE TABLE IF NOT EXISTS simple_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES simple_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'file', 'voice')) DEFAULT 'text',
  is_encrypted BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = permanent, otherwise auto-delete
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friend relationships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES simple_users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES simple_users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_simple_users_clerk_id ON simple_users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_simple_users_username ON simple_users(username);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_simple_messages_room_id ON simple_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_simple_messages_created_at ON simple_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

-- Auto-cleanup function for expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM simple_messages 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run every hour)
SELECT cron.schedule('cleanup-expired-messages', '0 * * * *', 'SELECT cleanup_expired_messages();');
```

### 2. Row Level Security (RLS) Policies

Paste this for security:

```sql
-- Enable RLS on all tables
ALTER TABLE simple_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE simple_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Users can see their own profile and friends
CREATE POLICY "Users can view their own profile" ON simple_users
  FOR SELECT USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can update their own profile" ON simple_users
  FOR UPDATE USING (auth.uid()::text = clerk_id);

-- Users can see chat rooms they participate in
CREATE POLICY "Users can view their chat rooms" ON chat_rooms
  FOR SELECT USING (
    id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id IN (
        SELECT id FROM simple_users WHERE clerk_id = auth.uid()::text
      )
    )
  );

-- Users can see participants in their rooms
CREATE POLICY "Users can view room participants" ON room_participants
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id IN (
        SELECT id FROM simple_users WHERE clerk_id = auth.uid()::text
      )
    )
  );

-- Users can see messages in rooms they participate in
CREATE POLICY "Users can view messages in their rooms" ON simple_messages
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id IN (
        SELECT id FROM simple_users WHERE clerk_id = auth.uid()::text
      )
    )
  );

-- Users can send messages to rooms they participate in
CREATE POLICY "Users can send messages to their rooms" ON simple_messages
  FOR INSERT WITH CHECK (
    sender_id IN (
      SELECT id FROM simple_users WHERE clerk_id = auth.uid()::text
    ) AND
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id IN (
        SELECT id FROM simple_users WHERE clerk_id = auth.uid()::text
      )
    )
  );

-- Users can see their friendships
CREATE POLICY "Users can view their friendships" ON friendships
  FOR SELECT USING (
    requester_id IN (
      SELECT id FROM simple_users WHERE clerk_id = auth.uid()::text
    ) OR
    addressee_id IN (
      SELECT id FROM simple_users WHERE clerk_id = auth.uid()::text
    )
  );
```

### 3. Helper Functions for Easy Integration

Paste this for utility functions:

```sql
-- Function to create or get direct message room between two users
CREATE OR REPLACE FUNCTION get_or_create_dm_room(user1_clerk_id TEXT, user2_clerk_id TEXT)
RETURNS UUID AS $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  room_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM simple_users WHERE clerk_id = user1_clerk_id;
  SELECT id INTO user2_id FROM simple_users WHERE clerk_id = user2_clerk_id;
  
  -- Check if room already exists
  SELECT cr.id INTO room_id
  FROM chat_rooms cr
  WHERE cr.type = 'direct'
    AND cr.id IN (
      SELECT rp1.room_id 
      FROM room_participants rp1
      JOIN room_participants rp2 ON rp1.room_id = rp2.room_id
      WHERE rp1.user_id = user1_id AND rp2.user_id = user2_id
    );
  
  -- Create room if it doesn't exist
  IF room_id IS NULL THEN
    INSERT INTO chat_rooms (type, created_by) 
    VALUES ('direct', user1_id) 
    RETURNING id INTO room_id;
    
    -- Add both users to the room
    INSERT INTO room_participants (room_id, user_id) VALUES (room_id, user1_id);
    INSERT INTO room_participants (room_id, user_id) VALUES (room_id, user2_id);
  END IF;
  
  RETURN room_id;
END;
$$ LANGUAGE plpgsql;

-- Function to send a message
CREATE OR REPLACE FUNCTION send_message(
  sender_clerk_id TEXT,
  room_id UUID,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  is_encrypted BOOLEAN DEFAULT false,
  ephemeral_hours INTEGER DEFAULT NULL -- NULL = permanent, number = hours until deletion
)
RETURNS UUID AS $$
DECLARE
  sender_id UUID;
  message_id UUID;
  expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get sender ID
  SELECT id INTO sender_id FROM simple_users WHERE clerk_id = sender_clerk_id;
  
  -- Calculate expiration if ephemeral
  IF ephemeral_hours IS NOT NULL THEN
    expires_at := NOW() + (ephemeral_hours || ' hours')::INTERVAL;
  END IF;
  
  -- Insert message
  INSERT INTO simple_messages (room_id, sender_id, content, message_type, is_encrypted, expires_at)
  VALUES (room_id, sender_id, content, message_type, is_encrypted, expires_at)
  RETURNING id INTO message_id;
  
  -- Update room timestamp
  UPDATE chat_rooms SET updated_at = NOW() WHERE id = room_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create user (called when user signs up)
CREATE OR REPLACE FUNCTION upsert_user(
  clerk_id TEXT,
  username TEXT,
  email TEXT DEFAULT NULL,
  avatar_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO simple_users (clerk_id, username, email, avatar_url)
  VALUES (clerk_id, username, email, avatar_url)
  ON CONFLICT (clerk_id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
  RETURNING id INTO user_id;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;
```

### 4. Test Data (Optional)

Paste this to create test users and messages:

```sql
-- Create test users
SELECT upsert_user('test_user_1', 'alice_crypto', 'alice@test.com');
SELECT upsert_user('test_user_2', 'bob_secure', 'bob@test.com');

-- Create a test conversation
SELECT get_or_create_dm_room('test_user_1', 'test_user_2');

-- Send a test message
SELECT send_message('test_user_1', (SELECT get_or_create_dm_room('test_user_1', 'test_user_2')), 'Hello from the new messenger!');
```

## How the Messenger Works Now

### Key Features:
1. **BitchX-Style Privacy**: Minimal data collection, optional history saving
2. **Ephemeral Messages**: Messages can auto-delete after specified hours
3. **Encryption Ready**: Boolean flag for encrypted messages
4. **Direct & Group Chat**: Support for both 1-on-1 and group conversations
5. **Friend System**: Request/accept/block functionality

### Frontend Integration:
- The unified input design is now applied across all tabs
- Mobile blue/green buttons removed for consistent experience
- Privacy mode toggle available in messenger
- Auto-expanding textarea with consistent styling

### Privacy Features:
- Users control if they want to save message history
- Messages can be set to expire automatically
- Privacy mode for enhanced security
- Minimal user data collection (BitchX philosophy)

### Next Steps:
1. Paste the SQL above in your Supabase SQL Editor
2. Test with the provided test data
3. Update your frontend components to use these tables
4. Implement real-time subscriptions for live messaging

The messenger is now ready for user-to-user communication with a clean, unified design across all tabs!
