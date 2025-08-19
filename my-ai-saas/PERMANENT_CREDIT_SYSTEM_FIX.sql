-- ============================================================================
-- PERMANENT CREDIT SYSTEM FIX - EXECUTE IN SUPABASE SQL EDITOR
-- ============================================================================
-- This script will permanently fix your credit system with proper structure
-- No more auto-grants, proper deduction, efficient operation
-- ============================================================================

-- 1. CLEAN UP INCORRECT PLANS AND SET CORRECT STRUCTURE
-- ============================================================================

-- Delete any incorrect or test plans
DELETE FROM plan_credits WHERE plan NOT IN ('one t', 'one z', 'one pro');

-- Insert/Update correct plans with proper credits
INSERT INTO plan_credits (plan, monthly_credits, daily_grant) VALUES
  ('one t', 10000, 333),   -- $19/month - 10k credits  
  ('one z', 50000, 1666),  -- $79/month - 50k credits
  ('one pro', 100000, 3333) -- $149/month - 100k credits
ON CONFLICT (plan) DO UPDATE SET
  monthly_credits = EXCLUDED.monthly_credits,
  daily_grant = EXCLUDED.daily_grant,
  updated_at = NOW();

-- 2. ENSURE RPC FUNCTIONS EXIST AND WORK PROPERLY
-- ============================================================================

-- Drop existing functions to recreate them properly
DROP FUNCTION IF EXISTS add_credits_simple(text, integer);
DROP FUNCTION IF EXISTS deduct_credits_simple(text, integer);

-- Create proper add_credits function
CREATE OR REPLACE FUNCTION add_credits_simple(p_user_id text, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  -- Ensure user_credits row exists
  INSERT INTO user_credits (user_id, credits) 
  VALUES (p_user_id, 0) 
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Add credits and return new balance
  UPDATE user_credits 
  SET credits = credits + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END;
$$;

-- Create proper deduct_credits function  
CREATE OR REPLACE FUNCTION deduct_credits_simple(p_user_id text, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits integer;
  new_balance integer;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits
  FROM user_credits 
  WHERE user_id = p_user_id;
  
  -- Check if user exists and has enough credits
  IF current_credits IS NULL THEN
    RETURN NULL; -- User doesn't exist
  END IF;
  
  IF current_credits < p_amount THEN
    RETURN NULL; -- Insufficient credits
  END IF;
  
  -- Deduct credits and return new balance
  UPDATE user_credits 
  SET credits = credits - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END;
$$;

-- 3. SET CORRECT USER CREDITS FOR CURRENT USER
-- ============================================================================

-- Set your user to correct credits for 'one z' plan (50,000 credits)
INSERT INTO user_credits (user_id, credits) VALUES
  ('user_31COJVefTvqeXiOEb4SuFgwKHfD', 50000)
ON CONFLICT (user_id) DO UPDATE SET
  credits = 50000,
  updated_at = NOW();

-- Ensure your user has correct billing plan
INSERT INTO user_billing (user_id, plan, status) VALUES
  ('user_31COJVefTvqeXiOEb4SuFgwKHfD', 'one z', 'active')
ON CONFLICT (user_id) DO UPDATE SET
  plan = 'one z',
  status = 'active',
  updated_at = NOW();

-- 4. CREATE USAGE TRACKING TABLE FOR PROPER CREDIT MANAGEMENT
-- ============================================================================

-- Create usage tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'deduct' or 'add'
  amount INTEGER NOT NULL,
  reason TEXT, -- 'pdf_export', 'manual_add', etc.
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy for credit usage
ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit usage"
ON credit_usage FOR SELECT
USING (auth.uid()::text = user_id);

-- 5. CREATE COMPREHENSIVE CREDIT MANAGEMENT FUNCTION
-- ============================================================================

-- Function to handle credit operations with proper logging
CREATE OR REPLACE FUNCTION manage_credits(
  p_user_id text, 
  p_action text, 
  p_amount integer, 
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits integer;
  new_balance integer;
  result jsonb;
BEGIN
  -- Ensure user_credits row exists
  INSERT INTO user_credits (user_id, credits) 
  VALUES (p_user_id, 0) 
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Get current credits
  SELECT credits INTO current_credits
  FROM user_credits 
  WHERE user_id = p_user_id;
  
  IF p_action = 'deduct' THEN
    -- Check if enough credits
    IF current_credits < p_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient_credits',
        'current_credits', current_credits,
        'required', p_amount
      );
    END IF;
    
    -- Deduct credits
    UPDATE user_credits 
    SET credits = credits - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING credits INTO new_balance;
    
  ELSIF p_action = 'add' THEN
    -- Add credits
    UPDATE user_credits 
    SET credits = credits + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING credits INTO new_balance;
    
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_action'
    );
  END IF;
  
  -- Log the transaction
  INSERT INTO credit_usage (user_id, action, amount, reason, balance_after)
  VALUES (p_user_id, p_action, p_amount, p_reason, new_balance);
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', new_balance,
    'action', p_action,
    'amount', p_amount
  );
END;
$$;

-- 6. VERIFICATION QUERIES
-- ============================================================================

-- Check final plan structure
SELECT 'PLANS AFTER FIX:' AS status;
SELECT plan, monthly_credits, daily_grant FROM plan_credits ORDER BY monthly_credits;

-- Check user credits
SELECT 'USER CREDITS AFTER FIX:' AS status;
SELECT user_id, credits, updated_at FROM user_credits WHERE user_id = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';

-- Check user billing
SELECT 'USER BILLING AFTER FIX:' AS status;
SELECT user_id, plan, status, updated_at FROM user_billing WHERE user_id = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';

-- Test RPC functions
SELECT 'TESTING RPC FUNCTIONS:' AS status;
SELECT manage_credits('user_31COJVefTvqeXiOEb4SuFgwKHfD', 'deduct', 1, 'test_deduction') AS test_deduct;
SELECT manage_credits('user_31COJVefTvqeXiOEb4SuFgwKHfD', 'add', 1, 'test_addition') AS test_add;

-- ============================================================================
-- EXECUTE THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR FOR PERMANENT FIX
-- ============================================================================
