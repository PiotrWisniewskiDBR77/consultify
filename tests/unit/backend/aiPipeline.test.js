import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIPipeline } from '../../../server/services/ai/aiPipeline';

// Mocks removed - using Dependency Injection

describe('AIPipeline', () => {
    let pipeline;

    beforeEach(() => {
        pipeline = new AIPipeline({
            gateway: { process: vi.fn().mockResolvedValue(true) },
            contextBuilder: { build: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, timestamp: '2025-01-01' }) },
            promptAssembler: { build: vi.fn().mockResolvedValue({ systemPrompt: "Mock System", messages: [] }) },
            modelRouter: { select: vi.fn().mockResolvedValue({ id: 'mock-model', provider: 'openai', tier: 'STANDARD' }) },
            llmService: { call: vi.fn().mockResolvedValue({ content: "Mock AI Response", usage: { total_tokens: 10 } }) }
        });
    });

    it('should process a basic chat request successfully', async () => {
        const request = {
            type: 'chat',
            userId: 'user-1',
            organizationId: 'org-1',
            capability: 'chat',
            messages: [{ role: 'user', content: 'Hello' }]
        };

        const response = await pipeline.process(request);

        expect(response).toBeDefined();
        expect(response.content).toBe("Mock AI Response");
        expect(response.metadata).toBeDefined();
        expect(response.metadata.model).toBe('mock-model');
    });

    it('should handle errors gracefully', async () => {
        // Mock gateway failure
        pipeline.gateway.process = vi.fn().mockRejectedValue(new Error('Security blocked'));

        const request = { userId: 'bad-user' };

        await expect(pipeline.process(request)).rejects.toThrow('Security blocked');
    });
});
