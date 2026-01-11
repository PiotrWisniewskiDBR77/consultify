/**
 * DLP Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DLP (Data Loss Prevention) Service
const createDLPService = () => {
  const policies = new Map([
    [
      'pii-detection',
      {
        id: 'pii-detection',
        name: 'PII Detection',
        enabled: true,
        patterns: ['ssn', 'credit_card', 'email'],
      },
    ],
    [
      'file-exfiltration',
      { id: 'file-exfiltration', name: 'File Exfiltration', enabled: true, maxFileSize: 10485760 },
    ],
  ]);
  const violations = [];

  return {
    // Scan content for DLP violations
    scanContent: async (content, policyId) => {
      const policy = policies.get(policyId);
      if (!policy) return { success: false, error: 'Policy not found', status: 404 };
      if (!policy.enabled) return { success: true, violations: [], status: 200 };

      const detected = [];
      if (policy.patterns) {
        for (const pattern of policy.patterns) {
          if (content.toLowerCase().includes(pattern)) {
            detected.push({ type: pattern, severity: 'high' });
          }
        }
      }
      return {
        success: true,
        violations: detected,
        hasViolation: detected.length > 0,
        status: 200,
      };
    },

    // Report violation
    reportViolation: async (userId, policyId, details) => {
      if (!userId || !policyId)
        return { success: false, error: 'Missing required fields', status: 400 };
      const violation = {
        id: `viol-${Date.now()}`,
        userId,
        policyId,
        details,
        timestamp: new Date(),
      };
      violations.push(violation);
      return { success: true, data: violation, status: 201 };
    },

    // Get violations
    getViolations: async (userId) => {
      const userViolations = userId ? violations.filter((v) => v.userId === userId) : violations;
      return { success: true, data: userViolations, status: 200 };
    },

    // Enable/disable policy
    togglePolicy: async (policyId, enabled) => {
      const policy = policies.get(policyId);
      if (!policy) return { success: false, error: 'Policy not found', status: 404 };
      policy.enabled = enabled;
      return { success: true, data: policy, status: 200 };
    },
  };
};

describe('DLPService', () => {
  let dlpService;

  beforeEach(() => {
    vi.clearAllMocks();
    dlpService = createDLPService();
  });

  describe('Content Scanning', () => {
    it('should detect PII in content', async () => {
      const content = 'Contact me at john@email.com about credit_card payment';
      const result = await dlpService.scanContent(content, 'pii-detection');
      expect(result.success).toBe(true);
      expect(result.hasViolation).toBe(true);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should return no violations for clean content', async () => {
      const content = 'This is a normal message with no sensitive data';
      const result = await dlpService.scanContent(content, 'pii-detection');
      expect(result.success).toBe(true);
      expect(result.hasViolation).toBe(false);
    });

    it('should return 404 for unknown policy', async () => {
      const result = await dlpService.scanContent('test', 'unknown-policy');
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });
  });

  describe('Violation Reporting', () => {
    it('should report violation', async () => {
      const result = await dlpService.reportViolation('user-1', 'pii-detection', {
        data: 'SSN detected',
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
    });

    it('should get user violations', async () => {
      await dlpService.reportViolation('user-1', 'pii-detection', {});
      await dlpService.reportViolation('user-1', 'file-exfiltration', {});
      const result = await dlpService.getViolations('user-1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Policy Management', () => {
    it('should toggle policy', async () => {
      const result = await dlpService.togglePolicy('pii-detection', false);
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(false);
    });
  });
});
