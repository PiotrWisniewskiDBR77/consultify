/**
 * Summarization Service
 *
 * Not implemented in this codebase. Export an explicit marker instead of a self-loading wrapper.
 */
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
      return 'Summary unavailable (LLM not configured).';
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
      return `Summary unavailable (reason: ${msg}).`;
    }
  }

  async summarizeText(text: string) {
    if (!this.llmService) {
      return 'Summary unavailable (LLM not configured).';
    }
    try {
      const response = await this.llmService.call({
        prompt: `Summarize this text:\n\n${text}`,
        capability: 'summarize',
      });
      return response.content;
    } catch (error: unknown) {
      const msg = (error as Error)?.message || String(error);
      return `Summary unavailable (reason: ${msg}).`;
    }
  }
}
