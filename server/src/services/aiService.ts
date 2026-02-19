// @ts-nocheck
/**
 * Ai Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Compatibility layer that routes chat generation through the real LLM service.
 */

import { AppError } from '../utils/ErrorHandler.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type GenerateChatResponseParams = {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
};
export type GenerateChatResponseResult = { content: string };

export async function generateChatResponse(
  params: GenerateChatResponseParams
): Promise<GenerateChatResponseResult> {
  try {
    const llmService = (await import('./ai/llmService.js')).default as any;
    if (!llmService?.call) {
      throw new AppError('LLM service is not available', 503, 'FEATURE_UNAVAILABLE');
    }

    const result = (await llmService.call({
      type: 'text',
      modelConfig: { id: params.model || 'default' },
      systemPrompt: params.systemPrompt || 'You are a helpful assistant.',
      messages: params.messages,
      maxTokens: params.maxTokens,
      temperature: 0.2,
      breakerOptions: {
        // Interactive endpoints should fail fast; callers can retry with their own UX.
        retryAttempts: 0,
      },
      timeoutMs: 30000,
    })) as any;

    const content = String(result?.content || '').trim();
    if (!content) {
      throw new AppError('LLM returned empty response', 503, 'FEATURE_UNAVAILABLE');
    }

    return { content };
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError('AI chat generation failed', 503, 'FEATURE_UNAVAILABLE', { message: msg });
  }
}

export default { generateChatResponse };
