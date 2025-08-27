// Quick test script to verify Razorpay integration
// Run this in Node.js after setting up the database

const testRazorpayIntegration = async () => {
  console.log('🧪 Testing Razorpay Integration...\n');

  try {
    // Test 1: Check environment variables
    console.log('1. Environment Variables:');
    console.log(`   ✅ RAZORPAY_KEY_ID: ${process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? 'Set' : 'Missing'}`);
    console.log(`   ✅ RAZORPAY_KEY_SECRET: ${process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Missing'}`);
    console.log(`   ✅ WEBHOOK_SECRET: ${process.env.RAZORPAY_WEBHOOK_SECRET ? 'Set' : 'Missing'}\n`);

    // Test 2: Test API endpoints
    console.log('2. Testing API Endpoints:');
    
    const baseUrl = 'http://localhost:3000';
    
    // Test plans endpoint
    console.log('   Testing /api/razorpay/create-subscription...');
    const response = await fetch(`${baseUrl}/api/razorpay/create-subscription`);
    const data = await response.json();
    
    if (data.plans) {
      console.log(`   ✅ Plans loaded: ${Object.keys(data.plans).length} plans`);
      Object.entries(data.plans).forEach(([id, plan]) => {
        console.log(`      - ${id}: $${plan.usd_price} → ₹${plan.inr_price} (${plan.credits.toLocaleString()} credits)`);
      });
    } else {
      console.log('   ❌ Failed to load plans');
    }

    console.log('\n3. Ready for Testing:');
    console.log('   🌐 Visit: http://localhost:3000/subscription');
    console.log('   💳 Test card: 4111 1111 1111 1111');
    console.log('   📅 Any future date, CVV: 123');
    console.log('   💰 Complete subscription to test credit allocation\n');

    console.log('🎉 Integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Export for use
module.exports = { testRazorpayIntegration };

// Run if called directly
if (require.main === module) {
  testRazorpayIntegration();
}
