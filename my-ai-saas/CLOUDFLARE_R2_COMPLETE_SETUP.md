# Complete Cloudflare R2 Setup Guide

## Current Status
Your application already has R2 integration implemented but needs environment configuration to work.

## Step 1: Create Cloudflare R2 Bucket

1. **Login to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com/
   - Navigate to R2 Object Storage

2. **Create a New Bucket**
   - Click "Create bucket"
   - Name: `my-ai-saas-storage` (or your preferred name)
   - Choose your region (closest to your users)
   - Click "Create bucket"

## Step 2: Get R2 API Credentials

1. **Navigate to API Tokens**
   - Go to R2 → Manage R2 API tokens
   - Click "Create API token"

2. **Configure Token Permissions**
   - Token name: `my-ai-saas-r2-access`
   - Permissions: 
     - Account: Cloudflare R2:Edit
     - Zone Resources: Include All zones

3. **Save Credentials**
   - Copy the Access Key ID
   - Copy the Secret Access Key
   - Note your Account ID (from dashboard URL)

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Cloudflare R2 Configuration
R2_BUCKET_NAME=my-ai-saas-storage
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-access-key-id-here
R2_SECRET_ACCESS_KEY=your-secret-access-key-here
R2_BUCKET_PUBLIC_URL=https://your-bucket-name.your-account-id.r2.cloudflarestorage.com
```

## Step 4: Test R2 Connection

Run the diagnostic script:
```bash
node check-r2-bucket.js
```

## Step 5: Migrate Existing Content

Once R2 is working, migrate existing data:
```bash
curl -X POST http://localhost:3000/api/social-twin/migrate-to-r2
```

## Step 6: Configure Public Access (Optional)

For direct public access to files:

1. **Custom Domain (Recommended)**
   - Go to R2 bucket settings
   - Connect a custom domain like `cdn.yourdomain.com`
   - Update `R2_BUCKET_PUBLIC_URL` to use your domain

2. **Or Enable Public Access**
   - In bucket settings, enable public access
   - Use the provided public URL

## Verification Checklist

- [ ] R2 bucket created
- [ ] API credentials obtained
- [ ] Environment variables configured
- [ ] R2 connection test passes
- [ ] New generations save to R2
- [ ] Existing content migrated
- [ ] Gallery displays content correctly

## Troubleshooting

**Issue: "No value provided for input HTTP label: Bucket"**
- Solution: Ensure `R2_BUCKET_NAME` is set in `.env.local`

**Issue: "Access Denied"**
- Solution: Check API token permissions include R2:Edit

**Issue: "Black galleries"**
- Solution: Run migration script to transfer existing content

## Production Deployment

For Vercel deployment, add all R2 environment variables to your Vercel project settings:

1. Go to Vercel dashboard
2. Project Settings → Environment Variables
3. Add all R2 variables with production values
4. Redeploy your application

## Expected Behavior After Setup

1. **New Generations**: Automatically saved to R2
2. **Gallery**: Shows all generated content
3. **History**: Persistent across sessions
4. **Performance**: Fast loading from CDN
5. **Storage**: Unlimited capacity via R2

Your R2 integration code is already complete - you just need to configure the environment variables!
