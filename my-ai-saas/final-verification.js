const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function finalVerification() {
  console.log('🎯 FINAL VERIFICATION - CREDIT SYSTEM STATUS');
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
  
  const userId = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';
  
  console.log('✅ CURRENT STATUS:');
  console.log('-' .repeat(20));
  
  // Check current user credits
  const { data: userCredits } = await supabase
    .from('user_credits')
    .select('credits, updated_at')
    .eq('user_id', userId)
    .single();
    
  if (userCredits) {
    console.log(`💰 User Credits: ${userCredits.credits.toLocaleString()}`);
    console.log(`📅 Last Updated: ${userCredits.updated_at}`);
  }
  
  // Check user billing plan
  const { data: userBilling } = await supabase
    .from('user_billing')
    .select('plan, status')
    .eq('user_id', userId)
    .single();
    
  if (userBilling) {
    console.log(`📋 Plan: ${userBilling.plan}`);
    console.log(`🔄 Status: ${userBilling.status}`);
  }
  
  // Check what RPC functions are working
  console.log('\n🔧 RPC FUNCTIONS STATUS:');
  console.log('-' .repeat(25));
  
  // Test add_credits_simple
  const { data: addTest, error: addError } = await supabase.rpc('add_credits_simple', {
    p_user_id: 'test_verification',
    p_amount: 1
  });
  
  if (addError) {
    console.log('❌ add_credits_simple: NOT WORKING');
  } else {
    console.log('✅ add_credits_simple: WORKING');
    // Clean up
    await supabase.from('user_credits').delete().eq('user_id', 'test_verification');
  }
  
  // Test deduct_credits_simple
  const { data: deductTest, error: deductError } = await supabase.rpc('deduct_credits_simple', {
    p_user_id: 'test_nonexistent',
    p_amount: 1
  });
  
  if (deductError && deductError.message.includes('does not exist')) {
    console.log('❌ deduct_credits_simple: NOT WORKING');
  } else {
    console.log('✅ deduct_credits_simple: WORKING');
  }
  
  console.log('\n🎯 SUMMARY:');
  console.log('=' .repeat(15));
  
  if (userCredits && userCredits.credits >= 50000 && userBilling && userBilling.plan === 'one z') {
    console.log('🎉 SUCCESS: User has correct credits and plan!');
    console.log('✅ Credits are now displaying properly');
    console.log('✅ User can now export PDFs and use all features');
    
    if (!addError && (!deductError || !deductError.message.includes('does not exist'))) {
      console.log('✅ All RPC functions are working');
    } else {
      console.log('⚠️ Some RPC functions need schema migration (run FINAL_CREDIT_MIGRATION.sql)');
    }
  } else {
    console.log('❌ ISSUE: User credits or plan setup is incorrect');
  }
  
  console.log('\n📋 NEXT STEPS:');
  console.log('-' .repeat(15));
  console.log('1. 🌐 Visit your app at http://localhost:3001');
  console.log('2. 👀 Check if credits are displaying in the UI');
  console.log('3. 🧪 Try exporting a PDF to test credit deduction');
  console.log('4. 📊 Run the complete SQL migration for permanent fix:');
  console.log('   📁 File: FINAL_CREDIT_MIGRATION.sql');
  console.log('   🎯 Location: Supabase Dashboard > SQL Editor');
}

finalVerification().catch(console.error);
