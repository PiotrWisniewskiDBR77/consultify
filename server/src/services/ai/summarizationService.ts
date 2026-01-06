/**
 * Summarization Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadSummarization = createCachedLazyService('../../ai/summarizationService.js');

// Export default instance (for backward compatibility)
export default loadSummarization();

// Export named class for tests
export class SummarizationService {
    private llmService: any;

    constructor(llmService?: any) {
        this.llmService = llmService;
    }

    async summarizeConversation(messages: any[]) {
        if (!this.llmService) return 'Summary stub';
        try {
            const text = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
            const response = await this.llmService.call({
                prompt: `Summarize this conversation:\n\n${text}`,
                capability: 'summarize',
            });
            return response.content;
        } catch (error) {
            return 'Summary unavailable';
        }
    }

    async summarizeText(text: string) {
        if (!this.llmService) return 'Summary stub';
        try {
            const response = await this.llmService.call({
                prompt: `Summarize this text:\n\n${text}`,
                capability: 'summarize',
            });
            return response.content;
        } catch (error) {
            return 'Summary unavailable';
        }
    }
}
