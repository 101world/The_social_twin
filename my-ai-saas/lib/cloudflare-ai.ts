// Cloudflare Workers AI Chat Integration
// Only handles chat mode - image/video stays on RunPod

interface CloudflareAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  mode: 'normal' | 'prompt' | 'creative';
}

export class CloudflareAIService {
  private baseUrl = 'https://101world-ai-api.welcometo101world.workers.dev';
  
  // Perfected model configurations for each specialized mode
  private modes = {
    // Normal Mode: Superior general AI for daily tasks & world knowledge
    normal: {
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', // Latest, fastest 70B model
      temperature: 0.7,
      max_tokens: 2048,
      systemPrompt: "You are an advanced AI assistant focused on providing accurate, helpful answers for daily tasks and general world knowledge. Be practical, clear, and comprehensive in your responses."
    },
    
    // Prompt Mode: Precision AI for image generation prompting
    prompt: {
      model: '@cf/meta/llama-3.1-8b-instruct-fast', // Fast & precise for prompt crafting
      temperature: 0.3, // Low temperature for precision
      max_tokens: 1024,
      systemPrompt: "You are a specialized AI for creating perfect image generation prompts. Focus on detailed, artistic descriptions with proper terminology for photography, art styles, lighting, and composition. Be precise and creative."
    },
    
    // Creative Mode: Specialized for scripts and storytelling
    creative: {
      model: '@cf/meta/llama-3.1-70b-instruct', // Powerful model for creativity
      temperature: 0.9, // High temperature for creativity
      max_tokens: 3072,
      systemPrompt: "You are a master storyteller and scriptwriter. Create engaging narratives, develop compelling characters, and craft beautiful prose. Focus on creativity, emotional depth, and narrative structure."
    },
    
    // Think Mode: Deep reasoning with DeepSeek R1
    think: {
      model: '@cf/deepseek/deepseek-r1-distill-qwen-32b', // Advanced reasoning model
      temperature: 0.4, // Balanced for reasoning
      max_tokens: 4096,
      systemPrompt: "You are an advanced reasoning AI. Think step-by-step, analyze problems deeply, provide logical reasoning chains, and explore multiple perspectives before concluding."
    },
    
    // Vision Mode: Best vision model for text + image understanding
    vision: {
      model: '@cf/meta/llama-4-scout-17b-16e-instruct', // Latest multimodal model
      temperature: 0.7,
      max_tokens: 2048,
      systemPrompt: "You are an advanced vision AI. Analyze images thoroughly, understand visual context, and provide detailed descriptions and insights about what you see."
    }
  };
  
  constructor(workerUrl = 'https://social-twin-chat-ai.welcometo101world.workers.dev') {
    this.baseUrl = workerUrl;
  }

  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    mode: 'normal' | 'prompt' | 'creative' | 'think' = 'normal',
    userId?: string,
    sessionId?: string
  ): Promise<CloudflareAIResponse> {
    try {
      const modeConfig = this.modes[mode];
      
      // Add system prompt at the beginning
      const messagesWithSystem = [
        { role: 'system' as const, content: modeConfig.systemPrompt },
        ...messages
      ];

      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesWithSystem,
          mode,
          userId,
          sessionId: sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          modelConfig: modeConfig
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Cloudflare AI Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Cloudflare AI chat error:', error);
      throw error;
    }
  }

  // Vision-enabled chat for when user uploads image + text
  async chatWithVision(
    messages: Array<{ 
      role: 'user' | 'assistant' | 'system'; 
      content: string | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: { url: string };
      }>
    }>,
    userId?: string,
    sessionId?: string
  ): Promise<CloudflareAIResponse> {
    try {
      const visionConfig = this.modes.vision;
      
      // Add vision-specific system prompt
      const messagesWithSystem = [
        { role: 'system' as const, content: visionConfig.systemPrompt },
        ...messages
      ];

      const response = await fetch(`${this.baseUrl}/chat-vision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesWithSystem,
          mode: 'vision',
          userId,
          sessionId: sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          modelConfig: visionConfig
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Cloudflare AI Vision Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Cloudflare AI vision chat error:', error);
      throw error;
    }
  }

  // RAG functionality for future custom behavior training
  async embedText(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`Embedding error: ${response.status}`);
      }

      const data = await response.json();
      return data.embeddings;
    } catch (error) {
      console.error('Cloudflare AI embedding error:', error);
      throw error;
    }
  }

  // Simplified method for single message with conversation context
  async sendMessage(
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    mode: 'normal' | 'prompt' | 'creative' | 'think' = 'normal',
    userId?: string
  ): Promise<string> {
    // Build messages array from conversation history + new user message
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage }
    ];

    const response = await this.chat(messages, mode, userId);
    return response.content;
  }

  // Send message with image (automatically uses vision mode)
  async sendMessageWithImage(
    userMessage: string,
    imageUrl: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    userId?: string
  ): Promise<string> {
    // Build multimodal message
    const messages = [
      ...conversationHistory,
      { 
        role: 'user' as const, 
        content: [
          { type: 'text' as const, text: userMessage },
          { type: 'image_url' as const, image_url: { url: imageUrl } }
        ]
      }
    ];

    const response = await this.chatWithVision(messages, userId);
    return response.content;
  }

  getModeDescriptions() {
    return {
      normal: "Superior general AI for daily tasks & world knowledge",
      prompt: "Precision AI for perfect image generation prompts", 
      creative: "Master storyteller for scripts & narratives",
      think: "Deep reasoning AI for complex problem solving",
      vision: "Advanced vision AI (auto-activated with images)"
    };
  }

  async getModels(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch models:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const cloudflareAI = new CloudflareAIService();
