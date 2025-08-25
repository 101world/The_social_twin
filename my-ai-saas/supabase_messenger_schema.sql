-- 101Messenger Database Schema
-- Privacy-first messaging system with end-to-end encryption support

-- Users table (extends Clerk users)
CREATE TABLE IF NOT EXISTS messenger_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  privacy_settings JSONB DEFAULT '{"show_online_status": true, "allow_friend_requests": true}',
  notification_settings JSONB DEFAULT '{"message_notifications": true, "call_notifications": true}',
  encryption_public_key TEXT, -- For E2E encryption
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friend relationships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Communities/Groups
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  owner_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'public' CHECK (type IN ('public', 'private', 'secret')),
  max_members INTEGER DEFAULT 1000,
  settings JSONB DEFAULT '{"allow_invite": true, "moderation_enabled": true}',
  encryption_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community members
CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(community_id, user_id)
);

-- Conversations (can be direct messages or group chats)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'community')),
  name TEXT, -- null for direct messages
  avatar_url TEXT,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE, -- if type is 'community'
  encryption_enabled BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{"auto_delete_after": null, "read_receipts": true}',
  created_by UUID REFERENCES messenger_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_pinned BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  content TEXT, -- encrypted content for E2E, plain text otherwise
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'voice', 'video', 'system')),
  media_url TEXT, -- for image/file/voice/video messages
  media_metadata JSONB, -- file size, dimensions, duration, etc.
  is_encrypted BOOLEAN DEFAULT FALSE,
  encryption_key_id TEXT, -- reference to key used for encryption
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Voice/Video calls
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  initiator_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'declined')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0
);

-- Call participants
CREATE TABLE IF NOT EXISTS call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'joined', 'left', 'declined')),
  UNIQUE(call_id, user_id)
);

-- Encryption keys for E2E encryption
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id TEXT UNIQUE NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  key_data TEXT NOT NULL, -- encrypted key material
  algorithm TEXT DEFAULT 'AES-256-GCM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messenger_users_clerk_id ON messenger_users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_messenger_users_username ON messenger_users(username);
CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(requester_id, addressee_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);

-- Row Level Security (RLS) policies
ALTER TABLE messenger_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own data and public profiles
CREATE POLICY "Users can view their own profile" ON messenger_users
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can view public profiles" ON messenger_users
  FOR SELECT USING (true);

-- Friends policies
CREATE POLICY "Users can manage their friendships" ON friendships
  FOR ALL USING (
    requester_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub') OR
    addressee_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
  );

-- Community policies
CREATE POLICY "Public communities are viewable" ON communities
  FOR SELECT USING (type = 'public');

CREATE POLICY "Community members can view their communities" ON communities
  FOR SELECT USING (
    id IN (
      SELECT community_id FROM community_members 
      WHERE user_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
    )
  );

-- Message policies - users can only see messages in conversations they're part of
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants 
      WHERE user_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
      AND left_at IS NULL
    )
  );

-- Users can send messages to conversations they're part of
CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants 
      WHERE user_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
      AND left_at IS NULL
    ) AND
    sender_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
  );

-- Functions for real-time notifications
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_message',
    json_build_object(
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'message_id', NEW.id,
      'content_type', NEW.content_type
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for message notifications
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Function to update user last seen
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE messenger_users 
  SET last_seen = NOW(), updated_at = NOW()
  WHERE id = NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last seen on message send
CREATE TRIGGER update_last_seen_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_seen();

-- Function to automatically create user profile from Clerk
CREATE OR REPLACE FUNCTION create_messenger_user_from_clerk()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO messenger_users (clerk_user_id, username, display_name, avatar_url)
  VALUES (
    NEW.clerk_user_id,
    COALESCE(NEW.username, 'user_' || substr(NEW.clerk_user_id, 1, 8)),
    COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.username),
    NEW.profile_image_url
  )
  ON CONFLICT (clerk_user_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
