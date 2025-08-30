-- Create admin_config table for storing admin settings like endpoints
CREATE TABLE IF NOT EXISTS admin_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create explore_content table for managing explore page content
CREATE TABLE IF NOT EXISTS explore_content (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for admin_config (only accessible via service role)
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for explore_content (read-only for authenticated users)
ALTER TABLE explore_content ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read explore content
CREATE POLICY "Users can read explore content" ON explore_content
    FOR SELECT USING (true);

-- Note: Admin operations will use service role key, so no specific policies needed for admin access

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(key);
CREATE INDEX IF NOT EXISTS idx_explore_content_created_at ON explore_content(created_at);
