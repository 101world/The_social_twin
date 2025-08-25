# Cloudflare RunPod Proxy Setup Guide

## 🎯 Purpose
This Cloudflare Worker creates a stable proxy URL for your RunPod instances, ensuring seamless mobile and web compatibility.

## 🚀 Setup Steps

### 1. Deploy the Cloudflare Worker

#### Option A: Using PowerShell (Windows)
```powershell
cd cloudflare-worker
.\deploy.ps1
```

#### Option B: Using Bash (Linux/Mac)
```bash
cd cloudflare-worker
chmod +x deploy.sh
./deploy.sh
```

#### Option C: Manual Deployment
```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

### 2. Configure Your Custom Domain

1. **Add Domain to Cloudflare** (if not already)
   - Go to Cloudflare dashboard
   - Add your domain
   - Update your domain's nameservers

2. **Set up Worker Route**
   - Go to Workers & Pages → Your worker
   - Click "Settings" → "Triggers"
   - Add custom domain: `runpod.yourdomain.com`

### 3. Update Environment Variables

#### In Cloudflare Worker:
```bash
wrangler secret put RUNPOD_IMAGE_URL
# Enter your RunPod image URL when prompted

wrangler secret put RUNPOD_VIDEO_URL
# Enter your RunPod video URL when prompted
```

#### In Your Next.js App (.env.local):
```env
NEXT_PUBLIC_CLOUDFLARE_RUNPOD_PROXY=https://runpod.yourdomain.com
NEXT_PUBLIC_USE_CLOUDFLARE_PROXY=true
```

### 4. Update Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add:
   - `NEXT_PUBLIC_CLOUDFLARE_RUNPOD_PROXY`: `https://runpod.yourdomain.com`
   - `NEXT_PUBLIC_USE_CLOUDFLARE_PROXY`: `true`

### 5. Test the Proxy

```bash
# Test image generation endpoint
curl https://runpod.yourdomain.com/image/health

# Test video generation endpoint  
curl https://runpod.yourdomain.com/video/health
```

## 🔧 How It Works

1. **Mobile/Web Request**: Your app sends requests to `https://runpod.yourdomain.com/image`
2. **Cloudflare Worker**: Receives the request and forwards it to the appropriate RunPod URL
3. **RunPod Processing**: Your RunPod instance processes the request
4. **Response**: Cloudflare Worker forwards the response back with proper CORS headers

## 🌟 Benefits

- ✅ **Stable URL**: Never change your app code when RunPod URLs change
- ✅ **Mobile Compatible**: CORS headers and reliable DNS resolution
- ✅ **Fast**: Cloudflare's global edge network
- ✅ **Reliable**: Built-in redundancy and error handling
- ✅ **Secure**: No direct RunPod URL exposure

## 🔄 URL Mapping

| Mode | Client Request | Proxied To |
|------|----------------|------------|
| Image | `runpod.yourdomain.com/image/*` | `RUNPOD_IMAGE_URL/*` |
| Video | `runpod.yourdomain.com/video/*` | `RUNPOD_VIDEO_URL/*` |
| Text | `runpod.yourdomain.com/text/*` | `RUNPOD_TEXT_URL/*` |
| Modify | `runpod.yourdomain.com/image-modify/*` | `RUNPOD_IMAGE_MODIFY_URL/*` |

## 🛠️ Troubleshooting

### Worker Not Receiving Requests
- Check DNS propagation: `nslookup runpod.yourdomain.com`
- Verify Worker route is correctly configured
- Check SSL certificate is valid

### RunPod Connection Issues
- Verify environment variables in Cloudflare Worker
- Test direct RunPod URL access
- Check RunPod instance status

### CORS Issues
- The worker automatically adds CORS headers
- Ensure your domain is properly configured
- Check browser developer tools for specific errors

## 📝 Environment Variables Reference

### Cloudflare Worker Environment Variables
- `RUNPOD_IMAGE_URL`: Your RunPod image generation endpoint
- `RUNPOD_VIDEO_URL`: Your RunPod video generation endpoint  
- `RUNPOD_TEXT_URL`: Your RunPod text generation endpoint
- `RUNPOD_IMAGE_MODIFY_URL`: Your RunPod image modification endpoint
- `DEFAULT_IMAGE_URL`: Fallback image URL

### Next.js Environment Variables
- `NEXT_PUBLIC_CLOUDFLARE_RUNPOD_PROXY`: Your Cloudflare Worker URL
- `NEXT_PUBLIC_USE_CLOUDFLARE_PROXY`: Enable/disable proxy (true/false)
- `ALLOW_CLIENT_RUNPOD_URL`: Allow client URL override (true/false)
