/**
 * Stage Gate Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createStageGateService = () => {
  const gates = new Map([
    [
      'gate-1',
      { id: 'gate-1', name: 'Concept', order: 1, criteria: ['business_case', 'budget_approved'] },
    ],
    [
      'gate-2',
      {
        id: 'gate-2',
        name: 'Planning',
        order: 2,
        criteria: ['resources_allocated', 'timeline_defined'],
      },
    ],
    [
      'gate-3',
      { id: 'gate-3', name: 'Execution', order: 3, criteria: ['milestones_met', 'quality_passed'] },
    ],
  ]);
  const projectGates = new Map();

  return {
    // Get all gates
    getGates: async () => {
      return {
        success: true,
        data: Array.from(gates.values()).sort((a, b) => a.order - b.order),
        status: 200,
      };
    },

    // Get project stage
    getProjectStage: async (projectId) => {
      const stage = projectGates.get(projectId);
      if (!stage)
        return {
          success: true,
          data: { currentGate: 'gate-1', status: 'not_started' },
          status: 200,
        };
      return { success: true, data: stage, status: 200 };
    },

    // Check gate criteria
    checkCriteria: async (projectId, gateId) => {
      const gate = gates.get(gateId);
      if (!gate) return { success: false, error: 'Gate not found', status: 404 };
      return {
        success: true,
        data: { gateId, criteria: gate.criteria, allMet: false },
        status: 200,
      };
    },

    // Pass gate
    passGate: async (projectId, gateId, approvedBy) => {
      const gate = gates.get(gateId);
      if (!gate) return { success: false, error: 'Gate not found', status: 404 };
      projectGates.set(projectId, {
        currentGate: gateId,
        status: 'passed',
        approvedBy,
        passedAt: new Date(),
      });
      return { success: true, message: `Gate ${gate.name} passed`, status: 200 };
    },

    // Advance to next gate
    advanceGate: async (projectId) => {
      const current = projectGates.get(projectId);
      const currentGate = current?.currentGate || 'gate-1';
      const gateOrder = gates.get(currentGate)?.order || 0;
      const nextGate = Array.from(gates.values()).find((g) => g.order === gateOrder + 1);
      if (!nextGate) return { success: false, error: 'No next gate', status: 400 };
      projectGates.set(projectId, { currentGate: nextGate.id, status: 'in_progress' });
      return { success: true, data: { newGate: nextGate.id }, status: 200 };
    },
  };
};

describe('StageGateService', () => {
  let stageGateService;

  beforeEach(() => {
    vi.clearAllMocks();
    stageGateService = createStageGateService();
  });

  describe('Gate Definition', () => {
    it('should get all gates ordered', async () => {
      const result = await stageGateService.getGates();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].name).toBe('Concept');
    });
  });

  describe('Project Stage', () => {
    it('should get initial stage for new project', async () => {
      const result = await stageGateService.getProjectStage('new-project');
      expect(result.success).toBe(true);
      expect(result.data.currentGate).toBe('gate-1');
    });

    it('should check gate criteria', async () => {
      const result = await stageGateService.checkCriteria('proj-1', 'gate-1');
      expect(result.success).toBe(true);
      expect(result.data.criteria).toContain('business_case');
    });
  });

  describe('Gate Progression', () => {
    it('should pass gate', async () => {
      const result = await stageGateService.passGate('proj-1', 'gate-1', 'user-1');
      expect(result.success).toBe(true);
    });

    it('should advance to next gate', async () => {
      await stageGateService.passGate('proj-1', 'gate-1', 'user-1');
      const result = await stageGateService.advanceGate('proj-1');
      expect(result.success).toBe(true);
      expect(result.data.newGate).toBe('gate-2');
    });

    it('should fail to advance past last gate', async () => {
      await stageGateService.passGate('proj-1', 'gate-3', 'user-1');
      const result = await stageGateService.advanceGate('proj-1');
      expect(result.success).toBe(false);
    });
  });
});
