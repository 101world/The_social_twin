// Razorpay Integration Verification Script
// Run this in Node.js to verify your setup

const verifyRazorpaySetup = async () => {
  console.log('🔍 Verifying Razorpay Monthly Subscription Setup...\n');

  // 1. Check environment variables
  console.log('1. Environment Variables:');
  const requiredEnvVars = [
    'NEXT_PUBLIC_RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`   ✅ ${envVar}: ${value.substring(0, 10)}...`);
    } else {
      console.log(`   ❌ ${envVar}: Missing`);
    }
  }

  // 2. Test API endpoints
  console.log('\n2. API Endpoints:');
  
  try {
    // Test plans endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    console.log(`   Testing: ${baseUrl}/api/razorpay/create-subscription`);
    
    const response = await fetch(`${baseUrl}/api/razorpay/create-subscription`);
    const data = await response.json();
    
    if (data.plans) {
      console.log(`   ✅ Plans API: ${Object.keys(data.plans).length} plans loaded`);
      Object.entries(data.plans).forEach(([id, plan]) => {
        console.log(`      - ${id}: $${plan.usd_price} → ₹${plan.inr_price} (${plan.credits.toLocaleString()} credits)`);
      });
    } else {
      console.log(`   ❌ Plans API: Failed to load plans`);
    }
  } catch (error) {
    console.log(`   ❌ API Test Failed: ${error.message}`);
  }

  // 3. Database connectivity (requires Supabase setup)
  console.log('\n3. Database Setup:');
  console.log('   📝 Please run the SQL from supabase_monthly_subscriptions.sql in your Supabase SQL Editor');
  console.log('   📝 Then visit /subscription to test the complete flow');

  // 4. Webhook setup
  console.log('\n4. Webhook Configuration:');
  console.log('   📝 Configure webhook in Razorpay Dashboard:');
  console.log('      URL: https://yourdomain.com/api/webhooks/razorpay');
  console.log('      Secret: Patnibillions09!');
  console.log('      Events: subscription.activated, subscription.charged, subscription.cancelled');

  console.log('\n🎉 Setup verification complete!');
  console.log('📋 Next steps:');
  console.log('   1. Run database setup SQL in Supabase');
  console.log('   2. Configure webhook in Razorpay Dashboard');
  console.log('   3. Test at /subscription');
};

// Run verification if this script is executed directly
if (require.main === module) {
  verifyRazorpaySetup().catch(console.error);
}

module.exports = { verifyRazorpaySetup };
