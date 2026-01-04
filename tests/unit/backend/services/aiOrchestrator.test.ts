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
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new AIOrchestrator();
  });

  describe('processRequest', () => {
    it('should process valid AI requests', async () => {
      const request = {
        prompt: 'Test prompt',
        context: 'Test context',
        model: 'gpt-4',
      };

      const expectedResponse = {
        content: 'Generated response',
        usage: { tokens: 100 },
      };

      mockAIService.generateResponse.mockResolvedValue(expectedResponse);

      const result = await orchestrator.processRequest(request);

      expect(result).toEqual(expectedResponse);
      expect(mockAIService.generateResponse).toHaveBeenCalledWith(request);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const request = { prompt: 'Test prompt' };
      const error = new Error('AI service error');

      mockAIService.generateResponse.mockRejectedValue(error);

      await expect(orchestrator.processRequest(request)).rejects.toThrow('AI service error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate request parameters', async () => {
      const invalidRequest = { prompt: '' };

      mockAIService.validateRequest.mockReturnValue(false);

      await expect(orchestrator.processRequest(invalidRequest)).rejects.toThrow();
      expect(mockAIService.validateRequest).toHaveBeenCalledWith(invalidRequest);
    });
  });

  describe('getStatus', () => {
    it('should return orchestrator status', () => {
      const status = orchestrator.getStatus();

      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('lastRequest');
    });
  });
});
