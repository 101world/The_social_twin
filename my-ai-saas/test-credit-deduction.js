const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testCreditDeduction() {
  console.log('🧪 TESTING CREDIT DEDUCTION SYSTEM');
  console.log('=' .repeat(50));
  
  // Load environment variables
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envLines = envContent.split('\n');
  let supabaseUrl, supabaseServiceKey;
  
  for (const line of envLines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      supabaseServiceKey = line.split('=')[1].trim();
    }
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const userId = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';
  
  console.log('📊 BEFORE TEST:');
  const { data: beforeCredits } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();
  console.log(`Credits before: ${beforeCredits?.credits || 0}`);
  
  console.log('\n🔧 TESTING CREDIT DEDUCTION (1 credit for PDF export)...');
  const { data: newBalance, error } = await supabase.rpc('deduct_credits_simple', {
    p_user_id: userId,
    p_amount: 1
  });
  
  if (error) {
    console.log('❌ Deduction failed:', error.message);
  } else if (newBalance === null) {
    console.log('❌ Insufficient credits');
  } else {
    console.log(`✅ Deduction successful! New balance: ${newBalance}`);
  }
  
  console.log('\n📊 AFTER TEST:');
  const { data: afterCredits } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();
  console.log(`Credits after: ${afterCredits?.credits || 0}`);
  
  const difference = (beforeCredits?.credits || 0) - (afterCredits?.credits || 0);
  console.log(`\n📈 RESULT: ${difference} credit(s) deducted`);
  
  if (difference === 1) {
    console.log('🎉 ✅ CREDIT DEDUCTION WORKING PERFECTLY!');
    console.log('✅ No auto-grant interference');
    console.log('✅ Proper deduction occurred');
  } else {
    console.log('❌ Something is wrong with credit deduction');
  }
}

testCreditDeduction().catch(console.error);
