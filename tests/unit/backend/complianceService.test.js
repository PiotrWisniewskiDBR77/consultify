/**
 * Compliance Service Unit Tests
 * Tests compliance checking, violation tracking, and reporting
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Compliance Service implementation
const createComplianceService = () => {
  const rules = new Map();
  const violations = [];
  const checks = [];
  let counter = 0;

  return {
    registerRule: (id, config) => {
      rules.set(id, {
        id,
        name: config.name,
        description: config.description,
        severity: config.severity || 'medium',
        check: config.check,
        category: config.category || 'general',
      });
    },

    check: async (context) => {
      const results = [];
      const checkId = `check-${Date.now()}-${++counter}`;

      for (const [ruleId, rule] of rules) {
        let passed = true;
        let details = null;

        try {
          passed = await rule.check(context);
        } catch (error) {
          passed = false;
          details = error.message;
        }

        results.push({
          ruleId,
          ruleName: rule.name,
          passed,
          severity: rule.severity,
          details,
        });

        if (!passed) {
          violations.push({
            id: `viol-${Date.now()}-${++counter}`,
            checkId,
            ruleId,
            context,
            timestamp: new Date(),
          });
        }
      }

      const allPassed = results.every((r) => r.passed);
      const check = {
        id: checkId,
        compliant: allPassed,
        results,
        timestamp: new Date(),
      };
      checks.push(check);

      return check;
    },

    getViolations: (filters = {}) => {
      let result = [...violations];
      if (filters.ruleId) result = result.filter((v) => v.ruleId === filters.ruleId);
      if (filters.severity) {
        const rule = rules.get(filters.severity);
        result = result.filter((v) => {
          const r = rules.get(v.ruleId);
          return r && r.severity === filters.severity;
        });
      }
      return result;
    },

    generateReport: (period = 'all') => {
      const periodChecks =
        period === 'all'
          ? checks
          : checks.filter((c) => {
              const now = new Date();
              const checkDate = new Date(c.timestamp);
              if (period === 'day') return now - checkDate < 86400000;
              if (period === 'week') return now - checkDate < 604800000;
              return true;
            });

      const passed = periodChecks.filter((c) => c.compliant).length;
      const failed = periodChecks.length - passed;

      return {
        period,
        date: new Date().toISOString(),
        totalChecks: periodChecks.length,
        passed,
        failed,
        status: failed === 0 ? 'passed' : 'needs_attention',
        violations: violations.length,
      };
    },

    getRules: () => Array.from(rules.values()),

    clearViolations: () => (violations.length = 0),
  };
};

describe('ComplianceService', () => {
  let complianceService;

  beforeEach(() => {
    complianceService = createComplianceService();
  });

  describe('Rule Registration', () => {
    it('should register compliance rule', () => {
      complianceService.registerRule('gdpr-consent', {
        name: 'GDPR Consent Check',
        severity: 'high',
        check: (ctx) => ctx.hasConsent === true,
      });

      const rules = complianceService.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('GDPR Consent Check');
    });
  });

  describe('Compliance Checking', () => {
    it('should check compliance', async () => {
      complianceService.registerRule('rule1', {
        name: 'Test Rule',
        check: () => true,
      });

      const result = await complianceService.check({});
      expect(result.compliant).toBe(true);
    });

    it('should detect violations', async () => {
      complianceService.registerRule('required-field', {
        name: 'Required Field',
        check: (ctx) => !!ctx.requiredField,
      });

      const result = await complianceService.check({ requiredField: null });
      expect(result.compliant).toBe(false);
    });

    it('should return detailed results', async () => {
      complianceService.registerRule('r1', { name: 'Rule 1', check: () => true });
      complianceService.registerRule('r2', { name: 'Rule 2', check: () => false });

      const result = await complianceService.check({});
      expect(result.results).toHaveLength(2);
      expect(result.results.some((r) => r.passed)).toBe(true);
      expect(result.results.some((r) => !r.passed)).toBe(true);
    });
  });

  describe('Violation Tracking', () => {
    it('should track violations', async () => {
      complianceService.registerRule('failing', {
        name: 'Failing Rule',
        check: () => false,
      });

      await complianceService.check({});
      const violations = complianceService.getViolations();

      expect(violations).toHaveLength(1);
    });

    it('should clear violations', async () => {
      complianceService.registerRule('fail', { name: 'Fail', check: () => false });
      await complianceService.check({});

      complianceService.clearViolations();
      expect(complianceService.getViolations()).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate report', async () => {
      complianceService.registerRule('r1', { name: 'R1', check: () => true });
      await complianceService.check({});

      const report = complianceService.generateReport();

      expect(report.status).toBe('passed');
      expect(report.date).toBeDefined();
    });

    it('should report needs_attention for failures', async () => {
      complianceService.registerRule('r1', { name: 'R1', check: () => false });
      await complianceService.check({});

      const report = complianceService.generateReport();
      expect(report.status).toBe('needs_attention');
    });
  });
});
