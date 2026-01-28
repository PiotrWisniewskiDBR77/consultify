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

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => mockDbGet(...args),
  run: (...args: any[]) => mockDbRun(...args),
}));

// Mock logger
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock aiRoleGuard
vi.mock('../../../../server/src/services/aiRoleGuard.js', () => ({
  default: {
    getRoleCapabilities: vi.fn().mockResolvedValue({}),
    getProjectRole: vi.fn().mockResolvedValue('ADVISOR'),
    getRoleDescription: vi.fn().mockReturnValue('Advisor role'),
  },
}));

// Mock regulatoryModeGuard
vi.mock('../../../../server/src/services/regulatoryModeGuard.js', () => ({
  default: {
    isRegulatoryModeEnabled: vi.fn().mockResolvedValue(false),
    getRegulatoryPrompt: vi.fn().mockResolvedValue(null),
  },
}));

import AIPolicyEngine, {
  POLICY_LEVELS,
  POLICY_HIERARCHY,
  ACTION_POLICY_REQUIREMENTS,
} from '../../../../server/src/services/aiPolicyEngine';

describe('AIPolicyEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPolicySummary', () => {
    it('should return policy summary for ADVISORY level', async () => {
      mockDbGet.mockResolvedValue({ value: 'ADVISORY' });

      const summary = await AIPolicyEngine.getPolicySummary('org-1');

      expect(summary).toBeDefined();
      expect(summary.currentLevel).toBe('ADVISORY');
      expect(summary.capabilities.canExplain).toBe(true);
      expect(summary.capabilities.canExecuteActions).toBe(false);
    });

    it('should return policy summary for AUTOPILOT level', async () => {
      mockDbGet.mockResolvedValue({ value: 'AUTOPILOT' });

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
      mockDbGet.mockResolvedValue({ value: 'ASSISTED' });

      const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'user-1', 'project-1');

      expect(policy).toBeDefined();
      expect(policy.policyLevel).toBe('ASSISTED');
    });

    it('should include regulatory mode if enabled', async () => {
      mockDbGet.mockResolvedValue({ value: 'ASSISTED' });
      const regulatoryGuard = await import('../../../../server/src/services/regulatoryModeGuard.js');
      vi.mocked(regulatoryGuard.default.isRegulatoryModeEnabled).mockResolvedValue(true);
      vi.mocked(regulatoryGuard.default.getRegulatoryPrompt).mockResolvedValue('Regulatory prompt');

      const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'user-1', 'project-1');

      expect(policy.regulatoryModeEnabled).toBe(true);
    });
  });

  describe('canPerformAction', () => {
    it('should allow ADVISORY actions at ADVISORY level', async () => {
      mockDbGet.mockResolvedValue({ value: 'ADVISORY' });

      const result = await AIPolicyEngine.canPerformAction('EXPLAIN_CONTEXT', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(true);
    });

    it('should allow ASSISTED actions at ASSISTED level', async () => {
      mockDbGet.mockResolvedValue({ value: 'ASSISTED' });

      const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(true);
    });

    it('should deny ASSISTED actions at ADVISORY level', async () => {
      mockDbGet.mockResolvedValue({ value: 'ADVISORY' });

      const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(false);
    });

    it('should allow all actions at AUTOPILOT level', async () => {
      mockDbGet.mockResolvedValue({ value: 'AUTOPILOT' });

      const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');
      const canDo = result.allowed;

      expect(canDo).toBe(true);
    });

    it('should handle unknown action', async () => {
      mockDbGet.mockResolvedValue({ value: 'ASSISTED' });

      const canDo = await canPerformAction('org-1', 'UNKNOWN_ACTION');

      // Unknown actions should default to requiring ADVISORY
      expect(typeof canDo).toBe('boolean');
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
