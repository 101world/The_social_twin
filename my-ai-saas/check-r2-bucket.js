const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

async function checkBucket() {
  try {
    console.log('🔍 Checking bucket:', process.env.R2_BUCKET_NAME);
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 10
    });

    const response = await r2Client.send(command);
    console.log('✅ Bucket exists!');
    console.log('📁 Objects found:', response.Contents?.length || 0);

    if (response.Contents && response.Contents.length > 0) {
      console.log('📋 Recent files:');
      response.Contents.slice(0, 5).forEach(obj => {
        console.log(`  - ${obj.Key} (${Math.round((obj.Size || 0) / 1024)}KB) - ${obj.LastModified?.toISOString()}`);
      });
    } else {
      console.log('📭 No files found in bucket');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.name === 'NoSuchBucket') {
      console.log('🚨 Bucket does not exist! Please create it in Cloudflare R2 dashboard.');
    } else if (error.message.includes('handshake')) {
      console.log('🔒 SSL Handshake issue - this is common on local networks');
      console.log('💡 Try from a different network or check firewall settings');
    }
  }
}

checkBucket();
