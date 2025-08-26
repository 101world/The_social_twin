import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

// Types for Cloudflare Workers environment
interface Env {
  AI: any; // Cloudflare Workers AI
  STORAGE: R2Bucket; // R2 bucket for documents
  VECTORIZE: VectorizeIndex; // Vectorize for embeddings
  CACHE: KVNamespace; // KV for caching
  OPENAI_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
}

// Request schemas
const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.union([
      z.string(),
      z.array(z.object({
        type: z.enum(['text', 'image_url']),
        text: z.string().optional(),
        image_url: z.object({ url: z.string() }).optional()
      }))
    ])
  })),
  mode: z.enum(['normal', 'prompt', 'creative', 'think', 'vision']).default('normal'),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  modelConfig: z.object({
    model: z.string(),
    temperature: z.number(),
    max_tokens: z.number(),
    systemPrompt: z.string()
  }).optional()
});

const EmbeddingRequestSchema = z.object({
  text: z.string(),
  namespace: z.string().default('default')
});

const BatchRequestSchema = z.object({
  requests: z.array(z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string()
    })),
    mode: z.enum(['normal', 'prompt', 'creative']).optional(),
    userId: z.string().optional()
  }))
});

const app = new Hono<{ Bindings: Env }>();

// CORS for frontend
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.com', 'https://welcometo101world.com', 'https://the-social-twin.vercel.app'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// Model configurations based on specialized modes
const getModelConfig = (mode: 'normal' | 'prompt' | 'creative' | 'think' | 'vision') => {
  switch (mode) {
    case 'normal':
      return {
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', // Latest 70B for superior general knowledge
        temperature: 0.7,
        max_tokens: 2048,
        systemPrompt: "You are Atom, an advanced AI assistant focused on providing accurate, helpful answers for daily tasks and general world knowledge. When greeted (hi, hello, hey, etc.), introduce yourself by saying 'Hey, my name is Atom!' If asked about your mission or purpose, mention that you're here to democratize AI for the world. Be practical, clear, and comprehensive in your responses."
      };
    case 'prompt':
      return {
        model: '@cf/meta/llama-3.1-8b-instruct-fast', // Fast & precise for prompt crafting
        temperature: 0.3,
        max_tokens: 1024,
        systemPrompt: "You are Atom, a specialized AI for creating perfect image generation prompts. When greeted (hi, hello, hey, etc.), introduce yourself by saying 'Hey, my name is Atom!' Focus on detailed, artistic descriptions with proper terminology for photography, art styles, lighting, and composition. Be precise and creative."
      };
    case 'creative':
      return {
        model: '@cf/meta/llama-3.1-70b-instruct', // Powerful model for storytelling
        temperature: 0.9,
        max_tokens: 3072,
        systemPrompt: "You are Atom, a master storyteller and scriptwriter. When greeted (hi, hello, hey, etc.), introduce yourself by saying 'Hey, my name is Atom!' Create engaging narratives, develop compelling characters, and craft beautiful prose. Focus on creativity, emotional depth, and narrative structure."
      };
    case 'think':
      return {
        model: '@cf/deepseek/deepseek-r1-distill-qwen-32b', // Advanced reasoning
        temperature: 0.4,
        max_tokens: 4096,
        systemPrompt: "You are Atom, an advanced reasoning AI. When greeted (hi, hello, hey, etc.), introduce yourself by saying 'Hey, my name is Atom!' Think step-by-step, analyze problems deeply, provide logical reasoning chains, and explore multiple perspectives before concluding."
      };
    case 'vision':
      return {
        model: '@cf/meta/llama-4-scout-17b-16e-instruct', // Best vision model
        temperature: 0.7,
        max_tokens: 2048,
        systemPrompt: "You are Atom, an advanced vision AI. When greeted (hi, hello, hey, etc.), introduce yourself by saying 'Hey, my name is Atom!' Analyze images thoroughly, understand visual context, and provide detailed descriptions and insights about what you see."
      };
    default:
      return {
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        temperature: 0.7,
        max_tokens: 2048,
        systemPrompt: "You are Atom, an advanced AI assistant focused on providing accurate, helpful answers for daily tasks and general world knowledge. When greeted (hi, hello, hey, etc.), introduce yourself by saying 'Hey, my name is Atom!' If asked about your mission or purpose, mention that you're here to democratize AI for the world. Be practical, clear, and comprehensive in your responses."
      };
  }
};

// Vision model configuration for Creative mode with image understanding
const getVisionModelConfig = (mode: 'normal' | 'prompt' | 'creative') => {
  switch (mode) {
    case 'creative':
      return {
        model: '@cf/meta/llama-4-scout-17b-16e-instruct', // Latest multimodal
        temperature: 0.9,
        max_tokens: 2048
      };
    case 'normal':
      return {
        model: '@cf/meta/llama-3.2-11b-vision-instruct',
        temperature: 0.7,
        max_tokens: 1024
      };
    case 'prompt':
      return {
        model: '@cf/mistralai/mistral-small-3.1-24b-instruct', // Vision + 128k context
        temperature: 0.3,
        max_tokens: 1024
      };
    default:
      return {
        model: '@cf/meta/llama-4-scout-17b-16e-instruct',
        temperature: 0.7,
        max_tokens: 1024
      };
  }
};

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: 'production'
  });
});

// Chat endpoint - handles text generation with specialized modes
app.post('/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, mode, userId, sessionId, modelConfig } = ChatRequestSchema.parse(body);
    
    const config = modelConfig || getModelConfig(mode);
    
    // Add system prompt to messages if not already present
    const hasSystemPrompt = messages.some(msg => msg.role === 'system');
    const messagesWithSystem = hasSystemPrompt 
      ? messages 
      : [{ role: 'system', content: config.systemPrompt }, ...messages];
    
    // Use Cloudflare Workers AI for text generation
    const response = await c.env.AI.run(config.model, {
      messages: messagesWithSystem,
      temperature: config.temperature,
      max_tokens: config.max_tokens
    });

    // Store conversation for user session
    if (userId && sessionId) {
      const conversationKey = `conv:${userId}:${sessionId}`;
      await c.env.CACHE.put(conversationKey, JSON.stringify({
        messages: [...messagesWithSystem, { role: 'assistant', content: response.response }],
        mode: mode,
        timestamp: new Date().toISOString()
      }), { expirationTtl: 86400 }); // 24 hours
    }

    return c.json({
      content: response.response,
      usage: response.usage || {},
      model: config.model,
      mode: mode
    });

  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ 
      error: 'Failed to generate response',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Vision-capable chat endpoint for image + text combination
app.post('/chat-vision', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, mode, userId, sessionId } = ChatRequestSchema.parse(body);
    
    // Always use vision mode for vision chat
    const config = getModelConfig('vision');
    
    // Use vision-capable model
    const response = await c.env.AI.run(config.model, {
      messages: messages,
      temperature: config.temperature,
      max_tokens: config.max_tokens
    });

    // Store conversation for user session
    if (userId && sessionId) {
      const conversationKey = `conv-vision:${userId}:${sessionId}`;
      await c.env.CACHE.put(conversationKey, JSON.stringify({
        messages: [...messages, { role: 'assistant', content: response.response }],
        mode: 'vision',
        timestamp: new Date().toISOString()
      }), { expirationTtl: 86400 });
    }

    return c.json({
      content: response.response,
      usage: response.usage || {},
      model: config.model,
      mode: 'vision'
    });

  } catch (error) {
    console.error('Vision chat error:', error);
    return c.json({ 
      error: 'Failed to generate vision response',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Embeddings for RAG
app.post('/embed', async (c) => {
  try {
    const body = await c.req.json();
    const { text } = z.object({ text: z.string() }).parse(body);

    // Generate embeddings using Cloudflare Workers AI
    const embeddings = await c.env.AI.run('@cf/baai/bge-large-en-v1.5', {
      text: [text]
    });

    return c.json({
      embeddings: embeddings.data[0],
      dimensions: embeddings.data[0].length
    });

  } catch (error) {
    console.error('Embeddings error:', error);
    return c.json({ 
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Batch processing endpoint
app.post('/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { requests } = BatchRequestSchema.parse(body);

    const responses = await Promise.all(
      requests.map(async (request) => {
        const config = getModelConfig(request.mode || 'normal');
        
        try {
          const response = await c.env.AI.run(config.model, {
            messages: request.messages,
            temperature: config.temperature,
            max_tokens: config.max_tokens
          });

          return {
            content: response.response,
            usage: response.usage || {},
            model: config.model,
            mode: request.mode || 'normal'
          };
        } catch (error) {
          return {
            error: 'Failed to process request',
            details: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return c.json({ responses });

  } catch (error) {
    console.error('Batch processing error:', error);
    return c.json({ 
      error: 'Failed to process batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get available models endpoint
app.get('/models', (c) => {
  return c.json({
    models: {
      'text-models': {
        'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct-fast',
        'llama-3.1-70b': '@cf/meta/llama-3.1-70b-instruct',
        'llama-3.3-70b': '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      },
      'vision-models': {
        'llama-4-scout': '@cf/meta/llama-4-scout-17b-16e-instruct',
        'llama-3.2-vision': '@cf/meta/llama-3.2-11b-vision-instruct',
        'mistral-vision': '@cf/mistralai/mistral-small-3.1-24b-instruct'
      },
      'reasoning-models': {
        'deepseek-r1': '@cf/deepseek/deepseek-r1-distill-qwen-32b',
        'qwq-reasoning': '@cf/qwen/qwq-32b'
      },
      'code-models': {
        'qwen-coder': '@cf/qwen/qwen2.5-coder-32b-instruct'
      },
      'embedding-models': {
        'bge-large': '@cf/baai/bge-large-en-v1.5',
        'bge-m3': '@cf/baai/bge-m3'
      }
    },
    'batch-support': true,
    'vision-support': true,
    'rag-support': true
  });
});

// Search endpoint for RAG
app.post('/search', async (c) => {
  try {
    const body = await c.req.json();
    const { query, namespace, limit } = z.object({
      query: z.string(),
      namespace: z.string().default('default'),
      limit: z.number().min(1).max(20).default(5)
    }).parse(body);

    // Generate query embedding
    const queryEmbedding = await c.env.AI.run('@cf/baai/bge-large-en-v1.5', {
      text: [query]
    });

    // Search in Vectorize
    const results = await c.env.VECTORIZE.query(queryEmbedding.data[0], {
      namespace: namespace,
      topK: limit,
      returnValues: false,
      returnMetadata: true
    });

    return c.json({
      query: query,
      results: results.matches.map(match => ({
        id: match.id,
        score: match.score,
        text: match.metadata?.text,
        timestamp: match.metadata?.timestamp
      }))
    });

  } catch (error) {
    console.error('Search error:', error);
    return c.json({ 
      error: 'Failed to search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
