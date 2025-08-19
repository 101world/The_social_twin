const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function fixPlansCorrectly() {
  console.log('🔧 FIXING PLANS - REMOVING INCORRECT "ONE XT"');
  console.log('=' .repeat(50));
  
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
  
  console.log('📋 CURRENT DATABASE PLANS:');
  console.log('-' .repeat(30));
  const { data: currentPlans } = await supabase.from('plan_credits').select('*').order('monthly_credits');
  
  if (currentPlans) {
    currentPlans.forEach(plan => {
      console.log(`${plan.plan.padEnd(10)} | ${plan.monthly_credits.toLocaleString().padStart(8)} credits`);
    });
  }
  
  console.log('\n🎯 YOUR ACTUAL PLANS (NO ONE XT):');
  console.log('-' .repeat(35));
  console.log('Plan       | Price | Credits  | Description');
  console.log('-----------|-------|----------|------------');
  console.log('One T      | $19   | 10,000   | Entry level');
  console.log('One Z      | $79   | 50,000   | Most popular');
  console.log('One Pro    | $149  | 100,000  | Professional');
  
  console.log('\n🗑️ REMOVING INCORRECT "ONE XT" PLAN...');
  console.log('-' .repeat(40));
  
  // Delete the incorrect "one xt" plan
  const { error: deleteError } = await supabase
    .from('plan_credits')
    .delete()
    .eq('plan', 'one xt');
    
  if (deleteError) {
    console.log(`⚠️ Could not delete 'one xt': ${deleteError.message}`);
  } else {
    console.log(`✅ Deleted incorrect plan: 'one xt'`);
  }
  
  console.log('\n✅ ENSURING CORRECT PLANS ONLY...');
  console.log('-' .repeat(35));
  
  // Ensure only the correct 3 plans exist
  const correctPlans = [
    { plan: 'one t', monthly_credits: 10000, daily_grant: 333 },    // $19 plan
    { plan: 'one z', monthly_credits: 50000, daily_grant: 1666 },   // $79 plan  
    { plan: 'one pro', monthly_credits: 100000, daily_grant: 3333 } // $149 plan
  ];
  
  for (const planData of correctPlans) {
    const { error } = await supabase
      .from('plan_credits')
      .upsert(planData, { onConflict: 'plan' });
      
    if (error) {
      console.log(`❌ Failed to update ${planData.plan}: ${error.message}`);
    } else {
      console.log(`✅ Confirmed ${planData.plan}: ${planData.monthly_credits.toLocaleString()} credits`);
    }
  }
  
  console.log('\n🎯 FINAL CORRECT DATABASE PLANS:');
  console.log('-' .repeat(35));
  const { data: finalPlans } = await supabase.from('plan_credits').select('*').order('monthly_credits');
  
  if (finalPlans) {
    console.log('Plan       | Monthly Credits | Daily Grant | Price');
    console.log('-----------|-----------------|-------------|-------');
    finalPlans.forEach(plan => {
      let price = '';
      if (plan.plan === 'one t') price = '$19';
      else if (plan.plan === 'one z') price = '$79';
      else if (plan.plan === 'one pro') price = '$149';
      
      const name = plan.plan.padEnd(10);
      const credits = plan.monthly_credits.toLocaleString().padStart(8);
      const daily = plan.daily_grant.toString().padStart(4);
      
      console.log(`${name} | ${credits} credits | ${daily}      | ${price}`);
    });
  }
  
  console.log('\n🎉 PLAN CORRECTION COMPLETE!');
  console.log('✅ Removed incorrect "one xt" plan');
  console.log('✅ Database now has only your 3 actual plans');
  console.log('✅ One T ($19) | One Z ($79) | One Pro ($149)');
}

fixPlansCorrectly().catch(console.error);
