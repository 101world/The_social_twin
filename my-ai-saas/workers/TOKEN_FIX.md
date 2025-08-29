# 🔧 Cloudflare Token Issue - Quick Fix

## Problem
Your current token is missing some permissions for deployment.

## Solution
Go back to: https://dash.cloudflare.com/profile/api-tokens

### Option 1: Use "Edit Cloudflare Workers" Template
1. Click "Create Token"
2. Use "Edit Cloudflare Workers" template
3. This includes all needed permissions automatically

### Option 2: Create Custom Token
Add these permissions:
- ✅ **Account:Read**
- ✅ **User:Read** 
- ✅ **Workers:Edit**
- ✅ **Workers AI:Edit**

## After Getting New Token
```powershell
# Set new token
$env:CLOUDFLARE_API_TOKEN = "your-new-token-here"

# Verify it works
wrangler whoami

# Deploy
npx wrangler deploy
```

## Quick Test
Once deployed, your API will be at:
`https://social-twin-chat-ai.your-subdomain.workers.dev`

The worker code is ready - just need the right token permissions! 🚀
