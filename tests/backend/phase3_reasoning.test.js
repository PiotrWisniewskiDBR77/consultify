import { describe, it, expect, vi } from 'vitest';
import AiService from '../../server/services/aiService';

// Mock DB because extractInsights requires KnowledgeService which requires DB.
// Actually, since we are in integration test mode with SQLite, we can just run it if DB is up.
// But callLLM needs to be mocked to avoid spending tokens and time.

describe('Phase 3: Deep Reasoning Engine', () => {

    it('should run Chain of Thought with multiple steps', async () => {
        // Mock callLLM to return step outputs
        const mockCallLLM = vi.spyOn(AiService, 'callLLM');
        mockCallLLM.mockResolvedValueOnce("Step 1 output");
        mockCallLLM.mockResolvedValueOnce("Step 2 output");

        const steps = [
            { name: "Step1", instruction: "Do X" },
            { name: "Step2", instruction: "Do Y" }
        ];

        const result = await AiService.runChainOfThought("Task", steps, "Context", "user1", null);

        expect(mockCallLLM).toHaveBeenCalledTimes(2);
        expect(result).toBe("Step 2 output");

        mockCallLLM.mockRestore();
    });

    it('should extract client context from insights', async () => {
        const mockCallLLM = vi.spyOn(AiService, 'callLLM');
        const mockJson = JSON.stringify({
            idea: { found: false },
            context: { found: true, key: "risk_appetite", value: "Low", confidence: 0.9 }
        });
        mockCallLLM.mockResolvedValue(`\`\`\`json${mockJson}\`\`\``);

        // We need to ensure KnowledgeService.setClientContext doesn't crash functionality
        // Ideally we check if DB insert happened, but for now we check if function completes

        const result = await AiService.extractInsights("Text with context", "chat", "user1", "org1");

        expect(result.context.found).toBe(true);
        expect(result.context.key).toBe("risk_appetite");

        mockCallLLM.mockRestore();
    });

});
