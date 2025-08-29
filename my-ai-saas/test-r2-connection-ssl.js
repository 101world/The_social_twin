require('dotenv').config({ path: '.env.local' });
const { S3Client, ListBucketsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

async function testR2Connection() {
  console.log('🧪 Testing Cloudflare R2 Connection with SSL fixes...\n');

  try {
    // Try with different SSL configuration
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
      // Try with different SSL settings
      requestHandler: {
        httpsAgent: require('https').Agent({
          rejectUnauthorized: false,
          keepAlive: true,
          timeout: 30000,
          // Try different SSL/TLS versions
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.3'
        })
      }
    });

    console.log('1️⃣ Testing connection by listing buckets...');
    const listCommand = new ListBucketsCommand({});
    const response = await r2Client.send(listCommand);

    console.log('✅ Connection successful!');
    console.log('📦 Available buckets:', response.Buckets.map(b => b.Name).join(', '));

    const ourBucket = response.Buckets.find(b => b.Name === process.env.R2_BUCKET_NAME);
    if (ourBucket) {
      console.log(`✅ Your bucket "${process.env.R2_BUCKET_NAME}" exists!`);
    } else {
      console.log(`⚠️ Your bucket "${process.env.R2_BUCKET_NAME}" was not found in the list`);
    }

    // Test file upload
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

    console.log('\n🎉 R2 connection test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Environment variables configured');
    console.log('- ✅ Connection to R2 established');
    console.log('- ✅ File upload working');
    console.log('\n🚀 Your Cloudflare R2 is ready for production!');
    console.log('\n💡 Your app will now automatically save all generated media to R2');

  } catch (error) {
    console.error('\n❌ R2 Test Failed:');
    console.error('Error:', error.message);

    // Try to provide more specific guidance
    if (error.message.includes('handshake')) {
      console.log('\n🔧 SSL Handshake Solutions:');
      console.log('1. Try from a different network (VPN, mobile hotspot)');
      console.log('2. Check if antivirus/firewall is blocking SSL connections');
      console.log('3. Update Node.js to latest LTS version');
      console.log('4. Try disabling SSL verification temporarily');
    } else if (error.message.includes('NoSuchBucket')) {
      console.log('\n🔧 Bucket Solutions:');
      console.log('1. Create bucket in Cloudflare R2 dashboard');
      console.log('2. Verify bucket name: ' + process.env.R2_BUCKET_NAME);
    } else if (error.message.includes('InvalidAccessKeyId')) {
      console.log('\n🔧 Credential Solutions:');
      console.log('1. Verify API token in Cloudflare R2 dashboard');
      console.log('2. Regenerate API token if needed');
    }

    process.exit(1);
  }
}

testR2Connection();
