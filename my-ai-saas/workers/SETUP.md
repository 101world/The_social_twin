# Cloudflare Workers AI - Manual Setup Guide

## 🔐 Authentication Options

### Option 1: Browser Login (Recommended)
1. Open browser and visit: https://dash.cloudflare.com
2. Sign in to your Cloudflare account (free signup if needed)
3. Run: `wrangler login` and complete browser authentication

### Option 2: API Token (Alternative)
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Copy the token and run:
   ```powershell
   $env:CLOUDFLARE_API_TOKEN = "your-token-here"
   ```

## 🚀 Deployment Commands

Once authenticated, deploy with:

```bash
# Install dependencies
npm install

# Deploy to production
npx wrangler deploy --env production

# Test deployment
npx wrangler tail
```

## 📋 What You Need

**Required:**
- ✅ Cloudflare account (free)
- ✅ Wrangler CLI (installed)
- ✅ Authentication (browser or token)

**Included:**
- ✅ All worker code ready
- ✅ TypeScript configuration
- ✅ AI model configurations
- ✅ CORS setup
- ✅ Error handling

## 🔧 After Deployment

Your worker URL will be:
`https://social-twin-chat-ai.{your-subdomain}.workers.dev`

Update your frontend to use this URL for chat mode only.

## 💡 Cost

- **Free tier**: 10,000 requests/day
- **Paid tier**: $5/month for 10M requests
- **No GPU costs** - just API calls

The setup is ready to go once you authenticate! 🎯
