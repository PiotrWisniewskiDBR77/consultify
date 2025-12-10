import { describe, it, expect, vi } from 'vitest';
import AiService from '../../server/services/aiService';
import KnowledgeService from '../../server/services/knowledgeService';
import db from '../../server/database';

// Mock DB interactions for cleaner unit tests or use SQLite in-memory
// For this verification, we rely on the existing SQLite instance (integration style)

describe('Phase 2: Global Learning Loop', () => {

    it('should submit a knowledge candidate via AiService.extractInsights', async () => {
        // Mocking LLM call to return a "found" insight
        AiService.callLLM = vi.fn().mockResolvedValue('```json\n{ "idea": { "found": true, "content": "AI is great", "reasoning": "Because it is", "topic": "AI" } }\n```');

        const result = await AiService.extractInsights("Some conversation text", "chat", "user123");

        expect(result.idea.found).toBe(true);
        expect(result.idea.content).toBe("AI is great");

        // Verify it's in the DB
        const candidates = await KnowledgeService.getCandidates('pending');
        const found = candidates.find(c => c.content === 'AI is great');
        expect(found).toBeDefined();

        if (found) {
            // Cleanup
            await new Promise(r => db.run("DELETE FROM knowledge_candidates WHERE id = ?", [found.id], r));
        }
    });

    it('should inject active strategies into system prompt', async () => {
        // 1. Create a strategy
        const stratId = await KnowledgeService.addStrategy("Test Strategy", "Always be polite");

        // 2. Enhance Prompt
        // Mock getSystemPrompt to return basic string
        // We need to mock the internal getSystemPrompt or rely on it returning something.
        // Since getSystemPrompt talks to DB, it should work.

        const enhanced = await AiService.enhancePrompt('CONSULTANT', 'chat');

        expect(enhanced).toContain('GLOBAL STRATEGIC PRIORITIES');
        expect(enhanced).toContain('Test Strategy');
        expect(enhanced).toContain('Always be polite'); // The description

        // Cleanup
        await new Promise(r => db.run("DELETE FROM global_strategies WHERE id = ?", [stratId], r));
    });

});
