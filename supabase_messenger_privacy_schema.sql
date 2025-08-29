-- 101Messenger Privacy-First Database Schema
-- Inspired by BitchX anti-surveillance architecture
-- Version: 2.0 - Enhanced Privacy Edition

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PRIVACY-FIRST USER SYSTEM
-- ============================================================================

-- User identity with privacy controls
CREATE TABLE messenger_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    
    -- Privacy settings
    privacy_level INTEGER DEFAULT 2, -- 1=basic, 2=enhanced, 3=anonymous
    allow_discovery BOOLEAN DEFAULT TRUE,
    anonymous_mode BOOLEAN DEFAULT FALSE,
    
    -- Anti-surveillance features
    identity_hash TEXT UNIQUE, -- For anonymous lookups
    public_key TEXT, -- For end-to-end encryption
    last_key_rotation TIMESTAMP DEFAULT NOW(),
    
    -- Status and metadata
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    status_message TEXT,
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Privacy-enhanced friend system
CREATE TABLE messenger_friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
    addressee_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
    
    -- Privacy controls
    privacy_mode INTEGER DEFAULT 1, -- 1=normal, 2=encrypted, 3=anonymous
    friendship_key TEXT, -- For friend-specific encryption
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(requester_id, addressee_id)
);

-- ============================================================================
-- ENCRYPTED CONVERSATION SYSTEM
-- ============================================================================

-- Privacy-first conversations
CREATE TABLE messenger_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Privacy and encryption
    conversation_type TEXT NOT NULL CHECK (conversation_type IN ('direct', 'group')),
    encryption_level INTEGER DEFAULT 2, -- 1=basic, 2=forward_secrecy, 3=anonymous
    participants_hash TEXT NOT NULL, -- Hash of sorted participant IDs (for privacy)
    
    -- BitchX-inspired features
    ephemeral_mode BOOLEAN DEFAULT FALSE,
    message_lifetime INTERVAL DEFAULT '7 days',
    auto_delete_enabled BOOLEAN DEFAULT FALSE,
    forward_secrecy_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata protection
    title TEXT, -- Only for groups, can be null for privacy
    description TEXT,
    avatar_url TEXT,
    
    -- Anti-surveillance
    traffic_padding BOOLEAN DEFAULT TRUE, -- Pad messages to standard sizes
    timing_obfuscation BOOLEAN DEFAULT TRUE, -- Random delays
    decoy_messages BOOLEAN DEFAULT FALSE, -- Generate fake traffic
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Participant management with privacy
CREATE TABLE messenger_conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
    
    -- Privacy controls per participant
    participant_alias TEXT, -- Anonymous identity within conversation
    encryption_key TEXT, -- Participant-specific encryption key
    
    -- Permissions and status
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Privacy settings
    anonymous_in_conversation BOOLEAN DEFAULT FALSE,
    message_retention_override INTERVAL, -- Override conversation retention
    
    UNIQUE(conversation_id, user_id)
);

-- ============================================================================
-- ENCRYPTED MESSAGE SYSTEM
-- ============================================================================

-- Messages with BitchX-level encryption
CREATE TABLE messenger_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE CASCADE,
    
    -- Sender identity (can be anonymous)
    sender_id UUID REFERENCES messenger_users(id) ON DELETE SET NULL,
    sender_alias TEXT, -- Anonymous sender identification
    
    -- Encrypted content (BitchX-style)
    encrypted_content BYTEA NOT NULL, -- Blowfish/AES encrypted message
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'voice', 'video', 'system')),
    encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
    
    -- Forward secrecy
    ephemeral_key_id UUID, -- Reference to ephemeral key used
    forward_secrecy_generation INTEGER DEFAULT 1,
    
    -- Anti-surveillance features
    message_padding BYTEA, -- Random padding for size obfuscation
    timing_salt BIGINT, -- For timing analysis protection
    decoy_flag BOOLEAN DEFAULT FALSE, -- Mark as decoy message
    
    -- Ephemeral controls
    expires_at TIMESTAMP, -- Auto-delete timestamp
    auto_delete_after INTERVAL, -- Relative expiry
    read_once BOOLEAN DEFAULT FALSE, -- Self-destruct after reading
    
    -- Metadata
    reply_to_id UUID REFERENCES messenger_messages(id),
    thread_id UUID REFERENCES messenger_messages(id),
    
    -- Status tracking
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deletion_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- EPHEMERAL KEY MANAGEMENT (BitchX-inspired)
-- ============================================================================

-- Perfect forward secrecy key system
CREATE TABLE messenger_ephemeral_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE CASCADE,
    
    -- Key data (encrypted with master key)
    key_data BYTEA NOT NULL, -- The actual encryption key (encrypted)
    algorithm TEXT DEFAULT 'AES-256-GCM',
    generation INTEGER NOT NULL, -- Key rotation generation
    
    -- Usage tracking
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 1000, -- Rotate after N uses
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    rotated_at TIMESTAMP
);

-- ============================================================================
-- MESSAGE STATUS WITH PRIVACY
-- ============================================================================

-- Message delivery and read status (privacy-aware)
CREATE TABLE messenger_message_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
    
    -- Status tracking
    status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    
    -- Privacy controls
    report_read_status BOOLEAN DEFAULT TRUE, -- User can disable read receipts
    anonymous_read BOOLEAN DEFAULT FALSE, -- Don't report identity when reading
    
    timestamp TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(message_id, user_id)
);

-- ============================================================================
-- ENCRYPTED FILE SYSTEM
-- ============================================================================

-- File attachments with encryption
CREATE TABLE messenger_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES messenger_users(id) ON DELETE SET NULL,
    
    -- File metadata
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    
    -- Encryption (BitchX-style)
    encrypted_data BYTEA, -- Encrypted file content
    encryption_key_id UUID REFERENCES messenger_ephemeral_keys(id),
    encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
    
    -- Storage options
    storage_url TEXT, -- External storage (encrypted)
    local_storage BOOLEAN DEFAULT TRUE,
    
    -- Security
    checksum TEXT NOT NULL, -- Integrity verification
    virus_scanned BOOLEAN DEFAULT FALSE,
    scan_result TEXT,
    
    -- Ephemeral controls
    expires_at TIMESTAMP,
    auto_delete BOOLEAN DEFAULT FALSE,
    
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- COMMUNITY SYSTEM WITH PRIVACY
-- ============================================================================

-- Privacy-aware community system
CREATE TABLE messenger_communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    
    -- Privacy settings
    privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'private', 'secret')),
    encryption_required BOOLEAN DEFAULT FALSE,
    anonymous_members BOOLEAN DEFAULT FALSE,
    
    -- Anti-surveillance
    member_count_hidden BOOLEAN DEFAULT FALSE,
    activity_tracking BOOLEAN DEFAULT TRUE,
    
    -- Ownership
    owner_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Community membership with privacy
CREATE TABLE messenger_community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES messenger_communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
    
    -- Privacy controls
    anonymous_membership BOOLEAN DEFAULT FALSE,
    member_alias TEXT, -- Anonymous identity in community
    
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
    joined_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(community_id, user_id)
);

-- ============================================================================
-- ENCRYPTION AUDIT LOG
-- ============================================================================

-- Track encryption events for security
CREATE TABLE messenger_encryption_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('key_rotation', 'encryption_upgrade', 'decryption_failure', 'security_alert')),
    
    -- Event details
    details JSONB,
    conversation_id UUID REFERENCES messenger_conversations(id) ON DELETE SET NULL,
    
    -- Privacy
    ip_address INET, -- For security monitoring
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- PRIVACY SETTINGS
-- ============================================================================

-- User privacy preferences
CREATE TABLE messenger_privacy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES messenger_users(id) ON DELETE CASCADE UNIQUE,
    
    -- Message privacy
    default_message_lifetime INTERVAL DEFAULT '30 days',
    auto_delete_messages BOOLEAN DEFAULT FALSE,
    read_receipts_enabled BOOLEAN DEFAULT TRUE,
    typing_indicators_enabled BOOLEAN DEFAULT TRUE,
    
    -- Discovery and visibility
    discoverable_by_email BOOLEAN DEFAULT TRUE,
    discoverable_by_phone BOOLEAN DEFAULT TRUE,
    show_online_status BOOLEAN DEFAULT TRUE,
    show_last_seen BOOLEAN DEFAULT TRUE,
    
    -- Advanced privacy (BitchX-inspired)
    force_encryption BOOLEAN DEFAULT TRUE,
    require_forward_secrecy BOOLEAN DEFAULT FALSE,
    enable_anonymous_mode BOOLEAN DEFAULT FALSE,
    traffic_obfuscation BOOLEAN DEFAULT FALSE,
    
    -- Security
    two_factor_required BOOLEAN DEFAULT FALSE,
    device_verification_required BOOLEAN DEFAULT FALSE,
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX idx_messenger_users_clerk_id ON messenger_users(clerk_user_id);
CREATE INDEX idx_messenger_users_identity_hash ON messenger_users(identity_hash);
CREATE INDEX idx_messenger_users_status ON messenger_users(status);

-- Conversation indexes
CREATE INDEX idx_messenger_conversations_participants_hash ON messenger_conversations(participants_hash);
CREATE INDEX idx_messenger_conversations_ephemeral ON messenger_conversations(ephemeral_mode, message_lifetime);

-- Message indexes
CREATE INDEX idx_messenger_messages_conversation ON messenger_messages(conversation_id, created_at);
CREATE INDEX idx_messenger_messages_sender ON messenger_messages(sender_id, created_at);
CREATE INDEX idx_messenger_messages_expires ON messenger_messages(expires_at) WHERE expires_at IS NOT NULL;

-- Ephemeral key indexes
CREATE INDEX idx_messenger_ephemeral_keys_conversation ON messenger_ephemeral_keys(conversation_id, generation);
CREATE INDEX idx_messenger_ephemeral_keys_expires ON messenger_ephemeral_keys(expires_at, is_active);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE messenger_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_privacy_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY user_privacy_policy ON messenger_users
    FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Friendship privacy
CREATE POLICY friendship_privacy_policy ON messenger_friendships
    FOR ALL USING (
        requester_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
        OR addressee_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
    );

-- Conversation privacy - only participants can access
CREATE POLICY conversation_privacy_policy ON messenger_conversations
    FOR ALL USING (
        id IN (
            SELECT conversation_id 
            FROM messenger_conversation_participants 
            WHERE user_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
            AND is_active = TRUE
        )
    );

-- Message privacy - only conversation participants
CREATE POLICY message_privacy_policy ON messenger_messages
    FOR ALL USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM messenger_conversation_participants 
            WHERE user_id IN (SELECT id FROM messenger_users WHERE clerk_user_id = auth.jwt() ->> 'sub')
            AND is_active = TRUE
        )
    );

-- ============================================================================
-- PRIVACY FUNCTIONS
-- ============================================================================

-- Function to generate anonymous identity hash
CREATE OR REPLACE FUNCTION generate_identity_hash(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(user_id::text || extract(epoch from now())::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to create participants hash for privacy
CREATE OR REPLACE FUNCTION create_participants_hash(participant_ids UUID[])
RETURNS TEXT AS $$
DECLARE
    sorted_ids UUID[];
BEGIN
    -- Sort UUIDs for consistent hashing
    SELECT array_agg(id ORDER BY id) INTO sorted_ids FROM unnest(participant_ids) AS id;
    RETURN encode(digest(array_to_string(sorted_ids, ','), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to rotate ephemeral keys
CREATE OR REPLACE FUNCTION rotate_ephemeral_key(conversation_uuid UUID)
RETURNS UUID AS $$
DECLARE
    new_key_id UUID;
BEGIN
    -- Mark old keys as inactive
    UPDATE messenger_ephemeral_keys 
    SET is_active = FALSE, rotated_at = NOW()
    WHERE conversation_id = conversation_uuid AND is_active = TRUE;
    
    -- Create new ephemeral key
    INSERT INTO messenger_ephemeral_keys (
        conversation_id, 
        key_data, 
        generation, 
        expires_at
    ) VALUES (
        conversation_uuid,
        gen_random_bytes(32), -- 256-bit key
        COALESCE((SELECT MAX(generation) FROM messenger_ephemeral_keys WHERE conversation_id = conversation_uuid), 0) + 1,
        NOW() + INTERVAL '24 hours'
    ) RETURNING id INTO new_key_id;
    
    RETURN new_key_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired messages (BitchX-style)
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired messages
    DELETE FROM messenger_messages 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean up ephemeral keys
    DELETE FROM messenger_ephemeral_keys 
    WHERE expires_at < NOW() AND is_active = FALSE;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR PRIVACY AUTOMATION
-- ============================================================================

-- Auto-generate identity hash for new users
CREATE OR REPLACE FUNCTION auto_generate_identity_hash()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.identity_hash IS NULL THEN
        NEW.identity_hash = generate_identity_hash(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_identity_hash
    BEFORE INSERT ON messenger_users
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_identity_hash();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_timestamp
    BEFORE UPDATE ON messenger_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_conversations_timestamp
    BEFORE UPDATE ON messenger_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE messenger_users IS 'Privacy-first user system with BitchX-inspired anonymity features';
COMMENT ON TABLE messenger_conversations IS 'Encrypted conversations with ephemeral messaging and forward secrecy';
COMMENT ON TABLE messenger_messages IS 'End-to-end encrypted messages with auto-expiry and anti-surveillance features';
COMMENT ON TABLE messenger_ephemeral_keys IS 'Perfect forward secrecy key rotation system inspired by BitchX';

COMMENT ON COLUMN messenger_conversations.participants_hash IS 'SHA256 hash of sorted participant IDs for privacy';
COMMENT ON COLUMN messenger_messages.encrypted_content IS 'Message encrypted with Blowfish/AES before storage';
COMMENT ON COLUMN messenger_messages.timing_salt IS 'Random value for timing analysis protection';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default privacy settings template
INSERT INTO messenger_privacy_settings (
    user_id,
    default_message_lifetime,
    auto_delete_messages,
    force_encryption,
    require_forward_secrecy,
    traffic_obfuscation
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- Template UUID
    INTERVAL '30 days',
    FALSE,
    TRUE,
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- Success message
SELECT 'BitchX-inspired 101Messenger privacy database schema deployed successfully!' AS status;
