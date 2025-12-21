import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

const mockAIContextBuilder = {
    buildContext: vi.fn()
};

vi.mock('../../../server/services/aiContextBuilder', () => ({
    default: mockAIContextBuilder
}));

const mockAIPolicyEngine = {
    getEffectivePolicy: vi.fn()
};

vi.mock('../../../server/services/aiPolicyEngine', () => ({
    default: mockAIPolicyEngine
}));

const mockAIService = {
    callLLM: vi.fn()
};

vi.mock('../../../server/services/aiService', () => ({
    default: mockAIService
}));

const mockAIAuditLogger = {
    logWithExplanation: vi.fn().mockResolvedValue({ auditId: 'audit-1' }),
    logInteraction: vi.fn()
};

vi.mock('../../../server/services/aiAuditLogger', () => ({
    default: mockAIAuditLogger
}));

import AIOrchestrator from '../../../server/services/aiOrchestrator.js';

describe('AIOrchestrator', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mocks
        mockAIContextBuilder.buildContext.mockResolvedValue({
            platform: { user: { id: 'u1' } },
            organization: {},
            project: {},
            hash: 'ctx-hash'
        });

        mockAIPolicyEngine.getEffectivePolicy.mockResolvedValue({
            level: 'ASSISTED',
            allowedActions: ['EXPLAIN', 'SUGGEST']
        });

        // Mock LLM response
        mockAIService.callLLM.mockResolvedValue('{"analysis": "test", "intent": "EXPLAIN"}');
    });

    describe('processMessage', () => {
        it('should process user message successfully', async () => {
            const result = await AIOrchestrator.processMessage(
                'How is the project going?',
                'user-1',
                'org-1',
                'proj-1'
            );

            expect(result.success).toBe(true);
            expect(result.response).toBeDefined();
            expect(mockAIContextBuilder.buildContext).toHaveBeenCalled();
            expect(mockAIService.callLLM).toHaveBeenCalled();
            expect(mockAIAuditLogger.logWithExplanation).toHaveBeenCalled();
        });

        it('should handle context building failure', async () => {
            mockAIContextBuilder.buildContext.mockRejectedValue(new Error('Context Error'));

            const result = await AIOrchestrator.processMessage('Hi', 'u1', 'o1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Context Error');
        });
    });

    describe('_detectIntent', () => {
        it('should detect intent from message keywords', () => {
            // Testing internal logic via exposed method if possible, or inferring from behavior
            // Since _detectIntent is likely private/internal, test via processMessage or if exported

            // Assuming we can test internal methods if they are attached to exported object (as in code snippet)
            const intent = AIOrchestrator._detectIntent('Create a task for me');
            expect(intent).toBe('DO');
        });

        it('should default to EXPLAIN intent', () => {
            const intent = AIOrchestrator._detectIntent('What implies this?');
            expect(intent).toBe('EXPLAIN');
        });
    });

    describe('_selectRole', () => {
        // Assuming availability
        it('should select role based on intent', () => {
            const role = AIOrchestrator._selectRole('DO', { level: 'AUTONOMOUS' });
            expect(role).toBe('EXECUTOR');
        });

        it('should downgrade role if policy restricts', () => {
            const role = AIOrchestrator._selectRole('DO', { level: 'ADVISORY' });
            // ADVISORY cannot DO, so fallback
            expect(role).not.toBe('EXECUTOR');
            expect(role).toBe('CONSULTANT'); // or similar fallback
        });
    });

    describe('_buildPrompt', () => {
        // This might depend on implementation details, test valid output structure
        it('should include context and user message', () => {
            const context = { project: { name: 'Test' } };
            const prompt = AIOrchestrator._buildPrompt('Hello', context);

            expect(prompt).toContain('Hello');
            expect(prompt).toContain('Test');
        });
    });

    describe('postProcessResponse', () => {
        it('should add standard footer', () => {
            const rawResponse = 'Here is the analysis.';
            const context = { auditId: '123' };

            const processed = AIOrchestrator.postProcessResponse(rawResponse, context);

            expect(processed).toContain('Here is the analysis.');
            expect(processed).toContain('Confidence:'); // Example check
        });

        it('should handle labels', () => {
            const rawResponse = 'Here is the analysis.';
            const processed = AIOrchestrator.postProcessResponse(rawResponse, {
                labels: ['CONFIDENTIAL']
            });

            expect(processed).toContain('CONFIDENTIAL');
        });
    });
});
