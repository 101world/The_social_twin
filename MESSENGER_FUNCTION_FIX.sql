-- Fix the messenger_upsert_user function conflict
-- The issue is there are multiple versions with different parameters

-- Drop all existing versions
DROP FUNCTION IF EXISTS messenger_upsert_user(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS messenger_upsert_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create the definitive version that matches what the component expects
CREATE OR REPLACE FUNCTION messenger_upsert_user(
  p_clerk_id TEXT,
  p_username TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- First try to update existing user
  UPDATE messenger_users 
  SET 
    username = p_username,
    display_name = COALESCE(p_display_name, display_name),
    email = COALESCE(p_email, email),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = NOW(),
    last_seen = NOW(),
    is_online = true
  WHERE clerk_id = p_clerk_id
  RETURNING id INTO user_id;
  
  -- If no user found, insert new one
  IF user_id IS NULL THEN
    INSERT INTO messenger_users (
      clerk_id,
      username,
      display_name,
      email,
      avatar_url,
      is_online,
      last_seen,
      created_at,
      updated_at
    ) VALUES (
      p_clerk_id,
      p_username,
      p_display_name,
      p_email,
      p_avatar_url,
      true,
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO user_id;
  END IF;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '🔧 Fixed messenger_upsert_user function conflict!';
  RAISE NOTICE '✅ Component should now initialize without hanging!';
END $$;
