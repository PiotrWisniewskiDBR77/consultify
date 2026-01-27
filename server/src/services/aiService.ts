// @ts-nocheck
/**
 * Ai Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Minimal compatibility layer.
 *
 * NOTE: The previous `aiService.js` shim was self-re-exporting and created a
 * resolution loop. Until the real implementation is restored, expose a small
 * surface that callers can depend on without breaking typecheck/runtime.
 */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type GenerateChatResponseParams = {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
};
export type GenerateChatResponseResult = { content: string };

export async function generateChatResponse(
  _params: GenerateChatResponseParams
): Promise<GenerateChatResponseResult> {
  return { content: '' };
}

export default { generateChatResponse };
