require('dotenv').config({ path: '.env.local' });
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function testR2Connection() {
  console.log('🧪 Testing Cloudflare R2 Connection...\n');

  try {
    // Initialize R2 client with minimal configuration
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });

    console.log('1️⃣ Testing basic connection...');
    const listCommand = new ListBucketsCommand({});
    const response = await r2Client.send(listCommand);

    console.log('✅ Connection successful!');
    console.log('📦 Available buckets:', response.Buckets.map(b => b.Name).join(', '));

    const ourBucket = response.Buckets.find(b => b.Name === process.env.R2_BUCKET_NAME);
    if (ourBucket) {
      console.log(`✅ Your bucket "${process.env.R2_BUCKET_NAME}" exists and is accessible!`);
      console.log('\n🎉 R2 is working! Your setup is correct.');
      console.log('\n💡 Your app will now automatically save all generated media to R2');
    } else {
      console.log(`⚠️ Your bucket "${process.env.R2_BUCKET_NAME}" was not found in the list`);
      console.log('🔧 Make sure the bucket name matches exactly');
    }

  } catch (error) {
    console.error('\n❌ R2 Test Failed:');
    console.error('Error:', error.message);

    if (error.message.includes('NoSuchBucket')) {
      console.log('\n🔧 Bucket Issue:');
      console.log('1. Verify bucket name in Cloudflare R2 dashboard');
      console.log('2. Make sure bucket name matches:', process.env.R2_BUCKET_NAME);
      console.log('3. Check if bucket is in the same account');
    } else if (error.message.includes('InvalidAccessKeyId')) {
      console.log('\n🔧 API Token Issue:');
      console.log('1. Verify API token in Cloudflare R2 dashboard');
      console.log('2. Ensure token has Object Read & Write permissions');
      console.log('3. Check if token is expired');
      console.log('4. Try regenerating the API token');
    } else if (error.message.includes('SignatureDoesNotMatch')) {
      console.log('\n🔧 Secret Key Issue:');
      console.log('1. Verify the Secret Access Key is correct');
      console.log('2. Make sure you copied the entire key');
      console.log('3. Try regenerating the API token');
    } else if (error.message.includes('handshake')) {
      console.log('\n🔧 SSL/Network Issue:');
      console.log('1. Try from a different network');
      console.log('2. Check firewall/antivirus settings');
      console.log('3. Try disabling VPN if using one');
    }

    console.log('\n🔍 Current Configuration:');
    console.log('Account ID:', process.env.CLOUDFLARE_ACCOUNT_ID);
    console.log('Bucket:', process.env.R2_BUCKET_NAME);
    console.log('Access Key (first 8):', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID.substring(0, 8) + '...');

    process.exit(1);
  }
}

testR2Connection();
