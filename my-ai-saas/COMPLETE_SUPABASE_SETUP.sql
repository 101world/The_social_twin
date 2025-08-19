-- ============================================================================
-- COMPREHENSIVE CREDIT SYSTEM SETUP FOR SUPABASE SQL EDITOR
-- Run this entire script in Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Ensure plan_credits table has correct structure and data
-- ============================================================================

-- Delete any incorrect plans
DELETE FROM plan_credits WHERE plan NOT IN ('one t', 'one z', 'one pro');

-- Insert/update correct plans only
INSERT INTO plan_credits (plan, monthly_credits, daily_grant) 
VALUES 
  ('one t', 10000, 333),     -- $19 plan - 10k credits
  ('one z', 50000, 1666),    -- $79 plan - 50k credits  
  ('one pro', 100000, 3333)  -- $149 plan - 100k credits
ON CONFLICT (plan) 
DO UPDATE SET 
  monthly_credits = EXCLUDED.monthly_credits,
  daily_grant = EXCLUDED.daily_grant;

-- 2. Create/Update RPC Functions for Credit Management
-- ============================================================================

-- Function to add credits safely
CREATE OR REPLACE FUNCTION add_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Insert or update user credits
  INSERT INTO user_credits (user_id, credits, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    credits = user_credits.credits + p_amount,
    updated_at = NOW()
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits safely
CREATE OR REPLACE FUNCTION deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
  current_credits INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits 
  FROM user_credits 
  WHERE user_id = p_user_id;
  
  -- Check if user exists and has enough credits
  IF current_credits IS NULL OR current_credits < p_amount THEN
    RETURN NULL; -- Insufficient credits or user doesn't exist
  END IF;
  
  -- Deduct credits
  UPDATE user_credits 
  SET credits = credits - p_amount, 
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Set specific user to correct credit amount
-- ============================================================================

-- Set user to 50,000 credits for 'one z' plan (no auto-grant needed)
INSERT INTO user_credits (user_id, credits, updated_at)
VALUES ('user_31COJVefTvqeXiOEb4SuFgwKHfD', 50000, NOW())
ON CONFLICT (user_id) 
DO UPDATE SET 
  credits = 50000,
  updated_at = NOW();

-- Ensure user billing is set correctly
INSERT INTO user_billing (user_id, plan, status, updated_at)
VALUES ('user_31COJVefTvqeXiOEb4SuFgwKHfD', 'one z', 'active', NOW())
ON CONFLICT (user_id)
DO UPDATE SET 
  plan = 'one z',
  status = 'active',
  updated_at = NOW();

-- 4. Test the functions work correctly
-- ============================================================================

-- Test deduction (should work)
SELECT deduct_credits_simple('user_31COJVefTvqeXiOEb4SuFgwKHfD', 1) as test_deduction;

-- Add the credit back
SELECT add_credits_simple('user_31COJVefTvqeXiOEb4SuFgwKHfD', 1) as add_back;

-- 5. Verify final state
-- ============================================================================

-- Show all plans
SELECT 'PLANS:' as info, plan, monthly_credits, daily_grant FROM plan_credits ORDER BY monthly_credits;

-- Show user data
SELECT 'USER CREDITS:' as info, user_id, credits, updated_at 
FROM user_credits 
WHERE user_id = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';

SELECT 'USER BILLING:' as info, user_id, plan, status, updated_at 
FROM user_billing 
WHERE user_id = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';

-- ============================================================================
-- SETUP COMPLETE!
-- 
-- Your credit system should now:
-- ✅ Have correct plans (one t: 10k, one z: 50k, one pro: 100k)
-- ✅ Have working RPC functions (add_credits_simple, deduct_credits_simple)
-- ✅ Have user set to 50,000 credits for 'one z' plan
-- ✅ No auto-grant logic interfering
-- ============================================================================
