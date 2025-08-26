// Cloudflare Workers AI Chat Integration with Credit System
// Integrates with existing credit deduction infrastructure

interface CloudflareAIResponse {
  response: string;
  creditsUsed: number;
  remainingCredits: number;
  mode: string;
  model?: string;
}

export class CloudflareAIService {
  private baseUrl = '/api/cloudflare-ai'; // Use our credit-aware API endpoint
  
  // Credit costs for different AI modes
  private creditCosts = {
    normal: 2,    // General AI - moderate cost
    prompt: 1,    // Fast prompt generation - lower cost
    creative: 3,  // Creative writing - higher cost
    think: 4,     // Advanced reasoning - highest cost
    vision: 5,    // Vision + text - premium cost
  };

  // Send a text message with proper credit deduction
  async sendMessage(
    message: string,
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [],
    mode: 'normal' | 'prompt' | 'creative' | 'think' = 'normal',
    userId: string
  ): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationHistory,
          mode,
          userId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        
        if (response.status === 402) {
          throw new Error(`Insufficient credits. Required: ${errorData?.required || 'unknown'}, Available: ${errorData?.available || 'unknown'}`);
        }
        
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data: CloudflareAIResponse = await response.json();
      return data.response;
    } catch (error) {
      console.error('Cloudflare AI Error:', error);
      throw error;
    }
  }

  // Send a message with image (vision mode) with proper credit deduction
  async sendMessageWithImage(
    message: string,
    imageData: string,
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [],
    userId: string
  ): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          imageData,
          conversationHistory,
          userId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        
        if (response.status === 402) {
          throw new Error(`Insufficient credits. Required: ${errorData?.required || 'unknown'}, Available: ${errorData?.available || 'unknown'}`);
        }
        
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data: CloudflareAIResponse = await response.json();
      return data.response;
    } catch (error) {
      console.error('Cloudflare AI Vision Error:', error);
      throw error;
    }
  }

  // Get credit cost for a specific mode
  getCreditCost(mode: 'normal' | 'prompt' | 'creative' | 'think' | 'vision'): number {
    return this.creditCosts[mode] || 2;
  }

  // Legacy compatibility method for vision
  async chatWithVision(
    prompt: string,
    imageData: string,
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [],
    userId: string
  ): Promise<string> {
    return this.sendMessageWithImage(prompt, imageData, conversationHistory, userId);
  }
}

// Export a singleton instance
export const cloudflareAI = new CloudflareAIService();
