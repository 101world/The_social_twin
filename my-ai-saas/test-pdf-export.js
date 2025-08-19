const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testPDFExport() {
  console.log('🧪 Testing PDF export with credit deduction...');
  
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
  
  const testUserId = 'user_2lYOUcTEk3oSPWXPXkZs4kx3HIE';
  
  // Check credits before export
  console.log('1. Checking credits before PDF export...');
  const { data: beforeCredits } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', testUserId)
    .single();
    
  console.log('Credits before export:', beforeCredits?.credits || 'No credits found');
  
  // Test PDF export endpoint (you can modify this payload as needed)
  console.log('2. Testing PDF export endpoint...');
  
  const exportPayload = {
    userId: testUserId,
    content: 'Test PDF content for credit deduction verification',
    // Add any other required fields for your PDF export
  };
  
  try {
    const response = await fetch('http://localhost:3001/api/social-twin/export-pdf-layout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(exportPayload)
    });
    
    if (response.ok) {
      console.log('✅ PDF export request successful');
      console.log('Response status:', response.status);
    } else {
      console.log('⚠️ PDF export request failed');
      console.log('Response status:', response.status);
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.error('❌ PDF export request failed:', error.message);
  }
  
  // Check credits after export
  console.log('3. Checking credits after PDF export...');
  const { data: afterCredits } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', testUserId)
    .single();
    
  console.log('Credits after export:', afterCredits?.credits || 'No credits found');
  
  if (beforeCredits && afterCredits) {
    const deducted = beforeCredits.credits - afterCredits.credits;
    console.log(`🎯 Credits deducted: ${deducted}`);
    
    if (deducted === 1) {
      console.log('🎉 SUCCESS! Credit deduction is working perfectly!');
    } else if (deducted === 0) {
      console.log('⚠️ WARNING: No credits were deducted. Check the export endpoint logic.');
    } else {
      console.log(`⚠️ UNEXPECTED: ${deducted} credits were deducted instead of 1.`);
    }
  }
}

testPDFExport().catch(console.error);
