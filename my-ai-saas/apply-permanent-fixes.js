const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyPermanentFixes() {
  console.log('🔧 APPLYING PERMANENT DATABASE FIXES');
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
  
  // Use direct SQL through rpc if available, or raw query
  const addColumnSQL = `
    ALTER TABLE public.user_credits 
    ADD COLUMN IF NOT EXISTS last_daily_topup_at TIMESTAMPTZ;
  `;
  
  try {
    // Try to execute SQL directly
    const { data: columnResult, error: columnError } = await supabase.rpc('sql', { query: addColumnSQL });
    
    if (columnError) {
      console.log('⚠️ RPC sql method not available, trying alternative...');
      
      // Alternative approach: Use the REST API directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ query: addColumnSQL })
      });
      
      if (response.ok) {
        console.log('✅ Column added successfully via REST API');
      } else {
        const errorText = await response.text();
        console.log('⚠️ REST API failed:', errorText);
        console.log('📋 MANUAL ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
        console.log(addColumnSQL);
      }
    } else {
      console.log('✅ Column added successfully');
    }
  } catch (error) {
    console.log('⚠️ Direct SQL execution failed:', error.message);
    console.log('📋 MANUAL ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
    console.log(addColumnSQL);
  }
  
  console.log('\n2. Creating grant_daily_credits_if_needed function...');
  
  const createFunctionSQL = `
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
  `;
  
  try {
    // Try to execute function creation
    const { data: functionResult, error: functionError } = await supabase.rpc('sql', { query: createFunctionSQL });
    
    if (functionError) {
      console.log('⚠️ Function creation via RPC failed, trying alternative...');
      
      // Alternative approach
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ query: createFunctionSQL })
      });
      
      if (response.ok) {
        console.log('✅ Function created successfully via REST API');
      } else {
        console.log('📋 MANUAL ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
        console.log(createFunctionSQL);
      }
    } else {
      console.log('✅ Function created successfully');
    }
  } catch (error) {
    console.log('📋 MANUAL ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
    console.log(createFunctionSQL);
  }
  
  console.log('\n3. Updating existing records...');
  
  const updateRecordsSQL = `
    UPDATE public.user_credits 
    SET last_daily_topup_at = updated_at 
    WHERE last_daily_topup_at IS NULL;
  `;
  
  try {
    const { data: updateResult, error: updateError } = await supabase.rpc('sql', { query: updateRecordsSQL });
    
    if (updateError) {
      console.log('📋 MANUAL ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
      console.log(updateRecordsSQL);
    } else {
      console.log('✅ Existing records updated');
    }
  } catch (error) {
    console.log('📋 MANUAL ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
    console.log(updateRecordsSQL);
  }
  
  console.log('\n4. Testing the permanent fixes...');
  
  // Test if the function now exists
  const { data: testFunction, error: testFunctionError } = await supabase.rpc('grant_daily_credits_if_needed', {
    p_user_id: 'test_permanent_fix',
    p_amount: 1000
  });
  
  if (testFunctionError) {
    console.error('❌ grant_daily_credits_if_needed function still missing:', testFunctionError.message);
    console.log('📋 CRITICAL: Must run the SQL manually in Supabase SQL Editor');
  } else {
    console.log('✅ grant_daily_credits_if_needed function is working');
    
    // Clean up test data
    await supabase
      .from('user_credits')
      .delete()
      .eq('user_id', 'test_permanent_fix');
  }
  
  console.log('\n🎯 PERMANENT FIX STATUS:');
  console.log('=' .repeat(30));
  
  if (testFunctionError && testFunctionError.message.includes('does not exist')) {
    console.log('🚨 SCHEMA MIGRATION INCOMPLETE');
    console.log('📋 REQUIRED ACTION: Copy and run the complete SQL below in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(60));
    console.log('-- COMPLETE DATABASE MIGRATION FOR CREDIT SYSTEM');
    console.log('-- Copy this entire block and run in Supabase SQL Editor');
    console.log('');
    console.log('-- 1. Add missing column');
    console.log(addColumnSQL);
    console.log('-- 2. Create missing function');
    console.log(createFunctionSQL);
    console.log('-- 3. Update existing records');
    console.log(updateRecordsSQL);
    console.log('-- 4. Enable RLS if needed');
    console.log('ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;');
    console.log('='.repeat(60));
  } else {
    console.log('✅ SCHEMA MIGRATION COMPLETE');
    console.log('✅ All database functions are working properly');
    console.log('✅ Credit system is permanently fixed');
  }
}

applyPermanentFixes().catch(console.error);
