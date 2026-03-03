/**
 * Governance Service Unit Tests
 *
 * Tests for governance and compliance management.
 *
 * @module tests/unit/backend/governanceService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create governance service implementation
const createGovernanceService = () => {
  const policies = new Map();
  const approvals = new Map();
  const exceptions = new Map();

  // Internal helper: list policies
  const listPoliciesInternal = (organizationId, options = {}) => {
    const { type, status } = options;

    return Array.from(policies.values()).filter((p) => {
      if (p.organizationId !== organizationId) return false;
      if (type && p.type !== type) return false;
      if (status && p.status !== status) return false;
      return true;
    });
  };

  // Internal helper: evaluate rule
  const evaluateRuleInternal = (rule, context) => {
    // Simplified evaluation
    if (rule.condition === 'budget_under' && context.budget) {
      return context.budget <= rule.value;
    }
    if (rule.condition === 'approval_required' && context.amount) {
      return context.amount < rule.threshold || context.hasApproval;
    }
    return true;
  };

  return {
    // Create policy
    createPolicy: async (data) => {
      if (!data.name || !data.organizationId) {
        throw new Error('Name and organization ID required');
      }

      const id = `policy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const policy = {
        id,
        name: data.name,
        description: data.description || '',
        organizationId: data.organizationId,
        type: data.type || 'general',
        status: 'draft',
        version: 1,
        effectiveDate: data.effectiveDate,
        rules: data.rules || [],
        approvers: data.approvers || [],
        createdAt: new Date().toISOString(),
      };

      policies.set(id, policy);
      return policy;
    },

    // Get policy
    getPolicy: async (id) => {
      return policies.get(id) || null;
    },

    // Publish policy
    publishPolicy: async (id) => {
      const policy = policies.get(id);
      if (!policy) throw new Error('Policy not found');

      policy.status = 'active';
      policy.publishedAt = new Date().toISOString();
      policies.set(id, policy);
      return policy;
    },

    // List policies
    listPolicies: async (organizationId, options = {}) => {
      return listPoliciesInternal(organizationId, options);
    },

    // Check compliance
    checkCompliance: async (organizationId, context) => {
      const activePolicies = listPoliciesInternal(organizationId, { status: 'active' });
      const violations = [];
      const warnings = [];

      for (const policy of activePolicies) {
        for (const rule of policy.rules) {
          const isCompliant = evaluateRuleInternal(rule, context);
          if (!isCompliant) {
            if (rule.severity === 'critical') {
              violations.push({
                policyId: policy.id,
                policyName: policy.name,
                ruleId: rule.id,
                ruleName: rule.name,
                severity: rule.severity,
              });
            } else {
              warnings.push({
                policyId: policy.id,
                ruleId: rule.id,
                severity: rule.severity,
              });
            }
          }
        }
      }

      return {
        isCompliant: violations.length === 0,
        violations,
        warnings,
        checkedAt: new Date().toISOString(),
      };
    },

    // Internal rule evaluation
    evaluateRule: (rule, context) => {
      // Simplified evaluation
      if (rule.condition === 'budget_under' && context.budget) {
        return context.budget <= rule.value;
      }
      if (rule.condition === 'approval_required' && context.amount) {
        return context.amount < rule.threshold || context.hasApproval;
      }
      return true;
    },

    // Request approval
    requestApproval: async (data) => {
      if (!data.type || !data.requesterId) {
        throw new Error('Type and requester ID required');
      }

      const id = `approval-${Date.now()}`;
      const approval = {
        id,
        type: data.type,
        requesterId: data.requesterId,
        context: data.context || {},
        status: 'pending',
        approverId: null,
        requestedAt: new Date().toISOString(),
        decidedAt: null,
        comments: null,
      };

      approvals.set(id, approval);
      return approval;
    },

    // Approve/Reject
    decide: async (approvalId, approverId, decision, comments) => {
      const approval = approvals.get(approvalId);
      if (!approval) throw new Error('Approval not found');
      if (approval.status !== 'pending') throw new Error('Already decided');

      approval.status = decision; // 'approved' or 'rejected'
      approval.approverId = approverId;
      approval.decidedAt = new Date().toISOString();
      approval.comments = comments;

      approvals.set(approvalId, approval);
      return approval;
    },

    // Get pending approvals
    getPendingApprovals: async (approverId) => {
      return Array.from(approvals.values()).filter((a) => a.status === 'pending');
    },

    // Request exception
    requestException: async (data) => {
      const id = `exception-${Date.now()}`;
      const exception = {
        id,
        policyId: data.policyId,
        ruleId: data.ruleId,
        requesterId: data.requesterId,
        justification: data.justification,
        duration: data.duration, // days
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      exceptions.set(id, exception);
      return exception;
    },

    // Approve exception
    approveException: async (exceptionId, approverId, expiresAt) => {
      const exception = exceptions.get(exceptionId);
      if (!exception) throw new Error('Exception not found');

      exception.status = 'approved';
      exception.approverId = approverId;
      exception.approvedAt = new Date().toISOString();
      exception.expiresAt = expiresAt;

      exceptions.set(exceptionId, exception);
      return exception;
    },

    // Clear for testing
    clear: () => {
      policies.clear();
      approvals.clear();
      exceptions.clear();
    },
  };
};

describe('GovernanceService', () => {
  let governanceService;

  beforeEach(() => {
    governanceService = createGovernanceService();
  });

  describe('Policy Management', () => {
    it('should create a policy', async () => {
      const policy = await governanceService.createPolicy({
        name: 'Spending Policy',
        organizationId: 'org-1',
        type: 'financial',
        rules: [
          {
            id: 'r1',
            name: 'Budget limit',
            condition: 'budget_under',
            value: 100000,
            severity: 'critical',
          },
        ],
      });

      expect(policy.id).toBeDefined();
      expect(policy.status).toBe('draft');
      expect(policy.rules).toHaveLength(1);
    });

    it('should publish policy', async () => {
      const policy = await governanceService.createPolicy({
        name: 'Test Policy',
        organizationId: 'org-1',
      });

      const published = await governanceService.publishPolicy(policy.id);

      expect(published.status).toBe('active');
      expect(published.publishedAt).toBeDefined();
    });

    it('should list policies by type', async () => {
      await governanceService.createPolicy({
        name: 'P1',
        organizationId: 'org-1',
        type: 'financial',
      });
      await governanceService.createPolicy({
        name: 'P2',
        organizationId: 'org-1',
        type: 'security',
      });
      await governanceService.createPolicy({
        name: 'P3',
        organizationId: 'org-1',
        type: 'financial',
      });

      const financial = await governanceService.listPolicies('org-1', { type: 'financial' });

      expect(financial).toHaveLength(2);
    });
  });

  describe('Compliance Checking', () => {
    beforeEach(async () => {
      const policy = await governanceService.createPolicy({
        name: 'Budget Policy',
        organizationId: 'org-1',
        rules: [
          {
            id: 'r1',
            name: 'Budget limit',
            condition: 'budget_under',
            value: 100000,
            severity: 'critical',
          },
        ],
      });
      await governanceService.publishPolicy(policy.id);
    });

    it('should pass compliance check', async () => {
      const result = await governanceService.checkCompliance('org-1', { budget: 50000 });

      expect(result.isCompliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect violations', async () => {
      const result = await governanceService.checkCompliance('org-1', { budget: 150000 });

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('Approvals', () => {
    it('should request approval', async () => {
      const approval = await governanceService.requestApproval({
        type: 'budget_increase',
        requesterId: 'user-1',
        context: { amount: 50000, reason: 'Project expansion' },
      });

      expect(approval.id).toBeDefined();
      expect(approval.status).toBe('pending');
    });

    it('should approve request', async () => {
      const request = await governanceService.requestApproval({
        type: 'expense',
        requesterId: 'user-1',
      });

      const approved = await governanceService.decide(
        request.id,
        'manager-1',
        'approved',
        'Looks good'
      );

      expect(approved.status).toBe('approved');
      expect(approved.approverId).toBe('manager-1');
    });

    it('should reject request', async () => {
      const request = await governanceService.requestApproval({
        type: 'expense',
        requesterId: 'user-1',
      });

      const rejected = await governanceService.decide(
        request.id,
        'manager-1',
        'rejected',
        'Over budget'
      );

      expect(rejected.status).toBe('rejected');
    });

    it('should not allow double decision', async () => {
      const request = await governanceService.requestApproval({
        type: 'expense',
        requesterId: 'user-1',
      });

      await governanceService.decide(request.id, 'manager-1', 'approved');

      await expect(governanceService.decide(request.id, 'manager-2', 'rejected')).rejects.toThrow(
        'Already decided'
      );
    });
  });

  describe('Exceptions', () => {
    it('should request exception', async () => {
      const policy = await governanceService.createPolicy({
        name: 'Strict Policy',
        organizationId: 'org-1',
      });

      const exception = await governanceService.requestException({
        policyId: policy.id,
        ruleId: 'r1',
        requesterId: 'user-1',
        justification: 'Special circumstances',
        duration: 30,
      });

      expect(exception.id).toBeDefined();
      expect(exception.status).toBe('pending');
    });

    it('should approve exception with expiry', async () => {
      const exception = await governanceService.requestException({
        policyId: 'policy-1',
        ruleId: 'r1',
        requesterId: 'user-1',
        justification: 'Temporary need',
      });

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const approved = await governanceService.approveException(exception.id, 'admin-1', expiresAt);

      expect(approved.status).toBe('approved');
      expect(approved.expiresAt).toBe(expiresAt);
    });
  });
});
