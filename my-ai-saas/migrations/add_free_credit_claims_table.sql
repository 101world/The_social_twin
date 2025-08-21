-- Create free_credit_claims table to track one-time free credit claims
CREATE TABLE IF NOT EXISTS free_credit_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    credits_added INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id) -- Ensures one claim per user
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_free_credit_claims_user_id ON free_credit_claims(user_id);

-- Enable RLS
ALTER TABLE free_credit_claims ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own claims
CREATE POLICY "Users can view their own free credit claims" ON free_credit_claims
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Add comment
COMMENT ON TABLE free_credit_claims IS 'Tracks one-time free credit claims by users';

-- Insert the table into the logs (if you want to track this change)
INSERT INTO credit_transactions (user_id, type, amount, description, created_at)
SELECT DISTINCT user_id, 'migration', 0, 'Free credit claims table created', NOW()
FROM user_credits
WHERE FALSE; -- This won't insert anything, just validates the structure
