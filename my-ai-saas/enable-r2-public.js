const { S3Client, PutObjectCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

async function enablePublicAccess() {
  try {
    console.log('🔧 Configuring public access for R2 bucket...');
    
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });

    // Create a bucket policy for public read access
    const bucketPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${process.env.R2_BUCKET_NAME}/*`]
        }
      ]
    };

    const policyCommand = new PutBucketPolicyCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy)
    });

    await r2Client.send(policyCommand);
    console.log('✅ Public access policy applied!');

    // Test upload with public access
    const testContent = `Public test at ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf8');
    const fileName = `public-test-${Date.now()}.txt`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: testBuffer,
      ContentType: 'text/plain'
    });

    await r2Client.send(uploadCommand);
    console.log('✅ Test file uploaded:', fileName);

    // Test public access
    const publicUrl = `https://pub-${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev/${fileName}`;
    console.log('🌐 Testing public URL:', publicUrl);

    const response = await fetch(publicUrl);
    if (response.ok) {
      const content = await response.text();
      console.log('✅ Public access working!');
      console.log('📝 Content:', content);
      
      console.log('\n🎉 R2 is fully configured!');
      console.log('Your galleries should now work perfectly.');
      
    } else {
      console.log('⚠️  Public access not yet active. Status:', response.status);
      console.log('💡 Try the Cloudflare dashboard method instead.');
    }

  } catch (error) {
    console.log('❌ Could not configure via API:', error.message);
    console.log('\n💡 Configure public access via Cloudflare dashboard:');
    console.log('1. Go to your R2 bucket settings');
    console.log('2. Click "Settings" tab');
    console.log('3. Under "Public access", click "Allow Access"');
    console.log('4. Confirm by typing the bucket name');
  }
}

enablePublicAccess();
