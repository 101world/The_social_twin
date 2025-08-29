require('dotenv').config({ path: '.env.local' });
const { S3Client, ListBucketsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

async function testR2Connection() {
  console.log('🧪 Testing Cloudflare R2 Connection...\n');

  try {
    // Initialize R2 client
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });

    // Test 1: List buckets to verify connection
    console.log('1️⃣ Testing connection by listing buckets...');
    const listCommand = new ListBucketsCommand({});
    const response = await r2Client.send(listCommand);

    console.log('✅ Connection successful!');
    console.log('📦 Available buckets:', response.Buckets.map(b => b.Name).join(', '));

    // Check if our bucket exists
    const ourBucket = response.Buckets.find(b => b.Name === process.env.R2_BUCKET_NAME);
    if (ourBucket) {
      console.log(`✅ Your bucket "${process.env.R2_BUCKET_NAME}" exists!`);
    } else {
      console.log(`⚠️ Your bucket "${process.env.R2_BUCKET_NAME}" was not found in the list`);
      console.log('🔧 You may need to create it in Cloudflare R2 dashboard');
    }

    // Test 2: Upload a test file
    console.log('\n2️⃣ Testing file upload...');
    const testContent = `Hello from The Social Twin R2 test! ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf-8');
    const testKey = `test/test-${Date.now()}.txt`;

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: testKey,
      Body: testBuffer,
      ContentType: 'text/plain',
    });

    await r2Client.send(uploadCommand);
    console.log('✅ Test file uploaded successfully!');
    console.log('📁 Test file key:', testKey);

    // Test 3: Generate public URL
    let baseUrl = process.env.R2_PUBLIC_URL;
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const publicUrl = `${baseUrl}/${testKey}`;
    console.log('🌐 Public URL:', publicUrl);

    console.log('\n🎉 R2 integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Environment variables configured');
    console.log('- ✅ Connection to R2 established');
    console.log('- ✅ File upload working');
    console.log('\n🚀 Your Cloudflare R2 is ready for production!');
    console.log('\n💡 Your app will now automatically save all generated media to R2');

  } catch (error) {
    console.error('\n❌ R2 Test Failed:');
    console.error('Error:', error.message);

    if (error.message.includes('NoSuchBucket')) {
      console.log('\n🔧 Solution: Create the bucket in Cloudflare R2 dashboard');
      console.log('1. Go to https://dash.cloudflare.com/');
      console.log('2. Navigate to R2');
      console.log('3. Create bucket: the-social-twin-storage');
    } else if (error.message.includes('InvalidAccessKeyId')) {
      console.log('\n🔧 Solution: Check your API token permissions');
      console.log('1. Go to R2 → API Tokens');
      console.log('2. Ensure token has Object Read & Write permissions');
    } else if (error.message.includes('SignatureDoesNotMatch')) {
      console.log('\n🔧 Solution: Verify your Secret Access Key');
      console.log('1. Check your API token in Cloudflare R2');
      console.log('2. Regenerate if necessary');
    } else if (error.message.includes('handshake')) {
      console.log('\n🔧 SSL Handshake Issue:');
      console.log('This might be due to network restrictions or SSL configuration');
      console.log('Try accessing from a different network or check firewall settings');
    }

    process.exit(1);
  }
}

testR2Connection();
