-- Create stable_endpoints table
CREATE TABLE IF NOT EXISTS stable_endpoints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('image', 'video', 'text', 'image-modify')),
    cloudflare_url VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mode, is_active) -- Only one active endpoint per mode
);

-- Create runpod_endpoints table
CREATE TABLE IF NOT EXISTS runpod_endpoints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stable_endpoint_id UUID NOT NULL REFERENCES stable_endpoints(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
    health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'unhealthy', 'unknown')),
    last_checked TIMESTAMP WITH TIME ZONE,
    response_time INTEGER, -- in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stable_endpoints_mode_active ON stable_endpoints(mode, is_active);
CREATE INDEX IF NOT EXISTS idx_runpod_endpoints_stable_id ON runpod_endpoints(stable_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_runpod_endpoints_active_priority ON runpod_endpoints(is_active, priority);

-- Insert stable endpoints with your actual Cloudflare R2 URLs
INSERT INTO stable_endpoints (mode, cloudflare_url, is_active) VALUES 
('image', 'https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/image-generation', true),
('video', 'https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/video-generation', true),
('image-modify', 'https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/image-modify', true)
ON CONFLICT (mode, is_active) WHERE is_active = true DO NOTHING;

-- Note: Text generation already uses stable Cloudflare worker - no entry needed

-- Grant necessary permissions (adjust based on your setup)
GRANT ALL ON stable_endpoints TO authenticated;
GRANT ALL ON runpod_endpoints TO authenticated;
GRANT ALL ON stable_endpoints TO service_role;
GRANT ALL ON runpod_endpoints TO service_role;
