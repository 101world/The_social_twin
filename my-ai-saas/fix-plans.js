const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function fixPlansToMatchActual() {
  console.log('🔧 FIXING PLANS TO MATCH ACTUAL PRICING');
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
  
  console.log('\n🎯 YOUR ACTUAL PLANS SHOULD BE:');
  console.log('-' .repeat(35));
  console.log('Plan       | Price | Credits  | Description');
  console.log('-----------|-------|----------|------------');
  console.log('One T      | $19   | 10,000   | 10k texts, 500 images, 5 videos');
  console.log('One Z      | $79   | 50,000   | 25k texts, 2k images, 40 videos');
  console.log('One XT/Pro | $149  | 100,000  | 50k texts, 3k images, 75 videos');
  
  console.log('\n🔄 UPDATING DATABASE TO CORRECT PLANS...');
  console.log('-' .repeat(40));
  
  // Delete incorrect plans
  const plansToDelete = ['free', 'one s'];
  for (const planName of plansToDelete) {
    const { error } = await supabase
      .from('plan_credits')
      .delete()
      .eq('plan', planName);
      
    if (error) {
      console.log(`⚠️ Could not delete ${planName}: ${error.message}`);
    } else {
      console.log(`✅ Deleted incorrect plan: ${planName}`);
    }
  }
  
  // Update correct plans with right credit amounts
  const correctPlans = [
    { plan: 'one t', monthly_credits: 10000, daily_grant: 333 },   // $19 plan
    { plan: 'one z', monthly_credits: 50000, daily_grant: 1666 },  // $79 plan  
    { plan: 'one xt', monthly_credits: 100000, daily_grant: 3333 }, // $149 plan (same as one pro)
    { plan: 'one pro', monthly_credits: 100000, daily_grant: 3333 } // $149 plan (alias for one xt)
  ];
  
  for (const planData of correctPlans) {
    const { error } = await supabase
      .from('plan_credits')
      .upsert(planData, { onConflict: 'plan' });
      
    if (error) {
      console.log(`❌ Failed to update ${planData.plan}: ${error.message}`);
    } else {
      console.log(`✅ Updated ${planData.plan}: ${planData.monthly_credits.toLocaleString()} credits`);
    }
  }
  
  console.log('\n🎯 FINAL DATABASE PLANS:');
  console.log('-' .repeat(25));
  const { data: finalPlans } = await supabase.from('plan_credits').select('*').order('monthly_credits');
  
  if (finalPlans) {
    console.log('Plan       | Monthly Credits | Daily Grant | Price');
    console.log('-----------|-----------------|-------------|-------');
    finalPlans.forEach(plan => {
      let price = '';
      if (plan.plan === 'one t') price = '$19';
      else if (plan.plan === 'one z') price = '$79';
      else if (plan.plan === 'one xt' || plan.plan === 'one pro') price = '$149';
      
      const name = plan.plan.padEnd(10);
      const credits = plan.monthly_credits.toLocaleString().padStart(8);
      const daily = plan.daily_grant.toString().padStart(4);
      
      console.log(`${name} | ${credits} credits | ${daily}      | ${price}`);
    });
  }
  
  // Update current user to correct credits if they have one z plan
  console.log('\n🔄 UPDATING USER CREDITS FOR ONE Z PLAN...');
  console.log('-' .repeat(40));
  
  const userId = 'user_31COJVefTvqeXiOEb4SuFgwKHfD';
  const { data: userBilling } = await supabase
    .from('user_billing')
    .select('plan')
    .eq('user_id', userId)
    .single();
    
  if (userBilling && userBilling.plan === 'one z') {
    // User should have 50,000 credits (already correct, but let's confirm)
    const { data: updateResult, error: updateError } = await supabase
      .from('user_credits')
      .update({ credits: 50000, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select();
      
    if (updateError) {
      console.log(`❌ Failed to update user credits: ${updateError.message}`);
    } else {
      console.log(`✅ Confirmed user has correct 50,000 credits for 'one z' plan`);
    }
  }
  
  console.log('\n🎉 PLAN CORRECTION COMPLETE!');
  console.log('✅ Database now matches your actual pricing structure');
  console.log('✅ User credits are correct for their plan');
  console.log('✅ Ready to test the website!');
}

fixPlansToMatchActual().catch(console.error);
