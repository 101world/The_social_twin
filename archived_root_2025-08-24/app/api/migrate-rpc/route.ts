import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Applying database migration for RPC functions...');
    
    const supabase = createSupabaseAdminClient();
    
    // SQL to create the critical RPC functions
    const migrationSQL = `
-- Ensure the deduct_credits_simple RPC function exists in production database
-- This is critical for credit deduction to work properly

-- Create user_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Create the critical RPC function for credit deduction
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
    RETURN NULL; -- insufficient credits or no row
  END IF;

  RETURN new_balance;
END$$;

-- Also create add_credits_simple for completeness
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

    console.log('📝 Executing migration SQL...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed with direct exec, trying alternative approach:', error);
      
      // Try executing parts separately
      const parts = [
        `CREATE TABLE IF NOT EXISTS public.user_credits (
          user_id TEXT PRIMARY KEY,
          credits INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );`,
        
        `ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;`,
        
        `CREATE OR REPLACE FUNCTION public.deduct_credits_simple(p_user_id TEXT, p_amount INTEGER)
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
END$$;`,

        `CREATE OR REPLACE FUNCTION public.add_credits_simple(p_user_id TEXT, p_amount INTEGER)
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
END$$;`
      ];
      
      for (const [i, sql] of parts.entries()) {
        console.log(`📝 Executing part ${i + 1}/${parts.length}...`);
        const { error: partError } = await supabase.from('').select('').maybeSingle();
        // Note: We'll need to use a different approach since we can't execute raw SQL directly
      }
      
      return NextResponse.json({ 
        error: 'Migration execution failed',
        details: error.message,
        suggestion: 'Please run the SQL manually in Supabase Dashboard > SQL Editor'
      }, { status: 500 });
    }
    
    console.log('✅ Migration executed successfully');
    
    // Test if the function was created
    console.log('🧪 Testing deduct_credits_simple function...');
    
    const { data: testResult, error: testError } = await supabase.rpc('deduct_credits_simple', {
      p_user_id: 'test_user_nonexistent',
      p_amount: 1
    });
    
    if (testError) {
      if (testError.message.includes('function') && testError.message.includes('does not exist')) {
        console.log('❌ Function still does not exist after migration');
        return NextResponse.json({ 
          error: 'Function creation failed',
          details: testError.message 
        }, { status: 500 });
      } else {
        console.log('✅ Function exists (expected error for non-existent user)');
      }
    }
    
    console.log('🎉 Database migration completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'RPC functions created successfully',
      functions_created: ['deduct_credits_simple', 'add_credits_simple'],
      test_result: testResult,
      test_error: testError?.message
    });
    
  } catch (error: any) {
    console.error('💥 Migration error:', error);
    return NextResponse.json({ 
      error: 'Migration failed',
      details: error.message 
    }, { status: 500 });
  }
}
