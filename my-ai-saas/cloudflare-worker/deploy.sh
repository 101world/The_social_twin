#!/bin/bash
# Deploy RunPod Proxy to Cloudflare Workers

echo "🚀 Deploying RunPod Proxy to Cloudflare Workers..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Navigate to worker directory
cd cloudflare-worker

# Login to Cloudflare (if not already logged in)
echo "Checking Cloudflare authentication..."
wrangler whoami || wrangler login

# Deploy the worker
echo "Deploying worker..."
wrangler deploy

echo "✅ RunPod Proxy deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Update your domain DNS to point to Cloudflare"
echo "2. Add your custom domain in Cloudflare Workers dashboard"
echo "3. Update NEXT_PUBLIC_CLOUDFLARE_RUNPOD_PROXY in your environment variables"
echo "4. Set your RunPod URLs in the Cloudflare Worker environment variables"
echo ""
echo "🌐 Your proxy will be available at: https://runpod-proxy.your-subdomain.workers.dev"
