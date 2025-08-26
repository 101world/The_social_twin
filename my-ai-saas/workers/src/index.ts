export interface Env {
  AI: Ai;
  STORAGE: R2Bucket;
  VECTORIZE: VectorizeIndex;
  ENVIRONMENT: string;
}

type ChatMode = 'normal' | 'prompt' | 'creative';

interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  mode: ChatMode;
  userId?: string;
  sessionId?: string;
}

interface ChatResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  mode: ChatMode;
}

// Model configurations for different chat modes
const CHAT_CONFIGS = {
  normal: {
    model: '@cf/meta/llama-3.1-8b-instruct',
    temperature: 0.7,
    max_tokens: 2048,
    system_prompt: "You are a helpful AI assistant. Provide clear, accurate, and concise responses."
  },
  prompt: {
    model: '@cf/meta/llama-3.1-8b-instruct', 
    temperature: 0.3,
    max_tokens: 4096,
    system_prompt: "You are an expert prompt engineer and AI assistant. Help users create better prompts, refine their requests, and provide structured, detailed responses. Focus on clarity, specificity, and actionable guidance."
  },
  creative: {
    model: '@cf/meta/llama-3.1-70b-instruct',
    temperature: 0.9,
    max_tokens: 3072,
    system_prompt: "You are a creative AI assistant. Think outside the box, be imaginative, and provide unique perspectives. Use storytelling, analogies, and creative approaches in your responses."
  }
} as const;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    try {
      const url = new URL(request.url);
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development'
        }), { 
          headers: corsHeaders 
        });
      }

      // Chat endpoint
      if (url.pathname === '/chat' && request.method === 'POST') {
        const chatRequest: ChatRequest = await request.json();
        
        if (!chatRequest.messages || !Array.isArray(chatRequest.messages)) {
          return new Response(JSON.stringify({ 
            error: 'Invalid request: messages array required' 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        const mode = chatRequest.mode || 'normal';
        const config = CHAT_CONFIGS[mode];
        
        if (!config) {
          return new Response(JSON.stringify({ 
            error: `Invalid chat mode: ${mode}` 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Prepare messages with system prompt
        const messages = [
          { role: 'system' as const, content: config.system_prompt },
          ...chatRequest.messages
        ];

        // Call Cloudflare Workers AI
        const aiResponse = await env.AI.run(config.model, {
          messages: messages,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
        });

        // Extract response content
        const content = aiResponse.response || 'No response generated';
        
        const response: ChatResponse = {
          content,
          model: config.model,
          mode,
          usage: {
            prompt_tokens: aiResponse.meta?.usage?.prompt_tokens || 0,
            completion_tokens: aiResponse.meta?.usage?.completion_tokens || 0,
            total_tokens: aiResponse.meta?.usage?.total_tokens || 0,
          }
        };

        // Optional: Store conversation in R2 for history
        if (chatRequest.sessionId) {
          try {
            const storageKey = `conversations/${chatRequest.userId || 'anonymous'}/${chatRequest.sessionId}.json`;
            const conversationData = {
              messages: [...chatRequest.messages, { role: 'assistant', content }],
              mode,
              timestamp: new Date().toISOString(),
              model: config.model
            };
            
            await env.STORAGE.put(storageKey, JSON.stringify(conversationData), {
              metadata: { 
                userId: chatRequest.userId || 'anonymous',
                mode,
                timestamp: new Date().toISOString()
              }
            });
          } catch (storageError) {
            console.error('Failed to store conversation:', storageError);
            // Don't fail the request if storage fails
          }
        }

        return new Response(JSON.stringify(response), { 
          headers: corsHeaders 
        });
      }

      // Models endpoint - list available models
      if (url.pathname === '/models' && request.method === 'GET') {
        const models = Object.entries(CHAT_CONFIGS).map(([mode, config]) => ({
          mode,
          model: config.model,
          description: config.system_prompt.split('.')[0] + '.',
          temperature: config.temperature,
          max_tokens: config.max_tokens
        }));

        return new Response(JSON.stringify({ models }), { 
          headers: corsHeaders 
        });
      }

      // 404 for unknown endpoints
      return new Response(JSON.stringify({ 
        error: 'Not Found',
        available_endpoints: ['/health', '/chat', '/models']
      }), { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  },
};
