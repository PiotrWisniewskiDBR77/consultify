/**
 * AI Schema
 */

export interface AIRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  context?: Record<string, any>;
}

export interface AIResponse {
  id: string;
  content: string;
  model: string;
  tokensUsed: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  createdAt: string;
}

export const validateAIRequest = (request: any): request is AIRequest => {
  return typeof request.prompt === 'string' && request.prompt.length > 0;
};

export const AISchemas = {
  AIRequest: {} as AIRequest,
  AIResponse: {} as AIResponse,
};
