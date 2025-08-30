const { S3Client, CreateBucketCommand, ListBucketsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

async function createR2Bucket() {
  console.log('🔧 Creating R2 Bucket Setup...\n');

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  try {
    // First, check if bucket already exists
    console.log('🔍 Checking if bucket exists...');
    
    try {
      const headCommand = new HeadBucketCommand({
        Bucket: process.env.R2_BUCKET_NAME,
      });
      await s3Client.send(headCommand);
      console.log('✅ Bucket already exists!');
      
      // Test upload to confirm permissions
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const testContent = `Test upload at ${new Date().toISOString()}`;
      const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: 'test-setup.txt',
        Body: Buffer.from(testContent),
        ContentType: 'text/plain'
      });

      await s3Client.send(putCommand);
      console.log('✅ Upload permissions working!');
      
      console.log('\n🎉 R2 Setup Complete! Your galleries should now work.');
      return;
      
    } catch (headError) {
      if (headError.name === 'NotFound') {
        console.log('📦 Bucket does not exist, creating...');
        
        // Create the bucket
        const createCommand = new CreateBucketCommand({
          Bucket: process.env.R2_BUCKET_NAME,
        });
        
        await s3Client.send(createCommand);
        console.log('✅ Bucket created successfully!');
        
        // Test upload
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const testContent = `Bucket created at ${new Date().toISOString()}`;
        const putCommand = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: 'welcome.txt',
          Body: Buffer.from(testContent),
          ContentType: 'text/plain'
        });

        await s3Client.send(putCommand);
        console.log('✅ Test upload successful!');
        
        console.log('\n🎉 R2 Bucket Created and Ready!');
        console.log('Your application can now save files to permanent storage.');
        
      } else {
        throw headError;
      }
    }

  } catch (error) {
    console.log('❌ R2 setup failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('Access Denied')) {
      console.log('\n💡 Possible solutions:');
      console.log('1. Check your R2 API token has correct permissions');
      console.log('2. Ensure the token includes "Object Read & Write" permissions');
      console.log('3. Verify your Account ID is correct');
      console.log('4. Try creating the bucket manually in Cloudflare dashboard first');
    } else if (error.message.includes('BucketAlreadyExists')) {
      console.log('\n💡 Bucket name already taken - try a different name in .env.local');
    }
  }
}

createR2Bucket().catch(console.error);
