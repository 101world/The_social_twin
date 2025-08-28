import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
});

export async function uploadToR2(
  buffer: Buffer, 
  key: string, 
  contentType: string = 'application/octet-stream'
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);
    
    // Return public URL
    const baseUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, '');
    return `${baseUrl}/${key}`;
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error('Failed to upload to R2');
  }
}

export async function uploadFileToR2(
  file: File, 
  userId: string, 
  prefix: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const timestamp = Date.now();
  const extension = file.name.split('.').pop() || 'png';
  const fileName = `${timestamp}-${Math.random().toString(36).slice(2)}.${extension}`;
  const key = `users/${userId}/${prefix}/${fileName}`;
  
  const contentType = file.type || 'application/octet-stream';
  
  return await uploadToR2(buffer, key, contentType);
}

export async function uploadUrlToR2(
  sourceUrl: string, 
  userId: string, 
  prefix: string,
  extension: string = 'png'
): Promise<string> {
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch source: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const timestamp = Date.now();
    const fileName = `${timestamp}-${Math.random().toString(36).slice(2)}.${extension}`;
    const key = `users/${userId}/${prefix}/${fileName}`;
    
    const contentType = extension === 'mp4' ? 'video/mp4' : 'image/png';
    
    return await uploadToR2(buffer, key, contentType);
  } catch (error) {
    console.error('Upload URL to R2 error:', error);
    throw new Error('Failed to upload URL to R2');
  }
}
