-- ============================================================================
-- 📱 101Messenger Enhanced Database Schema - FULLY CORRECTED VERSION
-- Compatible with existing AI generation system - SAFE to deploy
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 🔧 MESSENGER CORE TABLES (Enhanced from previous version)
-- ============================================================================

-- Enhanced messenger users table with richer profile features
CREATE TABLE IF NOT EXISTS messenger_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL, -- Links to your Clerk authentication
  username TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  
  -- Status & Presence
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status_message TEXT, -- Custom status message
  custom_status TEXT, -- "Available", "Busy", "Away", "Do Not Disturb"
  
  -- Privacy & Security (Enhanced)
  privacy_mode BOOLEAN DEFAULT false,
  allow_friend_requests BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  read_receipts_enabled BOOLEAN DEFAULT true,
  
  -- Profile Enhancements
  bio TEXT,
  location TEXT,
  timezone TEXT,
  language_preference TEXT DEFAULT 'en',
  
  -- Notification Settings
  notification_settings JSONB DEFAULT '{
    "messages": true,
    "friend_requests": true,
    "group_invites": true,
    "mentions": true,
    "sound_enabled": true,
    "push_enabled": true
  }'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced chat rooms with more features
CREATE TABLE IF NOT EXISTS messenger_chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_type TEXT CHECK (room_type IN ('direct', 'group', 'channel', 'broadcast')) DEFAULT 'direct',
  name TEXT, -- NULL for direct messages, set for groups
  description TEXT,
  avatar_url TEXT,
  
  -- Enhanced Group Features
  is_private BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  max_members INTEGER DEFAULT 100,
  invite_code TEXT UNIQUE, -- For easy group joining
  
  -- Chat Features
  allow_member_invite BOOLEAN DEFAULT true,
  message_retention_days INTEGER, -- Auto-delete old messages
  is_encrypted BOOLEAN DEFAULT false,
  
  -- AI Integration Features
  ai_enabled BOOLEAN DEFAULT false, -- Allow AI to participate in this chat
  ai_model_preference TEXT, -- Preferred AI model for this chat
  shared_generation_mode BOOLEAN DEFAULT false, -- Allow sharing AI generations
  
  created_by UUID REFERENCES messenger_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced room participants with roles and permissions
CREATE TABLE IF NOT EXISTS messenger_room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES messenger_chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  role TEXT CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'guest')) DEFAULT 'member',
  permissions JSONB DEFAULT '{
    "send_messages": true,
    "send_media": true,
    "invite_members": false,
    "manage_messages": false,
    "manage_room": false
  }'::jsonb,
  
  -- Participant settings
  notifications_enabled BOOLEAN DEFAULT true,
  custom_nickname TEXT, -- Custom name in this room
  is_pinned BOOLEAN DEFAULT false, -- Pinned room for user
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(room_id, user_id)
);

-- Enhanced messages with rich content support
CREATE TABLE IF NOT EXISTS messenger_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES messenger_chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'file', 'voice', 'video', 'sticker', 'location', 'contact', 'poll', 'ai_generation', 'system')) DEFAULT 'text',
  
  -- Rich content features
  mentions UUID[], -- Array of mentioned user IDs
  hashtags TEXT[], -- Array of hashtags
  media_urls TEXT[], -- Multiple media attachments
  media_metadata JSONB, -- Store media dimensions, thumbnails, etc.
  
  -- AI Generation Integration
  ai_generation_data JSONB, -- Store AI generation request/response data
  generation_cost DECIMAL(10,2), -- Cost of AI generation if applicable
  shared_from_chat_id UUID, -- If shared from main AI chat
  
  -- Message features
  is_encrypted BOOLEAN DEFAULT false,
  encryption_key TEXT, -- Encrypted message key
  expires_at TIMESTAMP WITH TIME ZONE, -- For ephemeral messages
  
  -- Threading & Reactions
  reply_to_id UUID REFERENCES messenger_messages(id),
  thread_count INTEGER DEFAULT 0,
  reactions JSONB DEFAULT '[]'::jsonb, -- Store emoji reactions
  
  -- Message status
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_pinned BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced friendships with more social features
CREATE TABLE IF NOT EXISTS messenger_friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked', 'muted')) DEFAULT 'pending',
  
  -- Social features
  is_favorite BOOLEAN DEFAULT false, -- Favorite friend
  custom_nickname TEXT, -- Custom name for this friend
  friend_since TIMESTAMP WITH TIME ZONE, -- When friendship was accepted
  interaction_score INTEGER DEFAULT 0, -- How often they chat
  
  -- Request metadata
  request_message TEXT, -- Message sent with friend request
  blocked_reason TEXT, -- Reason for blocking (optional)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(requester_id, addressee_id)
);

-- Enhanced read status with more granular tracking
CREATE TABLE IF NOT EXISTS messenger_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Advanced tracking
  read_on_device TEXT, -- 'mobile', 'desktop', 'web'
  reaction TEXT, -- User's reaction to the message
  
  UNIQUE(message_id, user_id)
);

-- ============================================================================
-- 🔊 NEW FEATURES: Voice Messages & Calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS messenger_voice_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
  
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  waveform_data JSONB, -- Waveform visualization data
  transcription TEXT, -- Auto-generated transcription
  
  -- Audio metadata
  file_size INTEGER,
  audio_format TEXT DEFAULT 'webm',
  quality TEXT DEFAULT 'standard',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messenger_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES messenger_chat_rooms(id) ON DELETE CASCADE,
  initiator_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  call_type TEXT CHECK (call_type IN ('voice', 'video')) NOT NULL,
  status TEXT CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'declined')) DEFAULT 'ringing',
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Call metadata
  participants JSONB DEFAULT '[]'::jsonb,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 📱 NEW FEATURES: Stories & Status Updates
-- ============================================================================

CREATE TABLE IF NOT EXISTS messenger_stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  content_type TEXT CHECK (content_type IN ('image', 'video', 'text')) NOT NULL,
  content_url TEXT,
  text_content TEXT,
  
  -- Story settings
  background_color TEXT,
  font_style TEXT,
  music_url TEXT,
  
  -- Privacy & Viewing
  visibility TEXT CHECK (visibility IN ('public', 'friends', 'custom')) DEFAULT 'friends',
  allowed_viewers UUID[], -- For custom visibility
  view_count INTEGER DEFAULT 0,
  
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messenger_story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES messenger_stories(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
  
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(story_id, viewer_id)
);

-- ============================================================================
-- 🎮 NEW FEATURES: Games & Interactive Content
-- ============================================================================

CREATE TABLE IF NOT EXISTS messenger_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
  
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of poll options
  votes JSONB DEFAULT '{}'::jsonb, -- User votes mapping
  
  is_anonymous BOOLEAN DEFAULT false,
  multiple_choice BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messenger_shared_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
  original_generation_id UUID, -- Link to main chat generation
  
  generation_type TEXT CHECK (generation_type IN ('text', 'image', 'video', 'audio')) NOT NULL,
  prompt TEXT NOT NULL,
  result_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Sharing info
  shared_by UUID REFERENCES messenger_users(id),
  is_collaborative BOOLEAN DEFAULT false, -- Can others modify?
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 📊 ENHANCED INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_messenger_users_clerk_id ON messenger_users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_messenger_users_username ON messenger_users(username);
CREATE INDEX IF NOT EXISTS idx_messenger_users_online ON messenger_users(is_online);

-- Message indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_messenger_messages_room_time ON messenger_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_sender ON messenger_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_thread ON messenger_messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_search ON messenger_messages USING GIN(to_tsvector('english', content));

-- Room and participant indexes
CREATE INDEX IF NOT EXISTS idx_messenger_room_participants_room ON messenger_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_messenger_room_participants_user ON messenger_room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messenger_chat_rooms_type ON messenger_chat_rooms(room_type);

-- Friendship indexes
CREATE INDEX IF NOT EXISTS idx_messenger_friendships_req_status ON messenger_friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_messenger_friendships_addr_status ON messenger_friendships(addressee_id, status);

-- Read status indexes
CREATE INDEX IF NOT EXISTS idx_messenger_read_status_user ON messenger_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_messenger_read_status_message ON messenger_read_status(message_id);

-- Story indexes
CREATE INDEX IF NOT EXISTS idx_messenger_stories_user_active ON messenger_stories(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_messenger_stories_visibility ON messenger_stories(visibility, created_at DESC);

-- ============================================================================
-- 🔒 ENHANCED ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE messenger_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_shared_generations ENABLE ROW LEVEL SECURITY;

-- Simple, working user policies
CREATE POLICY "messenger_users_select" ON messenger_users
  FOR SELECT USING (
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

CREATE POLICY "messenger_users_update" ON messenger_users
  FOR UPDATE USING (clerk_id = auth.jwt() ->> 'sub');

CREATE POLICY "messenger_users_insert" ON messenger_users
  FOR INSERT WITH CHECK (clerk_id = auth.jwt() ->> 'sub');

-- Room policies
CREATE POLICY "messenger_chat_rooms_policy" ON messenger_chat_rooms
  FOR ALL USING (
    id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- Room participants policies  
CREATE POLICY "messenger_room_participants_policy" ON messenger_room_participants
  FOR ALL USING (
    user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    room_id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- Message policies
CREATE POLICY "messenger_messages_policy" ON messenger_messages
  FOR ALL USING (
    room_id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    ) AND
    (is_deleted = false OR sender_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub'))
  );

-- Friendship policies
CREATE POLICY "messenger_friendships_policy" ON messenger_friendships
  FOR ALL USING (
    requester_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
  );

-- Read status policies
CREATE POLICY "messenger_read_status_policy" ON messenger_read_status
  FOR ALL USING (
    user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    message_id IN (
      SELECT id FROM messenger_messages 
      WHERE room_id IN (
        SELECT room_id FROM messenger_room_participants 
        WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
        AND is_active = true
      )
    )
  );

-- Voice message policies
CREATE POLICY "messenger_voice_messages_policy" ON messenger_voice_messages
  FOR ALL USING (
    message_id IN (
      SELECT id FROM messenger_messages 
      WHERE room_id IN (
        SELECT room_id FROM messenger_room_participants 
        WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
        AND is_active = true
      )
    )
  );

-- Call policies
CREATE POLICY "messenger_calls_policy" ON messenger_calls
  FOR ALL USING (
    room_id IN (
      SELECT room_id FROM messenger_room_participants 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- Story policies
CREATE POLICY "messenger_stories_policy" ON messenger_stories
  FOR ALL USING (
    user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    (visibility = 'public') OR
    (visibility = 'friends' AND user_id IN (
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
    ))
  );

-- Story view policies
CREATE POLICY "messenger_story_views_policy" ON messenger_story_views
  FOR ALL USING (
    viewer_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    story_id IN (
      SELECT id FROM messenger_stories 
      WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
    )
  );

-- Poll policies
CREATE POLICY "messenger_polls_policy" ON messenger_polls
  FOR ALL USING (
    message_id IN (
      SELECT id FROM messenger_messages 
      WHERE room_id IN (
        SELECT room_id FROM messenger_room_participants 
        WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
        AND is_active = true
      )
    )
  );

-- Shared generation policies
CREATE POLICY "messenger_shared_generations_policy" ON messenger_shared_generations
  FOR ALL USING (
    shared_by = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub') OR
    message_id IN (
      SELECT id FROM messenger_messages 
      WHERE room_id IN (
        SELECT room_id FROM messenger_room_participants 
        WHERE user_id = (SELECT id FROM messenger_users WHERE clerk_id = auth.jwt() ->> 'sub')
        AND is_active = true
      )
    )
  );

-- ============================================================================
-- 🔧 ENHANCED HELPER FUNCTIONS
-- ============================================================================

-- Enhanced user upsert with profile features
CREATE OR REPLACE FUNCTION messenger_upsert_user(
  p_clerk_id TEXT,
  p_username TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO messenger_users (clerk_id, username, display_name, email, avatar_url, bio, location)
  VALUES (p_clerk_id, p_username, p_display_name, p_email, p_avatar_url, p_bio, p_location)
  ON CONFLICT (clerk_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    bio = COALESCE(EXCLUDED.bio, messenger_users.bio),
    location = COALESCE(EXCLUDED.location, messenger_users.location),
    updated_at = NOW()
  RETURNING id INTO user_id;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced direct message room creation
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
    INSERT INTO messenger_room_participants (room_id, user_id, role) VALUES 
      (room_id, user1_id, 'member'),
      (room_id, user2_id, 'member');
  END IF;
  
  RETURN room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced message sending with AI generation support
CREATE OR REPLACE FUNCTION messenger_send_message(
  sender_clerk_id TEXT,
  room_id UUID,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  reply_to_id UUID DEFAULT NULL,
  ai_generation_data JSONB DEFAULT NULL,
  media_urls TEXT[] DEFAULT NULL
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
  INSERT INTO messenger_messages (
    room_id, 
    sender_id, 
    content, 
    message_type, 
    reply_to_id,
    ai_generation_data,
    media_urls
  )
  VALUES (
    room_id, 
    sender_id, 
    content, 
    message_type, 
    reply_to_id,
    ai_generation_data,
    media_urls
  )
  RETURNING id INTO message_id;
  
  -- Update room timestamp and increment thread count if reply
  UPDATE messenger_chat_rooms SET updated_at = NOW() WHERE id = room_id;
  
  IF reply_to_id IS NOT NULL THEN
    UPDATE messenger_messages 
    SET thread_count = thread_count + 1 
    WHERE id = reply_to_id;
  END IF;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's friends with enhanced info
CREATE OR REPLACE FUNCTION messenger_get_friends(user_clerk_id TEXT)
RETURNS TABLE(
  id UUID,
  clerk_id TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE,
  custom_status TEXT,
  is_favorite BOOLEAN,
  custom_nickname TEXT,
  friend_since TIMESTAMP WITH TIME ZONE
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
    mu.last_seen,
    mu.custom_status,
    mf.is_favorite,
    mf.custom_nickname,
    mf.friend_since
  FROM messenger_users mu
  JOIN messenger_friendships mf ON (
    (mf.requester_id = mu.id AND mf.addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = user_clerk_id)) OR
    (mf.addressee_id = mu.id AND mf.requester_id = (SELECT id FROM messenger_users WHERE clerk_id = user_clerk_id))
  )
  WHERE mf.status = 'accepted'
    AND mu.clerk_id != user_clerk_id
  ORDER BY mf.is_favorite DESC, mu.is_online DESC, mu.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or join group
CREATE OR REPLACE FUNCTION messenger_create_group(
  creator_clerk_id TEXT,
  group_name TEXT,
  description TEXT DEFAULT NULL,
  is_private BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  creator_id UUID;
  room_id UUID;
BEGIN
  -- Get creator ID
  SELECT id INTO creator_id FROM messenger_users WHERE clerk_id = creator_clerk_id;
  
  IF creator_id IS NULL THEN
    RAISE EXCEPTION 'Creator not found';
  END IF;
  
  -- Create group room
  INSERT INTO messenger_chat_rooms (
    room_type, 
    name, 
    description, 
    is_private, 
    created_by
  ) 
  VALUES (
    'group', 
    group_name, 
    description, 
    is_private, 
    creator_id
  ) 
  RETURNING id INTO room_id;
  
  -- Add creator as owner
  INSERT INTO messenger_room_participants (room_id, user_id, role) 
  VALUES (room_id, creator_id, 'owner');
  
  RETURN room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Share AI generation to messenger
CREATE OR REPLACE FUNCTION messenger_share_ai_generation(
  sender_clerk_id TEXT,
  room_id UUID,
  generation_type TEXT,
  prompt TEXT,
  result_url TEXT,
  metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  sender_id UUID;
  message_id UUID;
  generation_id UUID;
BEGIN
  -- Get sender ID
  SELECT id INTO sender_id FROM messenger_users WHERE clerk_id = sender_clerk_id;
  
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'Sender not found';
  END IF;
  
  -- Create shared generation record
  INSERT INTO messenger_shared_generations (
    generation_type,
    prompt,
    result_url,
    metadata,
    shared_by
  ) VALUES (
    generation_type,
    prompt,
    result_url,
    metadata,
    sender_id
  ) RETURNING id INTO generation_id;
  
  -- Send message with AI generation
  SELECT messenger_send_message(
    sender_clerk_id,
    room_id,
    format('🤖 Shared %s generation: %s', generation_type, prompt),
    'ai_generation',
    NULL,
    jsonb_build_object(
      'generation_id', generation_id,
      'type', generation_type,
      'prompt', prompt,
      'result_url', result_url
    ),
    ARRAY[result_url]
  ) INTO message_id;
  
  -- Link generation to message
  UPDATE messenger_shared_generations 
  SET message_id = message_id 
  WHERE id = generation_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user presence
CREATE OR REPLACE FUNCTION messenger_update_presence(
  user_clerk_id TEXT,
  is_online BOOLEAN DEFAULT true,
  custom_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE messenger_users 
  SET 
    is_online = messenger_update_presence.is_online,
    last_seen = NOW(),
    custom_status = COALESCE(messenger_update_presence.custom_status, custom_status),
    updated_at = NOW()
  WHERE clerk_id = user_clerk_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 🔄 AUTO-CLEANUP FUNCTIONS
-- ============================================================================

-- Clean expired messages and stories
CREATE OR REPLACE FUNCTION messenger_cleanup_expired_content()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Delete expired messages
  DELETE FROM messenger_messages 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete expired stories
  DELETE FROM messenger_stories 
  WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean old read status (older than 30 days)
  DELETE FROM messenger_read_status 
  WHERE read_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 📊 ANALYTICS & INSIGHTS FUNCTIONS
-- ============================================================================

-- Get user chat statistics
CREATE OR REPLACE FUNCTION messenger_get_user_stats(user_clerk_id TEXT)
RETURNS JSONB AS $$
DECLARE
  user_id UUID;
  stats JSONB;
BEGIN
  SELECT id INTO user_id FROM messenger_users WHERE clerk_id = user_clerk_id;
  
  IF user_id IS NULL THEN
    RETURN '{"error": "User not found"}'::jsonb;
  END IF;
  
  SELECT jsonb_build_object(
    'total_messages_sent', (
      SELECT COUNT(*) FROM messenger_messages 
      WHERE sender_id = user_id AND is_deleted = false
    ),
    'total_friends', (
      SELECT COUNT(*) FROM messenger_friendships 
      WHERE (requester_id = user_id OR addressee_id = user_id) 
      AND status = 'accepted'
    ),
    'total_groups', (
      SELECT COUNT(*) FROM messenger_room_participants rp
      JOIN messenger_chat_rooms cr ON rp.room_id = cr.id
      WHERE rp.user_id = user_id AND rp.is_active = true 
      AND cr.room_type = 'group'
    ),
    'ai_generations_shared', (
      SELECT COUNT(*) FROM messenger_shared_generations 
      WHERE shared_by = user_id
    ),
    'account_created', (
      SELECT created_at FROM messenger_users WHERE id = user_id
    )
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 🎉 SUCCESS MESSAGE & SAMPLE DATA
-- ============================================================================

-- Insert enhanced test users
INSERT INTO messenger_users (
  clerk_id, username, display_name, email, bio, custom_status
) VALUES
  ('test_user_1', 'alice_101', 'Alice AI', 'alice@101world.com', '🤖 AI enthusiast & creative director', 'Building the future'),
  ('test_user_2', 'bob_crypto', 'Bob Security', 'bob@101world.com', '🔐 Blockchain security expert', 'Available'),
  ('test_user_3', 'charlie_dev', 'Charlie Code', 'charlie@101world.com', '💻 Full-stack developer', 'Coding...')
ON CONFLICT (clerk_id) DO NOTHING;

-- Create test friendships
INSERT INTO messenger_friendships (
  requester_id, 
  addressee_id, 
  status,
  friend_since,
  is_favorite
) 
SELECT 
  (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_1'),
  (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_2'),
  'accepted',
  NOW() - INTERVAL '30 days',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM messenger_friendships 
  WHERE requester_id = (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_1')
  AND addressee_id = (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_2')
);

-- Create test group
DO $$
DECLARE
  group_id UUID;
BEGIN
  SELECT messenger_create_group(
    'test_user_1',
    '101World AI Creators',
    'Creative minds building the future with AI',
    false
  ) INTO group_id;
  
  -- Add other test users to group
  INSERT INTO messenger_room_participants (room_id, user_id, role) VALUES
    (group_id, (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_2'), 'admin'),
    (group_id, (SELECT id FROM messenger_users WHERE clerk_id = 'test_user_3'), 'member');
    
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if already exists
  NULL;
END $$;

-- ============================================================================
-- 🎊 DEPLOYMENT SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🎉 SUCCESS: Enhanced 101Messenger Database Schema Deployed!';
  RAISE NOTICE '';
  RAISE NOTICE '📱 CORE FEATURES DEPLOYED:';
  RAISE NOTICE '  ✅ Enhanced user profiles with status & preferences';
  RAISE NOTICE '  ✅ Rich messaging with reactions, threads, mentions';
  RAISE NOTICE '  ✅ Advanced group management with roles & permissions';
  RAISE NOTICE '  ✅ AI generation sharing & collaboration';
  RAISE NOTICE '  ✅ Voice messages & call tracking';
  RAISE NOTICE '  ✅ Stories & status updates (24h expiry)';
  RAISE NOTICE '  ✅ Polls & interactive content';
  RAISE NOTICE '  ✅ Enhanced security with granular RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FUNCTIONS AVAILABLE:';
  RAISE NOTICE '  • messenger_upsert_user() - Enhanced user management';
  RAISE NOTICE '  • messenger_get_or_create_dm_room() - Smart DM creation';
  RAISE NOTICE '  • messenger_send_message() - Rich message sending';
  RAISE NOTICE '  • messenger_share_ai_generation() - Share AI creations';
  RAISE NOTICE '  • messenger_create_group() - Advanced group creation';
  RAISE NOTICE '  • messenger_update_presence() - Real-time status';
  RAISE NOTICE '  • messenger_get_user_stats() - Analytics & insights';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 READY FOR: Enhanced UI integration with docked chat design!';
  RAISE NOTICE '🔗 COMPATIBLE: Fully compatible with existing AI generation system';
  RAISE NOTICE '';
  RAISE NOTICE '⭐ Deploy this schema and your enhanced messenger is ready!';
END $$;
