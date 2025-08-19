const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testCredits() {
  console.log('🧪 Testing credit system...');
  
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
  
  // Test with a real user ID (you can replace this with your actual user ID)
  const testUserId = 'user_2lYOUcTEk3oSPWXPXkZs4kx3HIE'; // Replace with real user ID
  
  console.log(`Testing with user ID: ${testUserId}`);
  
  // First, check if user has credits
  console.log('1. Checking current credits...');
  const { data: currentCredits, error: checkError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', testUserId)
    .single();
    
  if (checkError) {
    console.log('User not found in credits table, adding credits first...');
    
    // Add credits first
    const { data: addResult, error: addError } = await supabase.rpc('add_credits_simple', {
      p_user_id: testUserId,
      p_amount: 1000
    });
    
    if (addError) {
      console.error('❌ Failed to add credits:', addError.message);
    } else {
      console.log('✅ Added 1000 credits, new balance:', addResult);
    }
  } else {
    console.log('✅ Current credits:', currentCredits.credits);
  }
  
  // Now test deduction
  console.log('2. Testing credit deduction (1 credit)...');
  const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_simple', {
    p_user_id: testUserId,
    p_amount: 1
  });
  
  if (deductError) {
    console.error('❌ Credit deduction failed:', deductError.message);
  } else {
    console.log('✅ Credit deduction successful! New balance:', deductResult);
  }
  
  // Check final balance
  console.log('3. Checking final balance...');
  const { data: finalCredits, error: finalError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', testUserId)
    .single();
    
  if (finalError) {
    console.error('❌ Failed to check final balance:', finalError.message);
  } else {
    console.log('✅ Final balance:', finalCredits.credits);
  }
  
  console.log('🎉 Credit system test completed!');
}

testCredits().catch(console.error);
