import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { AIPipeline } = require('../../../server/services/ai/aiPipeline');

// Mock dependencies (Need to mock the modules relative to the source file or using vi.mock with absolute paths if tricky)
// Since we are requiring them in the source file, vi.mock needs to match the require path seen by the source file OR simply mock the class instance on the pipeline object if possible.
// However, the source file does `require('./aiGateway')`.
// 'vitest' mocks based on module resolution.
// Let's try mocking with the path relative to the TEST file that resolves to the SAME file.
// Or better: Use `vi.mock` on the full path.

const sourceDir = '../../../server/services/ai';

vi.mock('../../../server/services/ai/aiGateway', () => ({
    AIGateway: class {
        async process() { return true; }
    }
}));

vi.mock('../../../server/services/ai/aiContext', () => ({
    ContextBuilder: class {
        async build({ userId }) {
            return {
                user: { id: userId },
                timestamp: '2025-01-01'
            };
        }
    }
}));

vi.mock('../../../server/services/ai/promptAssembler', () => ({
    PromptAssembler: class {
        async build({ request }) {
            return {
                systemPrompt: "Mock System Prompt",
                messages: [...(request.messages || [])]
            };
        }
    }
}));

vi.mock('../../../server/services/ai/modelRouter', () => ({
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

vi.mock('../../../server/services/ai/llmService', () => ({
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
