// Test R2 upload functionality via live API
require('dotenv').config({ path: '.env.local' });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function testR2UploadDirect() {
  try {
    console.log('🧪 Testing R2 upload directly...');
    
    // Create R2 client with your credentials
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      },
    });

    // Create a test file
    const testContent = `Direct R2 test upload at ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf8');
    const fileName = `test-direct-${Date.now()}.txt`;
    
    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: testBuffer,
      ContentType: 'text/plain'
    });

    console.log('📤 Uploading to R2...');
    await r2Client.send(command);
    
    console.log('✅ R2 Upload successful!');
    console.log('📁 File uploaded:', fileName);
    console.log('🌐 Should be accessible at:', `${process.env.R2_BUCKET_PUBLIC_URL}/${fileName}`);
    
    // Test if accessible via public URL
    const publicUrl = `${process.env.R2_BUCKET_PUBLIC_URL}/${fileName}`;
    try {
      const response = await fetch(publicUrl);
      if (response.ok) {
        const content = await response.text();
        console.log('✅ File is publicly accessible!');
        console.log('📝 Content retrieved:', content);
      } else {
        console.log('⚠️  File uploaded but not publicly accessible');
        console.log('Status:', response.status);
      }
    } catch (fetchError) {
      console.log('⚠️  Could not fetch public URL:', fetchError.message);
    }
    
    console.log('\n🎉 R2 Direct Upload Test Complete!');
    
  } catch (error) {
    console.log('❌ R2 Direct Upload failed:');
    console.log('Error:', error.message);
    console.log('Error Code:', error.name);
    
    if (error.message.includes('Access Denied')) {
      console.log('\n💡 API token permissions issue confirmed.');
    } else if (error.message.includes('NoSuchBucket')) {
      console.log('\n💡 Bucket does not exist or name is incorrect.');
    } else if (error.message.includes('Invalid')) {
      console.log('\n💡 Check your credentials and account ID.');
    }
  }
}

testR2UploadDirect();
