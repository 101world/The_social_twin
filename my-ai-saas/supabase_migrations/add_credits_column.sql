-- Add credits column to user_billing table
ALTER TABLE public.user_billing 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Update existing users with credits based on their plan
UPDATE public.user_billing 
SET credits = CASE 
  WHEN plan LIKE '%pro%' OR plan LIKE '%premium%' THEN 1000 
  WHEN plan IS NOT NULL AND status = 'active' THEN 500 
  ELSE 0 
END 
WHERE credits = 0;
