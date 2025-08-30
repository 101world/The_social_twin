const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

async function testR2Setup() {
  console.log('🔍 Testing Cloudflare R2 Configuration...\n');

  // Check environment variables
  const requiredVars = [
    'R2_BUCKET_NAME',
    'CLOUDFLARE_ACCOUNT_ID', 
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n📝 Please create .env.local from .env.template and fill in your R2 credentials.');
    console.log('📖 Follow CLOUDFLARE_R2_COMPLETE_SETUP.md for detailed instructions.\n');
    return;
  }

  console.log('✅ All environment variables found');

  // Test R2 connection
  try {
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    console.log('🔌 Testing R2 bucket connection...');

    // Test listing objects
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 5
    });

    const listResult = await s3Client.send(listCommand);
    console.log(`✅ R2 connection successful! Found ${listResult.KeyCount || 0} objects in bucket.`);

    // Test upload
    console.log('📤 Testing file upload...');
    const testContent = `Test upload at ${new Date().toISOString()}`;
    const putCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: 'test-upload.txt',
      Body: Buffer.from(testContent),
      ContentType: 'text/plain'
    });

    await s3Client.send(putCommand);
    console.log('✅ Test upload successful!');

    console.log('\n🎉 R2 Setup Complete!');
    console.log('Your galleries should now work properly.');
    console.log('\n📋 Next steps:');
    console.log('1. Run a generation test in your app');
    console.log('2. Check if new content appears in galleries');
    console.log('3. Run migration for existing content: curl -X POST http://localhost:3000/api/social-twin/migrate-to-r2');

  } catch (error) {
    console.log('❌ R2 connection failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('No value provided for input HTTP label: Bucket')) {
      console.log('\n💡 Solution: Make sure R2_BUCKET_NAME is set in .env.local');
    } else if (error.message.includes('Access Denied')) {
      console.log('\n💡 Solution: Check your R2 API credentials and permissions');
    } else if (error.message.includes('NoSuchBucket')) {
      console.log('\n💡 Solution: Create the R2 bucket in Cloudflare dashboard');
    }
    
    console.log('\n📖 See CLOUDFLARE_R2_COMPLETE_SETUP.md for troubleshooting');
  }
}

testR2Setup().catch(console.error);
