/**
 * AIPolicyEngine - Unit Tests (L1)
 * Tests for AI policy evaluation and enforcement
 *
 * Coverage target: 95%+
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock DbPromise
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => mockDbGet(...args),
  run: (...args: any[]) => mockDbRun(...args),
}));

// Mock logger
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock aiRoleGuard
vi.mock('../../../server/src/services/aiRoleGuard.js', () => ({
  default: {
    getRoleCapabilities: vi.fn().mockResolvedValue({}),
    getProjectRole: vi.fn().mockResolvedValue('ADVISOR'),
    getRoleDescription: vi.fn().mockReturnValue('Advisor role'),
  },
}));

// Mock regulatoryModeGuard
vi.mock('../../../server/src/services/regulatoryModeGuard.js', () => ({
  default: {
    isEnabled: vi.fn().mockResolvedValue(false),
    getRegulatoryPrompt: vi.fn().mockResolvedValue(''),
  },
}));

import AIPolicyEngine, {
  POLICY_LEVELS,
  POLICY_HIERARCHY,
  ACTION_POLICY_REQUIREMENTS,
} from '../../../server/src/services/aiPolicyEngine';

describe('AIPolicyEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default DB behavior for org policy lookups
    mockDbGet.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM ai_policies')) {
        return {
          policy_level: 'ADVISORY',
          max_policy_level: 'ASSISTED',
          internet_enabled: 0,
          audit_required: 0,
          default_role: 'ADVISOR',
          active_roles: JSON.stringify(['ADVISOR']),
        };
      }
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPolicySummary', () => {
    it('should return policy summary for ADVISORY level', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'ADVISORY', max_policy_level: 'ASSISTED' };
        }
        return null;
      });

      const summary = await AIPolicyEngine.getPolicySummary('org-1');

      expect(summary).toBeDefined();
      expect(summary.currentLevel).toBe('ADVISORY');
      expect(summary.capabilities.canExplain).toBe(true);
      expect(summary.capabilities.canExecuteActions).toBe(false);
    });

    it('should return policy summary for AUTOPILOT level', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'AUTOPILOT', max_policy_level: 'AUTOPILOT' };
        }
        return null;
      });

      const summary = await AIPolicyEngine.getPolicySummary('org-1');

      expect(summary).toBeDefined();
      expect(summary.currentLevel).toBe('AUTOPILOT');
      expect(summary.capabilities.canExecuteActions).toBe(true);
    });

    it('should handle missing policy setting', async () => {
      mockDbGet.mockResolvedValue(null);

      const summary = await AIPolicyEngine.getPolicySummary('org-1');

      expect(summary).toBeDefined();
      // Should default to ADVISORY
      expect(summary.currentLevel).toBe('ADVISORY');
    });
  });

  describe('getEffectivePolicy', () => {
    it('should return effective policy for organization', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'ASSISTED', max_policy_level: 'ASSISTED' };
        }
        return null;
      });

      const policy = await AIPolicyEngine.getEffectivePolicy('org-1');

      expect(policy).toBeDefined();
      expect(policy.policyLevel).toBe('ASSISTED');
    });

    it('should include regulatory mode if enabled', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'ASSISTED', max_policy_level: 'ASSISTED' };
        }
        return null;
      });
      const regulatoryGuard = await import('../../../server/src/services/regulatoryModeGuard.js');
      vi.mocked(regulatoryGuard.default.isEnabled).mockResolvedValue(true);
      vi.mocked(regulatoryGuard.default.getRegulatoryPrompt).mockResolvedValue('Regulatory prompt');

      const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'project-1', 'user-1');

      expect(policy.regulatoryModeEnabled).toBe(true);
    });
  });

  describe('canPerformAction', () => {
    it('should allow ADVISORY actions at ADVISORY level', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'ADVISORY', max_policy_level: 'ADVISORY' };
        }
        return null;
      });

      const result = await AIPolicyEngine.canPerformAction('EXPLAIN_CONTEXT', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(true);
    });

    it('should allow ASSISTED actions at ASSISTED level', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'ASSISTED', max_policy_level: 'ASSISTED' };
        }
        return null;
      });

      const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(true);
    });

    it('should deny ASSISTED actions at ADVISORY level', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'ADVISORY', max_policy_level: 'ADVISORY' };
        }
        return null;
      });

      const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(false);
    });

    it('should allow all actions at AUTOPILOT level', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'AUTOPILOT', max_policy_level: 'AUTOPILOT' };
        }
        return null;
      });

      const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(true);
    });

    it('should handle unknown action', async () => {
      mockDbGet.mockImplementation(async (sql: string) => {
        if (String(sql).includes('FROM ai_policies')) {
          return { policy_level: 'ASSISTED', max_policy_level: 'ASSISTED' };
        }
        return null;
      });

      const result = await AIPolicyEngine.canPerformAction('UNKNOWN_ACTION', 'org-1');
      expect(typeof result.allowed).toBe('boolean');
    });
  });

  describe('POLICY_LEVELS and POLICY_HIERARCHY', () => {
    it('should have correct policy levels', () => {
      expect(POLICY_LEVELS.ADVISORY).toBe('ADVISORY');
      expect(POLICY_LEVELS.ASSISTED).toBe('ASSISTED');
      expect(POLICY_LEVELS.PROACTIVE).toBe('PROACTIVE');
      expect(POLICY_LEVELS.AUTOPILOT).toBe('AUTOPILOT');
    });

    it('should have correct policy hierarchy order', () => {
      expect(POLICY_HIERARCHY[0]).toBe('ADVISORY');
      expect(POLICY_HIERARCHY[POLICY_HIERARCHY.length - 1]).toBe('AUTOPILOT');
    });
  });

  describe('ACTION_POLICY_REQUIREMENTS', () => {
    it('should have correct requirements for actions', () => {
      expect(ACTION_POLICY_REQUIREMENTS.EXPLAIN_CONTEXT).toBe('ADVISORY');
      expect(ACTION_POLICY_REQUIREMENTS.CREATE_DRAFT_TASK).toBe('ASSISTED');
    });
  });
});
