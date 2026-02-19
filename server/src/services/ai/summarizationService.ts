/**
 * Summarization Service
 *
 * Not implemented in this codebase. Export an explicit marker instead of a self-loading wrapper.
 */
import { AppError } from '../../utils/ErrorHandler.js';

const summarizationService = { __unavailable__: true } as const;

export default summarizationService;

// Export named class for tests
export class SummarizationService {
  private llmService: any;

  constructor(llmService?: any) {
    this.llmService = llmService;
  }

  async summarizeConversation(messages: any[]) {
    if (!this.llmService) {
      throw new AppError(
        'AI summarization is not available (LLM not configured)',
        503,
        'FEATURE_UNAVAILABLE'
      );
    }
    try {
      const text = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      const response = await this.llmService.call({
        prompt: `Summarize this conversation:\n\n${text}`,
        capability: 'summarize',
      });
      return response.content;
    } catch (error: unknown) {
      const msg = (error as Error)?.message || String(error);
      throw new AppError('AI summarization failed', 503, 'FEATURE_UNAVAILABLE', { message: msg });
    }
  }

  async summarizeText(text: string) {
    if (!this.llmService) {
      throw new AppError(
        'AI summarization is not available (LLM not configured)',
        503,
        'FEATURE_UNAVAILABLE'
      );
    }
    try {
      const response = await this.llmService.call({
        prompt: `Summarize this text:\n\n${text}`,
        capability: 'summarize',
      });
      return response.content;
    } catch (error: unknown) {
      const msg = (error as Error)?.message || String(error);
      throw new AppError('AI summarization failed', 503, 'FEATURE_UNAVAILABLE', { message: msg });
    }
  }
}
