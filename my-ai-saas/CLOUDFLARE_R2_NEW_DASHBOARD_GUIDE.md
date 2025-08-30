# 🚀 Complete Cloudflare R2 Setup Guide (2025 Dashboard)

## Step 1: Access R2 in Cloudflare Dashboard

1. **Login to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com/
   - Use your account credentials

2. **Navigate to R2**
   - In the left sidebar, look for **"R2 Object Storage"**
   - Click on **"R2 Object Storage"**
   - If you don't see it, look under **"Storage"** or **"Products"**

## Step 2: Create R2 Bucket

1. **Create Bucket**
   - Click **"Create bucket"** (blue button)
   - **Bucket name**: `the-social-twin-storage` (use exactly this name)
   - **Region**: Choose closest to your users (e.g., Eastern North America)
   - **Storage Class**: Standard
   - Leave other settings as default
   - Click **"Create bucket"**

2. **Configure Bucket Settings**
   - Once created, click on your bucket name
   - Go to **"Settings"** tab
   - Under **"Public access"**, click **"Allow Access"**
   - Confirm by typing the bucket name
   - This makes files publicly readable via URL

## Step 3: Create R2 API Token (CRITICAL STEP)

1. **Navigate to R2 API Tokens**
   - In the R2 dashboard, look for **"Manage R2 API tokens"** 
   - OR go to **"My Profile"** → **"API Tokens"** → **"R2 API Tokens"**

2. **Create New Token**
   - Click **"Create API token"**
   - **Token name**: `social-twin-r2-access`

3. **Configure Permissions (IMPORTANT)**
   - **Permissions**: Select **"Admin Read & Write"** 
   - **Account resources**: Include **"All accounts"**
   - **Zone resources**: Include **"All zones"**
   - **Bucket scope**: Select **"Apply to specific buckets only"**
   - Choose your bucket: `the-social-twin-storage`

4. **Additional Settings**
   - **Client IP Address Filtering**: Leave blank (allow all IPs)
   - **TTL**: Leave as default (no expiration)

## Step 4: Save Credentials

After creating the token, you'll see:

```
Access Key ID: [Copy this - starts with letters/numbers]
Secret Access Key: [Copy this - long alphanumeric string]
Token: [This is for other uses, not needed for S3 API]
```

**IMPORTANT**: Copy these immediately - they won't be shown again!

## Step 5: Update Your Environment File

Replace your R2 credentials in `.env.local`:

```bash
# Replace these with your NEW credentials
CLOUDFLARE_ACCOUNT_ID=ced616f33f6492fd708a8e897b61b953  # Keep this same
R2_ACCESS_KEY_ID=[YOUR_NEW_ACCESS_KEY_ID]
R2_SECRET_ACCESS_KEY=[YOUR_NEW_SECRET_ACCESS_KEY]
CLOUDFLARE_R2_ACCESS_KEY_ID=[YOUR_NEW_ACCESS_KEY_ID]     # Same as above
CLOUDFLARE_R2_SECRET_ACCESS_KEY=[YOUR_NEW_SECRET_ACCESS_KEY]  # Same as above
R2_BUCKET_NAME=the-social-twin-storage
R2_BUCKET_PUBLIC_URL=https://ced616f33f6492fd708a8e897b61b953.r2.cloudflarestorage.com/the-social-twin-storage
```

## Step 6: Test the Setup

After updating credentials:

```bash
node test-r2-upload-real.js
```

You should see:
```
✅ R2 Upload successful!
✅ File is publicly accessible!
```

## Step 7: Configure Custom Domain (Optional but Recommended)

1. **In your R2 bucket settings**
   - Go to **"Settings"** → **"Custom Domains"**
   - Click **"Connect Domain"**
   - Enter: `cdn.thesocialtwin.com` (or your subdomain)
   - Follow DNS setup instructions

2. **Update environment if using custom domain**
   ```bash
   R2_BUCKET_PUBLIC_URL=https://cdn.thesocialtwin.com
   ```

## Troubleshooting Common Issues

### "Access Denied" Error
- **Solution**: Recreate API token with "Admin Read & Write" permissions
- Make sure bucket scope includes your specific bucket

### "NoSuchBucket" Error  
- **Solution**: Double-check bucket name matches exactly in environment file
- Ensure bucket was created successfully

### "Invalid Credentials" Error
- **Solution**: Copy the Access Key ID and Secret Access Key correctly
- Make sure no extra spaces or characters

### Files Upload but Not Accessible
- **Solution**: Enable public access on the bucket
- Check the public URL format is correct

## Expected Result

After proper setup:
1. ✅ New AI generations save to permanent R2 storage
2. ✅ Gallery shows all generated content  
3. ✅ History persists across sessions
4. ✅ Fast loading from Cloudflare CDN
5. ✅ No more black galleries!

## Next Steps After R2 Works

1. Test a generation in your app
2. Check if new content appears in gallery
3. Run migration for existing content:
   ```bash
   curl -X POST http://localhost:3000/api/social-twin/migrate-to-r2
   ```

The key difference in the new dashboard is ensuring the API token has **"Admin Read & Write"** permissions specifically scoped to your bucket!
