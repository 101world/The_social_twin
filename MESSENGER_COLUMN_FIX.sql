-- Quick fix for missing custom_status column
ALTER TABLE messenger_users ADD COLUMN IF NOT EXISTS custom_status TEXT;

-- Update the messenger_get_friends function to handle missing columns gracefully
DROP FUNCTION IF EXISTS messenger_get_friends(TEXT);
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
    COALESCE(mf.is_favorite, false) as is_favorite,
    mf.custom_nickname,
    mf.friend_since
  FROM messenger_users mu
  JOIN messenger_friendships mf ON (
    (mf.requester_id = mu.id AND mf.addressee_id = (SELECT mu2.id FROM messenger_users mu2 WHERE mu2.clerk_id = user_clerk_id)) OR
    (mf.addressee_id = mu.id AND mf.requester_id = (SELECT mu2.id FROM messenger_users mu2 WHERE mu2.clerk_id = user_clerk_id))
  )
  WHERE mf.status = 'accepted'
    AND mu.clerk_id != user_clerk_id
  ORDER BY COALESCE(mf.is_favorite, false) DESC, mu.is_online DESC, mu.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add any other missing columns that might be needed
ALTER TABLE messenger_users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE messenger_users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE messenger_users ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE messenger_users ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';
ALTER TABLE messenger_users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "messages": true,
  "friend_requests": true,
  "group_invites": true,
  "mentions": true,
  "sound_enabled": true,
  "push_enabled": true
}'::jsonb;

-- Add missing columns to friendships table
ALTER TABLE messenger_friendships ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE messenger_friendships ADD COLUMN IF NOT EXISTS friend_since TIMESTAMP WITH TIME ZONE;
ALTER TABLE messenger_friendships ADD COLUMN IF NOT EXISTS custom_nickname TEXT;
ALTER TABLE messenger_friendships ADD COLUMN IF NOT EXISTS interaction_score INTEGER DEFAULT 0;
ALTER TABLE messenger_friendships ADD COLUMN IF NOT EXISTS request_message TEXT;
ALTER TABLE messenger_friendships ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

DO $$
BEGIN
  RAISE NOTICE '🔧 Column fix applied! All missing columns added.';
  RAISE NOTICE '✅ Messenger should be fully functional now!';
END $$;
