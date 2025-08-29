# Cloudflare R2 Setup Guide for The Social Twin

## 🚀 **R2 is Already Integrated!**

Your application already has Cloudflare R2 integration implemented. Here's what you need to do to activate it:

## 📋 **Step 1: Create Cloudflare R2 Bucket**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** → **Create bucket**
3. Name it: `the-social-twin-storage`
4. Choose your jurisdiction (preferably closest to your users)

## 🔑 **Step 2: Get API Tokens**

1. In your R2 bucket, go to **API Tokens** tab
2. Click **Create API Token**
3. Set permissions:
   - **Object Read & Write**
   - **Bucket Read & Write**
4. Copy the **Access Key ID** and **Secret Access Key**

## 🌐 **Step 3: Configure Custom Domain (Optional but Recommended)**

1. Go to **DNS** → **Records** in Cloudflare
2. Add a CNAME record:
   - **Name:** `storage` (or your preferred subdomain)
   - **Target:** `[your-account-id].r2.cloudflarestorage.com`
3. In **R2** → **Your Bucket** → **Settings** → **Custom Domains**
4. Add your custom domain: `storage.yourdomain.com`

## ⚙️ **Step 4: Update Environment Variables**

Replace the placeholder values in your `.env.local`:

```bash
# Replace these with your actual values:
CLOUDFLARE_ACCOUNT_ID=your_actual_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_actual_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_actual_secret_access_key
R2_BUCKET_NAME=the-social-twin-storage
R2_PUBLIC_URL=https://storage.yourdomain.com  # Your custom domain
```

## 🔍 **Step 5: Find Your Account ID**

Your Account ID can be found in:
- Cloudflare Dashboard URL: `https://dash.cloudflare.com/[ACCOUNT_ID]/`
- Or in **R2** → **API Tokens** → **Account ID**

## ✅ **What's Already Working**

Your app automatically:
- ✅ Saves generated images/videos to R2
- ✅ Provides permanent URLs for media
- ✅ Handles file uploads via `/api/upload/r2-upload`
- ✅ Organizes files by user: `users/{userId}/{type}/{filename}`

## 🧪 **Test the Integration**

1. Generate an image or video in your app
2. Check the browser console for R2 upload logs
3. Verify the returned URL points to your R2 domain

## 📁 **File Organization**

```
users/
├── {userId}/
│   ├── generations/
│   │   ├── 1234567890-abc123.png
│   │   └── 1234567891-def456.mp4
│   └── uploads/
│       └── user-uploaded-file.jpg
```

## 🚨 **Troubleshooting**

**Common Issues:**
- **"Failed to upload to R2"**: Check your API credentials
- **"Bucket not found"**: Verify bucket name matches exactly
- **Access denied**: Ensure API token has correct permissions

**Debug Logs:**
Check your server console for detailed R2 upload logs with `💾` and `✅` prefixes.

---

## 🎯 **Next Steps**

Once configured, your app will automatically:
- Store all generated media permanently in R2
- Provide fast, global CDN delivery
- Reduce storage costs compared to other providers
- Enable easy media sharing and embedding

**Need help?** Check the Cloudflare R2 documentation or reach out!
