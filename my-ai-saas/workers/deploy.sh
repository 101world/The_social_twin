#!/bin/bash

echo "🚀 Deploying Cloudflare Workers AI for Social Twin Chat"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate types
echo "🔧 Generating types..."
npx wrangler types

# Deploy to production
echo "🌟 Deploying to production..."
npx wrangler deploy --env production

# Test deployment
echo "🧪 Testing deployment..."
WORKER_URL=$(npx wrangler whoami 2>/dev/null | grep -o 'https://.*\.workers\.dev' || echo "https://social-twin-chat-ai.your-account.workers.dev")

echo "Testing health endpoint..."
curl -s "$WORKER_URL/health" | jq '.'

echo "Testing models endpoint..."
curl -s "$WORKER_URL/models" | jq '.'

echo "✅ Deployment complete!"
echo "📋 Your chat API endpoint: $WORKER_URL/chat"
echo "🔍 Health check: $WORKER_URL/health"
echo "📊 Available models: $WORKER_URL/models"

echo ""
echo "💡 Next steps:"
echo "1. Update your frontend to use: $WORKER_URL/chat"
echo "2. Set up R2 bucket: npx wrangler r2 bucket create social-twin-storage"
echo "3. Set up Vectorize index: npx wrangler vectorize create social-twin-embeddings --dimensions=768"
