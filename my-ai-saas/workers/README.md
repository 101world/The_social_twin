# Cloudflare Workers AI Setup for Social Twin Chat Mode

## 🎯 Overview
This setup adds Cloudflare Workers AI **only for chat mode** with 3 options:
- **Normal**: Standard helpful assistant (Llama 3.1 8B, temperature 0.7)
- **Prompt**: Expert prompt engineering help (Llama 3.1 8B, temperature 0.3) 
- **Creative**: Imaginative responses (Llama 3.1 70B, temperature 0.9)

**Image generation, image modify, and video generation stay on RunPod unchanged.**

## 🚀 Quick Setup

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. Deploy Workers AI
```bash
cd workers
npm install
npx wrangler deploy --env production
```

### 3. Set up Storage (Optional)
```bash
# Create R2 bucket for conversation history
npx wrangler r2 bucket create social-twin-storage

# Create Vectorize index for semantic search  
npx wrangler vectorize create social-twin-embeddings --dimensions=768
```

### 4. Update Frontend
Replace your chat API calls to use Cloudflare Workers:

```typescript
import { cloudflareAI } from '@/lib/cloudflare-ai';

// For text mode only - keep existing RunPod for image/video
if (mode === 'text') {
  const response = await cloudflareAI.chat(
    messages,
    chatMode, // 'normal' | 'prompt' | 'creative'
    userId,
    sessionId
  );
  
  setMessages(prev => [...prev, {
    id: Date.now().toString(),
    role: 'assistant',
    content: response.content,
    createdAt: new Date().toISOString()
  }]);
}
```

## 📋 API Endpoints

After deployment, your worker will be available at:
- **Chat**: `https://your-worker.workers.dev/chat`
- **Health**: `https://your-worker.workers.dev/health` 
- **Models**: `https://your-worker.workers.dev/models`

## 🔧 Configuration

### Chat Modes
| Mode | Model | Temperature | Use Case |
|------|--------|-------------|----------|
| Normal | Llama 3.1 8B | 0.7 | General assistance |
| Prompt | Llama 3.1 8B | 0.3 | Prompt engineering |
| Creative | Llama 3.1 70B | 0.9 | Creative writing |

### Environment Variables
Set these in your Cloudflare dashboard:
- `ENVIRONMENT`: "production"

### Bindings (Auto-configured)
- `AI`: Cloudflare Workers AI
- `STORAGE`: R2 bucket for conversations
- `VECTORIZE`: Embeddings for search

## 🎯 Integration Points

### Frontend Changes Needed
1. **Add chat mode dropdown** in your UI (normal/prompt/creative)
2. **Route text mode** to Cloudflare Workers AI
3. **Keep image/video** routing to existing RunPod endpoints
4. **Update environment variables** with your worker URL

### Example Frontend Integration
```typescript
// In your social-twin page.tsx
const handleSubmit = async () => {
  if (mode === 'text') {
    // Use Cloudflare Workers AI
    const response = await cloudflareAI.chat(messages, chatMode);
    // Handle response...
  } else if (mode === 'image' || mode === 'image-modify' || mode === 'video') {
    // Keep existing RunPod logic unchanged
    // Your current image/video generation code...
  }
};
```

## 💰 Cost Benefits
- **10,000 free requests/day** with Cloudflare Workers AI
- **No GPU costs** for chat functionality  
- **Global edge deployment** for faster responses
- **Automatic scaling** with zero infrastructure management

## 🔍 Testing
```bash
# Test health
curl https://your-worker.workers.dev/health

# Test models
curl https://your-worker.workers.dev/models

# Test chat
curl -X POST https://your-worker.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "mode": "normal"
  }'
```

## 🚀 Deployment Commands
```bash
# Development
npm run dev

# Production deploy
npm run deploy:production

# View logs
npm run tail
```

This keeps your existing RunPod setup for image/video while adding powerful, cost-effective AI chat capabilities! 🎉
