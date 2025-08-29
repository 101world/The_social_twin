#!/bin/bash

# Cloudflare Workers AI Setup Script
# Run this script to set up your complete AI backend

echo "🚀 Setting up Cloudflare Workers AI for 101World..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Login to Cloudflare (if not already logged in)
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami > /dev/null 2>&1; then
    echo "Please login to Cloudflare:"
    wrangler login
fi

# 3. Create R2 bucket for document storage
echo "🗄️ Creating R2 bucket..."
wrangler r2 bucket create 101world-documents --compatibility-date 2024-08-26

# 4. Create KV namespace for caching
echo "🔑 Creating KV namespace..."
KV_ID=$(wrangler kv:namespace create "CACHE" --preview false | grep "id" | cut -d'"' -f4)
KV_PREVIEW_ID=$(wrangler kv:namespace create "CACHE" --preview | grep "id" | cut -d'"' -f4)

echo "✅ KV Namespace created:"
echo "   Production ID: $KV_ID"
echo "   Preview ID: $KV_PREVIEW_ID"

# 5. Create Vectorize index for embeddings
echo "🔍 Creating Vectorize index..."
wrangler vectorize create 101world-embeddings --dimensions=768 --metric=cosine

# 6. Update wrangler.toml with actual IDs
echo "⚙️ Updating configuration..."
sed -i.bak "s/your-kv-namespace-id/$KV_ID/g" wrangler.toml
sed -i.bak "s/your-preview-kv-id/$KV_PREVIEW_ID/g" wrangler.toml

# 7. Set up secrets (you'll need to add these manually)
echo "🔒 Setting up secrets..."
echo "Please set the following secrets manually:"
echo "   wrangler secret put OPENAI_API_KEY    # Optional fallback"
echo "   wrangler secret put CLERK_SECRET_KEY  # For authentication"

# 8. Deploy the worker
echo "🚀 Deploying worker..."
wrangler deploy

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Your AI API is now available at:"
echo "   https://101world-ai-api.your-subdomain.workers.dev"
echo ""
echo "Next steps:"
echo "1. Set your secrets: wrangler secret put OPENAI_API_KEY"
echo "2. Update your frontend to use the new endpoint"
echo "3. Test with: curl https://your-worker.workers.dev/health"
echo ""
