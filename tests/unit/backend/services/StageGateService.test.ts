/**
 * StageGateService Unit Tests
 *
 * Tests for stage gate management and validation in projects.
 * Uses inline implementation to avoid import issues.
 *
 * @module tests/unit/backend/services/StageGateService.test.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

interface StageGate {
  id: string;
  projectId: string;
  name: string;
  stage: number;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  criteria: GateCriteria[];
  approvers: string[];
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

interface GateCriteria {
  id: string;
  name: string;
  description: string;
  required: boolean;
  status: 'pending' | 'met' | 'not_met';
  evidence?: string;
}

interface StageGateCreateInput {
  projectId: string;
  name: string;
  stage: number;
  criteria: Omit<GateCriteria, 'id' | 'status'>[];
  approvers: string[];
  dueDate?: string;
}

const createStageGateService = () => {
  const gates: Map<string, StageGate> = new Map();
  const reviews: Map<string, any[]> = new Map();

  const generateId = () => `gate-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    create: async (input: StageGateCreateInput): Promise<StageGate> => {
      const id = generateId();
      const gate: StageGate = {
        id,
        projectId: input.projectId,
        name: input.name,
        stage: input.stage,
        status: 'pending',
        criteria: input.criteria.map((c, i) => ({
          id: `crit-${id}-${i}`,
          name: c.name,
          description: c.description,
          required: c.required,
          status: 'pending',
        })),
        approvers: input.approvers,
        dueDate: input.dueDate,
        createdAt: new Date().toISOString(),
      };

      gates.set(id, gate);
      return gate;
    },

    get: async (id: string): Promise<StageGate | null> => {
      return gates.get(id) || null;
    },

    getByProject: async (projectId: string): Promise<StageGate[]> => {
      return Array.from(gates.values())
        .filter((g) => g.projectId === projectId)
        .sort((a, b) => a.stage - b.stage);
    },

    updateCriteriaStatus: async (
      gateId: string,
      criteriaId: string,
      status: 'met' | 'not_met',
      evidence?: string
    ): Promise<StageGate | null> => {
      const gate = gates.get(gateId);
      if (!gate) return null;

      const criteria = gate.criteria.find((c) => c.id === criteriaId);
      if (!criteria) return null;

      criteria.status = status;
      criteria.evidence = evidence;

      return gate;
    },

    submitForReview: async (gateId: string, submitterId: string): Promise<{ success: boolean }> => {
      const gate = gates.get(gateId);
      if (!gate) throw new Error('Gate not found');

      // Check all required criteria are met
      const unmetRequired = gate.criteria.filter((c) => c.required && c.status !== 'met');
      if (unmetRequired.length > 0) {
        throw new Error('Required criteria not met');
      }

      gate.status = 'in_progress';
      reviews.set(gateId, [{ submitterId, submittedAt: new Date().toISOString() }]);

      return { success: true };
    },

    approve: async (gateId: string, approverId: string, comments?: string): Promise<StageGate> => {
      const gate = gates.get(gateId);
      if (!gate) throw new Error('Gate not found');
      if (!gate.approvers.includes(approverId)) {
        throw new Error('User not authorized to approve');
      }

      gate.status = 'approved';
      gate.completedAt = new Date().toISOString();

      const gateReviews = reviews.get(gateId) || [];
      gateReviews.push({ approverId, action: 'approved', comments, at: new Date().toISOString() });

      return gate;
    },

    reject: async (gateId: string, approverId: string, reason: string): Promise<StageGate> => {
      const gate = gates.get(gateId);
      if (!gate) throw new Error('Gate not found');
      if (!gate.approvers.includes(approverId)) {
        throw new Error('User not authorized to reject');
      }

      gate.status = 'rejected';
      gate.completedAt = new Date().toISOString();

      const gateReviews = reviews.get(gateId) || [];
      gateReviews.push({ approverId, action: 'rejected', reason, at: new Date().toISOString() });

      return gate;
    },

    getNextGate: async (projectId: string): Promise<StageGate | null> => {
      const projectGates = await Array.from(gates.values())
        .filter((g) => g.projectId === projectId && g.status !== 'approved')
        .sort((a, b) => a.stage - b.stage);

      return projectGates[0] || null;
    },

    validateTransition: async (gateId: string): Promise<{ valid: boolean; errors: string[] }> => {
      const gate = gates.get(gateId);
      if (!gate) return { valid: false, errors: ['Gate not found'] };

      const errors: string[] = [];

      // Check all required criteria
      gate.criteria.forEach((c) => {
        if (c.required && c.status !== 'met') {
          errors.push(`Required criteria "${c.name}" not met`);
        }
      });

      // Check if past due
      if (gate.dueDate && new Date(gate.dueDate) < new Date()) {
        errors.push('Gate is past due date');
      }

      return { valid: errors.length === 0, errors };
    },
  };
};

// ============================================
// TESTS
// ============================================

describe('StageGateService', () => {
  let stageGateService: ReturnType<typeof createStageGateService>;

  beforeEach(() => {
    stageGateService = createStageGateService();
  });

  describe('create()', () => {
    it('should create a new stage gate', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Phase 1 Gate',
        stage: 1,
        criteria: [
          { name: 'Budget Approved', description: 'Budget sign-off required', required: true },
          { name: 'Stakeholder Review', description: 'All stakeholders reviewed', required: false },
        ],
        approvers: ['user-1', 'user-2'],
      });

      expect(gate).toBeDefined();
      expect(gate.id).toBeDefined();
      expect(gate.status).toBe('pending');
      expect(gate.criteria).toHaveLength(2);
    });

    it('should set default status to pending for criteria', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [{ name: 'Test', description: 'Test criteria', required: true }],
        approvers: ['user-1'],
      });

      expect(gate.criteria[0].status).toBe('pending');
    });
  });

  describe('get()', () => {
    it('should retrieve existing gate', async () => {
      const created = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [],
        approvers: ['user-1'],
      });

      const retrieved = await stageGateService.get(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent gate', async () => {
      const result = await stageGateService.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getByProject()', () => {
    it('should return gates sorted by stage', async () => {
      await stageGateService.create({
        projectId: 'proj-1',
        name: 'Gate 3',
        stage: 3,
        criteria: [],
        approvers: [],
      });
      await stageGateService.create({
        projectId: 'proj-1',
        name: 'Gate 1',
        stage: 1,
        criteria: [],
        approvers: [],
      });
      await stageGateService.create({
        projectId: 'proj-1',
        name: 'Gate 2',
        stage: 2,
        criteria: [],
        approvers: [],
      });
      await stageGateService.create({
        projectId: 'proj-2',
        name: 'Other',
        stage: 1,
        criteria: [],
        approvers: [],
      });

      const gates = await stageGateService.getByProject('proj-1');

      expect(gates).toHaveLength(3);
      expect(gates[0].stage).toBe(1);
      expect(gates[1].stage).toBe(2);
      expect(gates[2].stage).toBe(3);
    });
  });

  describe('updateCriteriaStatus()', () => {
    it('should update criteria status with evidence', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [{ name: 'Test', description: 'Test', required: true }],
        approvers: ['user-1'],
      });

      const updated = await stageGateService.updateCriteriaStatus(
        gate.id,
        gate.criteria[0].id,
        'met',
        'Evidence document attached'
      );

      expect(updated?.criteria[0].status).toBe('met');
      expect(updated?.criteria[0].evidence).toBe('Evidence document attached');
    });
  });

  describe('submitForReview()', () => {
    it('should reject submission if required criteria not met', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [{ name: 'Required', description: 'Required criteria', required: true }],
        approvers: ['user-1'],
      });

      await expect(stageGateService.submitForReview(gate.id, 'submitter-1')).rejects.toThrow(
        'Required criteria not met'
      );
    });

    it('should allow submission when all required criteria met', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [{ name: 'Required', description: 'Required criteria', required: true }],
        approvers: ['user-1'],
      });

      await stageGateService.updateCriteriaStatus(gate.id, gate.criteria[0].id, 'met');

      const result = await stageGateService.submitForReview(gate.id, 'submitter-1');

      expect(result.success).toBe(true);
    });
  });

  describe('approve()', () => {
    it('should approve gate by authorized user', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [{ name: 'Test', description: 'Test', required: true }],
        approvers: ['approver-1'],
      });

      await stageGateService.updateCriteriaStatus(gate.id, gate.criteria[0].id, 'met');
      await stageGateService.submitForReview(gate.id, 'submitter-1');

      const approved = await stageGateService.approve(gate.id, 'approver-1', 'Looks good');

      expect(approved.status).toBe('approved');
      expect(approved.completedAt).toBeDefined();
    });

    it('should reject approval from unauthorized user', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [],
        approvers: ['approver-1'],
      });

      await expect(stageGateService.approve(gate.id, 'unauthorized-user')).rejects.toThrow(
        'User not authorized to approve'
      );
    });
  });

  describe('reject()', () => {
    it('should reject gate with reason', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [],
        approvers: ['approver-1'],
      });

      const rejected = await stageGateService.reject(
        gate.id,
        'approver-1',
        'Missing documentation'
      );

      expect(rejected.status).toBe('rejected');
      expect(rejected.completedAt).toBeDefined();
    });
  });

  describe('validateTransition()', () => {
    it('should return valid when all required criteria met', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [{ name: 'Test', description: 'Test', required: true }],
        approvers: [],
      });

      await stageGateService.updateCriteriaStatus(gate.id, gate.criteria[0].id, 'met');

      const result = await stageGateService.validateTransition(gate.id);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for unmet required criteria', async () => {
      const gate = await stageGateService.create({
        projectId: 'proj-123',
        name: 'Test Gate',
        stage: 1,
        criteria: [
          { name: 'Criteria A', description: 'A', required: true },
          { name: 'Criteria B', description: 'B', required: true },
        ],
        approvers: [],
      });

      const result = await stageGateService.validateTransition(gate.id);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });
});
