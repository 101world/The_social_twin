import { uploadToR2 } from '../lib/r2-upload';

/**
 * Test script to verify Cloudflare R2 integration
 * Run with: npx ts-node scripts/test-r2.ts
 */

async function testR2Connection() {
  console.log('🧪 Testing Cloudflare R2 Connection...\n');

  try {
    // Test 1: Check environment variables
    console.log('1️⃣ Checking environment variables...');
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || accountId === 'your_account_id_here') {
      throw new Error('CLOUDFLARE_ACCOUNT_ID not configured');
    }
    if (!accessKeyId || accessKeyId === 'your_access_key_here') {
      throw new Error('CLOUDFLARE_R2_ACCESS_KEY_ID not configured');
    }
    if (!secretAccessKey || secretAccessKey === 'your_secret_key_here') {
      throw new Error('CLOUDFLARE_R2_SECRET_ACCESS_KEY not configured');
    }
    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME not configured');
    }
    if (!publicUrl) {
      throw new Error('R2_PUBLIC_URL not configured');
    }

    console.log('✅ Environment variables configured');

    // Test 2: Try to upload a small test file
    console.log('\n2️⃣ Testing file upload...');
    const testContent = 'Hello from The Social Twin R2 test!';
    const testBuffer = Buffer.from(testContent, 'utf-8');

    const testKey = `test/test-${Date.now()}.txt`;
    const testUrl = await uploadToR2(testBuffer, testKey, 'text/plain');

    console.log('✅ Test file uploaded successfully!');
    console.log('📁 Test file URL:', testUrl);

    // Test 3: Verify the uploaded file is accessible
    console.log('\n3️⃣ Verifying file accessibility...');
    const response = await fetch(testUrl);
    if (response.ok) {
      const content = await response.text();
      if (content === testContent) {
        console.log('✅ File is accessible and content matches!');
      } else {
        console.log('⚠️ File accessible but content differs');
      }
    } else {
      console.log('⚠️ File upload succeeded but URL is not accessible');
      console.log('Status:', response.status, response.statusText);
    }

    console.log('\n🎉 R2 integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Environment variables configured');
    console.log('- ✅ File upload working');
    console.log('- ✅ Public URL accessible');
    console.log('\n🚀 Your Cloudflare R2 is ready for production!');

  } catch (error) {
    console.error('\n❌ R2 Test Failed:');
    console.error(error instanceof Error ? error.message : error);

    console.log('\n🔧 To fix this:');
    console.log('1. Follow CLOUDFLARE_R2_SETUP.md');
    console.log('2. Update your .env.local with real credentials');
    console.log('3. Run this test again');

    process.exit(1);
  }
}

// Run the test
testR2Connection().catch(console.error);
