const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function fixDatabase() {
  console.log('🔧 FIXING DATABASE SCHEMA AND FUNCTIONS');
  console.log('=' .repeat(50));
  
  // Read .env.local file manually
  let supabaseUrl, supabaseServiceKey;
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1].trim();
      }
      if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        supabaseServiceKey = line.split('=')[1].trim();
      }
    }
  } catch (error) {
    console.error('❌ Could not read .env.local file:', error.message);
    process.exit(1);
  }
  
  // Create admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('1. Adding missing column to user_credits table...');
  
  // Add the missing column using a direct SQL approach
  try {
    // First, let's add the column manually using the SQL editor approach
    console.log('📝 SQL to run manually in Supabase SQL Editor:');
    console.log(`
-- Add missing column to user_credits table
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS last_daily_topup_at TIMESTAMPTZ;

-- Create the missing grant_daily_credits_if_needed function
CREATE OR REPLACE FUNCTION public.grant_daily_credits_if_needed(p_user_id TEXT, p_amount INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  current_credits INTEGER;
  last_grant TIMESTAMPTZ;
  should_grant BOOLEAN := FALSE;
BEGIN
  -- Get current credits and last grant time
  SELECT credits, last_daily_topup_at INTO current_credits, last_grant
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_credits(user_id, credits, last_daily_topup_at)
    VALUES (p_user_id, p_amount, NOW());
    RETURN TRUE;
  END IF;
  
  -- Check if we should grant (no previous grant or more than 24 hours ago)
  IF last_grant IS NULL OR last_grant < NOW() - INTERVAL '24 hours' THEN
    should_grant := TRUE;
  END IF;
  
  -- Grant credits if needed
  IF should_grant THEN
    UPDATE public.user_credits
    SET credits = p_amount,
        last_daily_topup_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END$$;
    `);
    
    console.log('\n2. Manually applying fixes using direct operations...');
    
    // Add the missing column first by checking if it exists
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'user_credits')
      .eq('column_name', 'last_daily_topup_at');
      
    if (!columns || columns.length === 0) {
      console.log('⚠️ Column last_daily_topup_at is missing - must be added manually');
    } else {
      console.log('✅ Column last_daily_topup_at exists');
    }
    
    // For now, let's directly fix the user's credits without the column
    console.log('3. Directly setting user credits to correct amount...');
    
    const userId = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';
    
    // Set user to have 50,000 credits (one z plan)
    const { data: updateResult, error: updateError } = await supabase
      .from('user_credits')
      .update({ 
        credits: 50000,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating user credits:', updateError.message);
    } else {
      console.log('✅ User credits updated to 50,000:', updateResult);
    }
    
    // Also create the user_billing entry properly
    const { data: billingUpdate, error: billingError } = await supabase
      .from('user_billing')
      .update({
        plan: 'one z',
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();
      
    if (billingError) {
      console.error('❌ Error updating billing:', billingError.message);
    } else {
      console.log('✅ User billing updated:', billingUpdate);
    }
    
    console.log('\n🎉 IMMEDIATE FIX APPLIED!');
    console.log('User should now see 50,000 credits');
    console.log('\n⚠️ IMPORTANT: Still need to run the SQL above in Supabase SQL Editor to fix the schema permanently');
    
  } catch (error) {
    console.error('💥 Error during fix:', error.message);
  }
}

fixDatabase().catch(console.error);
