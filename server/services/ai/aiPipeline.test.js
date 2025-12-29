
const { describe, it, expect, vi, beforeEach } = require('vitest');
const { AIPipeline } = require('./aiPipeline');

// Mock dependencies
vi.mock('./aiGateway', () => ({
    AIGateway: class {
        async process() { return true; }
    }
}));

vi.mock('./aiContext', () => ({
    ContextBuilder: class {
        async build({ userId }) {
            return {
                user: { id: userId },
                timestamp: '2025-01-01'
            };
        }
    }
}));

vi.mock('./promptAssembler', () => ({
    PromptAssembler: class {
        async build({ request }) {
            return {
                systemPrompt: "Mock System Prompt",
                messages: [...(request.messages || [])]
            };
        }
    }
}));

vi.mock('./modelRouter', () => ({
    ModelRouter: class {
        async select() {
            return {
                id: 'mock-model',
                provider: 'openai',
                tier: 'STANDARD'
            };
        }
    }
}));

vi.mock('./llmService', () => ({
    LLMService: class {
        async call({ messages }) {
            return {
                content: "Mock AI Response",
                usage: { total_tokens: 10 }
            };
        }
    }
}));

describe('AIPipeline', () => {
    let pipeline;

    beforeEach(() => {
        pipeline = new AIPipeline();
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
        pipeline.gateway.process = vi.fn().mockRejectedValue(new Error('Security Blocked'));

        const request = { userId: 'bad-user' };

        await expect(pipeline.process(request)).rejects.toThrow('Security Blocked');
    });
});
