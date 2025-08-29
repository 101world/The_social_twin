require('dotenv').config({ path: '.env.local' });

console.log('🔍 R2 Setup Verification Checklist');
console.log('=====================================');

console.log('\n1️⃣ Environment Variables:');
console.log('Account ID:', process.env.CLOUDFLARE_ACCOUNT_ID || '❌ Missing');
console.log('Access Key:', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
console.log('Secret Key:', process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
console.log('Bucket Name:', process.env.R2_BUCKET_NAME || '❌ Missing');
console.log('Public URL:', process.env.R2_PUBLIC_URL || '❌ Missing');

console.log('\n2️⃣ Generated URLs:');
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const bucketName = process.env.R2_BUCKET_NAME;
console.log('R2 Endpoint:', accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '❌ Cannot generate');
console.log('Bucket URL:', accountId && bucketName ? `https://${accountId}.r2.cloudflarestorage.com/${bucketName}` : '❌ Cannot generate');

console.log('\n3️⃣ API Token Format Check:');
const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

if (accessKey && secretKey) {
  console.log('Access Key Length:', accessKey.length, '(should be 32 hex chars)');
  console.log('Secret Key Length:', secretKey.length, '(should be 64 hex chars)');
  console.log('Keys are different:', accessKey !== secretKey ? '✅ Good' : '⚠️ Same (unusual)');

  // Check if they look like hex
  const hexRegex = /^[a-f0-9]+$/i;
  console.log('Access Key is hex:', hexRegex.test(accessKey) ? '✅' : '❌');
  console.log('Secret Key is hex:', hexRegex.test(secretKey) ? '✅' : '❌');
}

console.log('\n4️⃣ Next Steps:');
console.log('✅ Go to https://dash.cloudflare.com/');
console.log('✅ Navigate to R2 section');
console.log('✅ Verify bucket "' + (bucketName || 'your-bucket-name') + '" exists');
console.log('✅ Check API Tokens section');
console.log('✅ Ensure your token has:');
console.log('   - Object Read & Write permissions');
console.log('   - Access to the specific bucket');
console.log('   - Token is not expired');

console.log('\n5️⃣ If everything looks correct:');
console.log('🔄 Try regenerating the API token');
console.log('🔄 Test from a different network');
console.log('🔄 Check firewall/antivirus settings');
