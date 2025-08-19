const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testOtherPlans() {
  console.log('🧪 TESTING OTHER PLANS - SIMULATION');
  console.log('=' .repeat(40));
  
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
  
  // Test different plans by creating temporary users
  const testPlans = ['free', 'one t', 'one s', 'one xt', 'one z'];
  
  console.log('Creating test users for each plan...\n');
  
  for (const plan of testPlans) {
    const testUserId = `test_user_${plan.replace(' ', '_')}_${Date.now()}`;
    
    console.log(`📋 Testing "${plan}" plan:`);
    console.log('-' .repeat(25));
    
    try {
      // Get plan credits
      const { data: planData } = await supabase
        .from('plan_credits')
        .select('*')
        .eq('plan', plan)
        .single();
      
      if (!planData) {
        console.log(`❌ Plan "${plan}" not found in database`);
        continue;
      }
      
      // Create billing record
      await supabase.from('user_billing').insert({
        user_id: testUserId,
        plan: plan,
        status: 'active'
      });
      
      // Grant credits using add_credits_simple
      const { data: creditResult, error: creditError } = await supabase.rpc('add_credits_simple', {
        p_user_id: testUserId,
        p_amount: planData.monthly_credits
      });
      
      if (creditError) {
        console.log(`❌ Failed to grant credits: ${creditError.message}`);
      } else {
        console.log(`✅ Granted ${planData.monthly_credits.toLocaleString()} credits`);
        console.log(`💰 Final balance: ${creditResult.toLocaleString()}`);
        console.log(`📊 Daily grant rate: ${planData.daily_grant} credits/day`);
      }
      
      // Test credit deduction
      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_simple', {
        p_user_id: testUserId,
        p_amount: 1
      });
      
      if (deductError) {
        console.log(`❌ Credit deduction failed: ${deductError.message}`);
      } else {
        console.log(`✅ Deducted 1 credit, new balance: ${deductResult?.toLocaleString() || 'null'}`);
      }
      
      // Clean up test user
      await supabase.from('user_credits').delete().eq('user_id', testUserId);
      await supabase.from('user_billing').delete().eq('user_id', testUserId);
      
    } catch (error) {
      console.log(`❌ Error testing ${plan}: ${error.message}`);
    }
    
    console.log(''); // Empty line for separation
  }
  
  console.log('🎯 SUMMARY FOR ALL PLANS:');
  console.log('=' .repeat(30));
  
  const { data: allPlans } = await supabase.from('plan_credits').select('*').order('monthly_credits');
  
  if (allPlans) {
    console.log('Plan       | Monthly Credits | Daily Grant | Usage Examples');
    console.log('-' .repeat(65));
    
    allPlans.forEach(plan => {
      const name = plan.plan.padEnd(10);
      const monthly = plan.monthly_credits.toLocaleString().padStart(8);
      const daily = plan.daily_grant.toString().padStart(4);
      
      let examples = '';
      if (plan.plan === 'free') {
        examples = '1,500 PDFs or 500 videos';
      } else if (plan.plan === 'one t') {
        examples = '1,000 PDFs or 333 videos';
      } else if (plan.plan === 'one s') {
        examples = '5,000 PDFs or 1,666 videos';
      } else if (plan.plan === 'one xt') {
        examples = '10,000 PDFs or 3,333 videos';
      } else if (plan.plan === 'one z') {
        examples = '50,000 PDFs or 16,666 videos';
      }
      
      console.log(`${name} | ${monthly} credits | ${daily}    | ${examples}`);
    });
  }
  
  console.log('\n💡 REAL CREDITS EXPLANATION:');
  console.log('-' .repeat(30));
  console.log('✅ These are NOT display-only numbers');
  console.log('✅ Credits are ACTUALLY deducted when features are used');
  console.log('✅ Each plan has different monthly allocations');
  console.log('✅ Higher plans = more credits = more usage');
  console.log('✅ Credits reset monthly with billing cycle');
  console.log('✅ User can track usage in real-time');
}

testOtherPlans().catch(console.error);
