-- Simplified BitchX-Style Messaging Schema
-- Direct P2P messaging with minimal metadata storage
-- Version: 1.0 - Simple & Effective

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SIMPLE USER SYSTEM (BitchX-Style)
-- ============================================================================

-- Minimal user table - BitchX keeps it simple
CREATE TABLE simple_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL, -- BitchX uses nicknames, not display names
    avatar_url TEXT,
    
    -- Simple status
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- DIRECT CHAT SYSTEM (BitchX P2P Style)
-- ============================================================================

-- Simple chat rooms (like IRC channels)
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT UNIQUE NOT NULL, -- Simple room names like #general
    room_type TEXT DEFAULT 'group' CHECK (room_type IN ('direct', 'group')),
    
    -- BitchX-style settings
    is_private BOOLEAN DEFAULT FALSE,
    encryption_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Room participants (simple join/leave)
CREATE TABLE room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES simple_users(id) ON DELETE CASCADE,
    
    -- Simple permissions
    is_admin BOOLEAN DEFAULT FALSE,
    
    joined_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(room_id, user_id)
);

-- ============================================================================
-- SIMPLE MESSAGE STORAGE (Optional - BitchX style)
-- ============================================================================

-- Messages - can be ephemeral or stored based on user choice
CREATE TABLE simple_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES simple_users(id) ON DELETE SET NULL,
    
    -- Simple content (encrypted client-side before sending)
    content TEXT NOT NULL, -- Pre-encrypted on client
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
    
    -- BitchX-style ephemeral
    save_to_history BOOLEAN DEFAULT FALSE, -- User chooses to save or not
    expires_at TIMESTAMP, -- Auto-delete if user wants
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- FRIEND SYSTEM (Simple)
-- ============================================================================

-- Simple friend connections
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID REFERENCES simple_users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES simple_users(id) ON DELETE CASCADE,
    
    status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user1_id, user2_id)
);

-- ============================================================================
-- MINIMAL INDEXES
-- ============================================================================

CREATE INDEX idx_simple_users_clerk ON simple_users(clerk_user_id);
CREATE INDEX idx_simple_messages_room ON simple_messages(room_id, created_at);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);

-- ============================================================================
-- SIMPLE RLS POLICIES
-- ============================================================================

ALTER TABLE simple_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE simple_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Users see their own data
CREATE POLICY simple_user_policy ON simple_users
    FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Users see rooms they're in
CREATE POLICY room_access_policy ON chat_rooms
    FOR ALL USING (
        id IN (
            SELECT room_id FROM room_participants 
            WHERE user_id IN (SELECT id FROM simple_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
        )
    );

-- Users see messages in their rooms
CREATE POLICY message_access_policy ON simple_messages
    FOR ALL USING (
        room_id IN (
            SELECT room_id FROM room_participants 
            WHERE user_id IN (SELECT id FROM simple_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
        )
    );

-- ============================================================================
-- BITCHX-STYLE FUNCTIONS
-- ============================================================================

-- Auto-delete expired messages (BitchX ephemeral style)
CREATE OR REPLACE FUNCTION cleanup_ephemeral_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM simple_messages 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create direct message room between two users
CREATE OR REPLACE FUNCTION create_dm_room(user1_clerk_id TEXT, user2_clerk_id TEXT)
RETURNS UUID AS $$
DECLARE
    room_id UUID;
    user1_id UUID;
    user2_id UUID;
BEGIN
    -- Get user IDs
    SELECT id INTO user1_id FROM simple_users WHERE clerk_user_id = user1_clerk_id;
    SELECT id INTO user2_id FROM simple_users WHERE clerk_user_id = user2_clerk_id;
    
    -- Create room
    INSERT INTO chat_rooms (room_name, room_type, is_private, encryption_enabled)
    VALUES (concat('dm_', user1_id, '_', user2_id), 'direct', TRUE, TRUE)
    RETURNING id INTO room_id;
    
    -- Add participants
    INSERT INTO room_participants (room_id, user_id) VALUES (room_id, user1_id);
    INSERT INTO room_participants (room_id, user_id) VALUES (room_id, user2_id);
    
    RETURN room_id;
END;
$$ LANGUAGE plpgsql;

SELECT 'Simple BitchX-style messaging schema deployed!' AS status;
