// Quick test to verify if deduct_credits_simple RPC function exists in production
import { createSupabaseAdminClient } from './lib/supabase.js';

async function testRPC() {
  console.log('Testing deduct_credits_simple RPC function...');
  
  const supabase = createSupabaseAdminClient();
  
  // Test with a fake user ID that won't exist
  const { data, error } = await supabase.rpc('deduct_credits_simple', {
    p_user_id: 'test_user_does_not_exist',
    p_amount: 1
  });

  console.log('RPC call result:');
  console.log('Data:', data);
  console.log('Error:', error);
  
  if (error) {
    if (error.message.includes('function') && error.message.includes('does not exist')) {
      console.log('❌ RPC function deduct_credits_simple does NOT exist in database');
      console.log('Need to run database migration');
    } else {
      console.log('✅ RPC function exists (got different error as expected)');
    }
  } else {
    console.log('✅ RPC function exists and returned:', data);
  }
}

testRPC().catch(console.error);
