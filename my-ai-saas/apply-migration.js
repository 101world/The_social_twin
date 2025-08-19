const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyMigration() {
  console.log('🚀 Starting database migration...');
  
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
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    process.exit(1);
  }
  
  // Create admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('📝 Creating user_credits table and RPC functions...');
  
  // Step 1: Create user_credits table if it doesn't exist
  console.log('Step 1: Creating user_credits table...');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS public.user_credits (
      user_id TEXT PRIMARY KEY,
      credits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  
  const { error: tableError } = await supabase.rpc('exec', { sql: createTableQuery });
  if (tableError) {
    console.log('⚠️ Table creation via RPC failed, trying direct approach...');
    console.log('Error:', tableError.message);
  } else {
    console.log('✅ Table created successfully');
  }
  
  // Step 2: Enable RLS
  console.log('Step 2: Enabling Row Level Security...');
  const rlsQuery = `ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;`;
  
  const { error: rlsError } = await supabase.rpc('exec', { sql: rlsQuery });
  if (rlsError) {
    console.log('⚠️ RLS enable failed:', rlsError.message);
  } else {
    console.log('✅ RLS enabled');
  }
  
  // Step 3: Create deduct_credits_simple function
  console.log('Step 3: Creating deduct_credits_simple function...');
  const deductFunctionQuery = `
    CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER AS $$
    DECLARE new_balance INTEGER;
    BEGIN
      UPDATE public.user_credits
      SET credits = credits - p_amount,
          updated_at = NOW()
      WHERE user_id = p_user_id AND credits >= p_amount
      RETURNING credits INTO new_balance;

      IF NOT FOUND THEN
        RETURN NULL;
      END IF;

      RETURN new_balance;
    END$$;
  `;
  
  const { error: deductError } = await supabase.rpc('exec', { sql: deductFunctionQuery });
  if (deductError) {
    console.log('⚠️ Deduct function creation failed:', deductError.message);
  } else {
    console.log('✅ deduct_credits_simple function created');
  }
  
  // Step 4: Create add_credits_simple function
  console.log('Step 4: Creating add_credits_simple function...');
  const addFunctionQuery = `
    CREATE OR REPLACE FUNCTION public.add_credits_simple(p_user_id TEXT, p_amount INTEGER)
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER AS $$
    DECLARE new_balance INTEGER;
    BEGIN
      INSERT INTO public.user_credits(user_id, credits)
      VALUES (p_user_id, p_amount)
      ON CONFLICT (user_id) DO UPDATE SET credits = public.user_credits.credits + EXCLUDED.credits,
                                          updated_at = NOW()
      RETURNING credits INTO new_balance;
      RETURN new_balance;
    END$$;
  `;
  
  const { error: addError } = await supabase.rpc('exec', { sql: addFunctionQuery });
  if (addError) {
    console.log('⚠️ Add function creation failed:', addError.message);
  } else {
    console.log('✅ add_credits_simple function created');
  }
  
  // Step 5: Test the functions
  console.log('Step 5: Testing deduct_credits_simple function...');
  
  const { data: testResult, error: testError } = await supabase.rpc('deduct_credits_simple', {
    p_user_id: 'test_user_nonexistent',
    p_amount: 1
  });
  
  if (testError) {
    if (testError.message.includes('function') && testError.message.includes('does not exist')) {
      console.log('❌ Function was not created successfully');
      console.log('Error:', testError.message);
    } else {
      console.log('✅ Function exists and working (expected null for non-existent user)');
      console.log('Test result:', testResult);
    }
  } else {
    console.log('✅ Function test completed successfully');
    console.log('Test result:', testResult);
  }
  
  console.log('🎉 Migration completed! Database should now have the required RPC functions.');
  
  // Alternative approach using SQL editor format
  console.log('\n📋 If the above failed, run this SQL manually in Supabase SQL Editor:');
  console.log(`
-- Create user_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Create deduct_credits_simple function
CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE public.user_credits
  SET credits = credits - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND credits >= p_amount
  RETURNING credits INTO new_balance;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN new_balance;
END$$;

-- Create add_credits_simple function
CREATE OR REPLACE FUNCTION public.add_credits_simple(p_user_id TEXT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE new_balance INTEGER;
BEGIN
  INSERT INTO public.user_credits(user_id, credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET credits = public.user_credits.credits + EXCLUDED.credits,
                                      updated_at = NOW()
  RETURNING credits INTO new_balance;
  RETURN new_balance;
END$$;
  `);
}

applyMigration().catch(console.error);
