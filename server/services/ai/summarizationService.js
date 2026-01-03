/**
 * Summarization Service
 * 
 * Responsible for compressing conversation history and other text content
 * to optimize context window usage.
 */

import { LLMService } from './llmService.js';
import { aiLogger } from './logger.js';

export class SummarizationService {
    constructor(llmServiceInstance = null) {
        this.llmService = llmServiceInstance || new LLMService();
        // Default model for summarization tasks (efficient model)
        this.defaultModelConfig = {
            provider: 'openai',
            id: 'gpt-4o-mini',
            temperature: 0.3
        };
    }

    /**
     * Summarize a conversation thread into a narrative
     * @param {Array} messages - Array of {role, content} objects
     * @returns {Promise<string>} Narrative summary
     */
    async summarizeConversation(messages) {
        if (!messages || messages.length === 0) return '';

        try {
            const conversationText = messages.map(m =>
                `${m.role.toUpperCase()}: ${m.content}`
            ).join('\n\n');

            const systemPrompt = `You are an expert executive assistant. Summarize the following conversation history into a concise but comprehensive narrative.
            
            GUIDELINES:
            1. Focus on key decisions, user intents, and facts provided.
            2. Ignore pleasantries and filler.
            3. Maintain chronological order.
            4. Capture specific constraints or requirements mentioned by the user.
            5. The summary should be readable as a context briefing for an AI.
            `;

            const result = await this.llmService.call({
                type: 'text',
                modelConfig: this.defaultModelConfig,
                systemPrompt,
                messages: [{ role: 'user', content: conversationText }]
            });

            return result.content;
        } catch (error) {
            aiLogger.error('SummarizationService', `Error summarizing conversation: ${error.message}`);
            // Fallback: Return raw text truncated if error occurs
            return 'Summary unavailable due to error. Raw history preserved in chunks.';
        }
    }

    /**
     * Summarize generic text content
     * @param {string} text - Text to summarize
     * @param {number} maxWords - Target word count
     */
    async summarizeText(text, maxWords = 100) {
        if (!text) return '';

        try {
            const systemPrompt = `Summarize the following text in approximately ${maxWords} words/`;

            const result = await this.llmService.call({
                type: 'text',
                modelConfig: this.defaultModelConfig,
                systemPrompt,
                messages: [{ role: 'user', content: text }]
            });

            return result.content;
        } catch (error) {
            aiLogger.error('SummarizationService', `Error summarizing text: ${error.message}`);
            return text.substring(0, 500) + '...';
        }
    }
}

// Singleton instance
const instance = new SummarizationService();

export const summarizationService = {
    setDependencies(deps) {
        if (deps.llmService) instance.llmService = deps.llmService;
    },
    summarizeConversation: (messages) => instance.summarizeConversation(messages),
    summarizeText: (text, maxWords) => instance.summarizeText(text, maxWords)
};

export default summarizationService;

