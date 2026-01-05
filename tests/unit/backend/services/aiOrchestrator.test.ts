/**
 * AI Orchestrator Service Tests
 * Tests the main AI orchestration logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import AIOrchestrator from '../../../../server/src/services/aiOrchestrator.ts';

// Mock dependencies
const mockAIService = vi.hoisted(() => ({
  generateResponse: vi.fn(),
  validateRequest: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../../../server/src/services/ai/AIPipeline.ts', () => ({
  default: mockAIService,
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
  default: mockLogger,
}));

describe('AIOrchestrator', () => {
  let orchestrator: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import orchestrator - it's exported as an object with methods
    const module = await import('../../../../server/src/services/aiOrchestrator.ts');
    orchestrator = module.default || module;
  });

  describe('processMessage', () => {
    it('should process valid AI messages', async () => {
      // Mock dependencies
      const mockAccessPolicyService = {
        getAIAccessContext: vi.fn().mockResolvedValue({ isPaid: true, trialStatus: null })
      };
      
      if (orchestrator._setDependencies) {
        orchestrator._setDependencies({
          accessPolicyService: mockAccessPolicyService
        });
      }

      // processMessage requires userId, organizationId, etc.
      const result = await orchestrator.processMessage(
        'Test message',
        'user-1',
        'org-1',
        null,
        {}
      );

      expect(result).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const mockAccessPolicyService = {
        getAIAccessContext: vi.fn().mockRejectedValue(new Error('Access error'))
      };
      
      if (orchestrator._setDependencies) {
        orchestrator._setDependencies({
          accessPolicyService: mockAccessPolicyService
        });
      }

      await expect(
        orchestrator.processMessage('Test', 'user-1', 'org-1', null, {})
      ).rejects.toThrow();
    });
  });

  describe('Service exports', () => {
    it('should export processMessage method', () => {
      expect(orchestrator.processMessage).toBeDefined();
      expect(typeof orchestrator.processMessage).toBe('function');
    });
  });
});
