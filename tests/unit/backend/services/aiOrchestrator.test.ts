/**
 * AI Orchestrator Service Tests
 * Tests the main AI orchestration logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mocks = vi.hoisted(() => {
  return {
    aiService: {
      generateResponse: vi.fn().mockResolvedValue({
        id: 'resp-123',
        content: 'Mocked AI response',
        usage: { totalTokens: 100 },
      }),
      validateRequest: vi.fn().mockReturnValue(true),
    },
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    db: {
      get: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue([]),
      run: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    },
    cache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../../../../server/src/services/ai/AIPipeline.ts', () => ({
  default: mocks.aiService,
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
  default: mocks.logger,
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => mocks.db,
  default: mocks.db,
}));

vi.mock('../../../../server/src/services/redis/CacheService.js', () => ({
  appCache: mocks.cache,
  sessionCache: mocks.cache,
}));

import AIOrchestrator from '../../../../server/src/services/aiOrchestrator.ts';

describe('AIOrchestrator', () => {
  let orchestrator: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import orchestrator
    const module = await import('../../../../server/src/services/aiOrchestrator.ts');
    orchestrator = module.default || module;
  });

  describe('processMessage', () => {
    it('should process valid AI messages', async () => {
      // Mock dependencies
      const mockAccessPolicyService = {
        getAIAccessContext: vi.fn().mockResolvedValue({
          isPaid: true,
          trialStatus: null,
          organizationType: 'ENTERPRISE',
          isDemo: false,
          isTrial: false,
          aiResponseBadge: 'PAID',
          dailyAIUsage: { count: 0, limit: 100 },
          allowedAIRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'],
        }),
        incrementUsage: vi.fn().mockResolvedValue(true),
      };

      const mockAIContextBuilder = {
        buildContext: vi.fn().mockResolvedValue({
          id: 'ctx-123',
          project: {
            projectName: 'Test Project',
            currentPhase: 'Assessment',
            phaseNumber: 2,
            completedInitiatives: 0,
            initiativeCount: 5,
          },
          execution: {
            userTasks: [],
            pendingDecisions: [],
            blockers: [],
          },
          knowledge: {
            previousDecisions: [],
          },
          external: {
            internetEnabled: false,
          },
          platform: {
            role: 'ADMIN',
          },
          organization: {
            organizationName: 'Test Org',
            activeProjectCount: 1,
          },
          currentScreen: 'dashboard',
          selectedObjectId: null,
          selectedObjectType: null,
          context: {},
          policy: {},
          preferences: {},
          projectMemory: {
            memoryCount: 0,
            majorDecisions: [],
            phaseTransitions: [],
          },
          dataSources: [],
        }),
      };

      const mockAIPolicyEngine = {
        getEffectivePolicy: vi.fn().mockResolvedValue({
          id: 'pol-1',
          rules: [],
          activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'],
          preferredModel: 'gpt-4',
          regulatoryModeEnabled: false,
        }),
      };

      const mockAIMemoryManager = {
        getUserPreferences: vi.fn().mockResolvedValue({
          preferred_tone: 'EXPERT',
          education_mode: false,
        }),
        analyzeContextTokens: vi.fn().mockReturnValue({
          status: { utilizationPercent: 10 },
          breakdown: { total: 100 },
          limits: { availableForContext: 4000 },
        }),
        getProjectMemory: vi.fn().mockResolvedValue({ memoryCount: 0 }),
        buildProjectMemorySummary: vi.fn().mockResolvedValue({
          memoryCount: 0,
          majorDecisions: [],
          phaseTransitions: [],
        }),
        autoTrimContext: vi.fn().mockImplementation(({ memory }) => ({
          trimmed: false,
          memory,
        })),
      };

      const mockTokenBillingService = {
        getTokenBalance: vi.fn().mockResolvedValue({ balance: 1000 }),
        reportUsage: vi.fn().mockResolvedValue(true),
      };

      const mockAIRoleGuard = {
        getRoleCapabilities: vi.fn().mockReturnValue([]),
        getRoleDescription: vi.fn().mockReturnValue('Mock Description'),
        getRoleConfig: vi.fn().mockResolvedValue(null),
      };

      const mockAIResponsePostProcessor = {
        process: vi.fn().mockImplementation((res) => res),
      };

      const mockAIExplainabilityService = {
        buildAIExplanation: vi.fn().mockReturnValue({
          confidenceLevel: 'HIGH',
          reasoning: 'Mock reasoning',
        }),
      };

      if (orchestrator._setDependencies) {
        orchestrator._setDependencies({
          accessPolicyService: mockAccessPolicyService,
          aiContextBuilder: mockAIContextBuilder,
          aiMemoryManager: mockAIMemoryManager,
          aiPolicyEngine: mockAIPolicyEngine,
          tokenBillingService: mockTokenBillingService,
          aiRoleGuard: mockAIRoleGuard,
          aiPipeline: mocks.aiService,
          aiResponsePostProcessor: mockAIResponsePostProcessor,
          aiExplainabilityService: mockAIExplainabilityService,
        });
      }

      // processMessage requires userId, organizationId, etc.
      const result = await orchestrator.processMessage('Test message', 'user-1', 'org-1', null, {});

      expect(result).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const mockAccessPolicyService = {
        getAIAccessContext: vi.fn().mockRejectedValue(new Error('Access error')),
      };

      if (orchestrator._setDependencies) {
        orchestrator._setDependencies({
          accessPolicyService: mockAccessPolicyService,
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
