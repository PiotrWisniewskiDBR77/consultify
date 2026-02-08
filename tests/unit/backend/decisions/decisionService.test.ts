/**
 * Decision Service - Unit Tests (REAL PRODUCTION CODE)
 * Tests for server/src/services/decisionService.ts
 *
 * This test imports the REAL production service and mocks only the database.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';

// Mock database BEFORE importing service
const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
};

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-12345'),
}));

// Import REAL production code
import decisionService, {
  createDecision,
  getDecision,
  makeDecision,
  getPendingDecisions,
  escalateDecision,
  cancelDecision,
  type CreateDecisionInput,
  type MakeDecisionInput,
  type Decision,
} from '../../../../server/src/services/decisionService.js';

describe('DecisionService - Real Production Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });
    mockDb.get.mockResolvedValue(null);
    mockDb.all.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createDecision', () => {
    const validInput: CreateDecisionInput = {
      organizationId: 'org-123',
      projectId: 'project-456',
      title: 'Test Decision',
      description: 'Test description',
      type: 'APPROVAL',
      decisionMakerId: 'user-789',
      createdBy: 'user-001',
    };

    it('should create decision with generated ID', async () => {
      // Mock getDecision to return the created decision
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-test-uuid-12345',
        organization_id: 'org-123',
        project_id: 'project-456',
        title: 'Test Decision',
        description: 'Test description',
        type: 'APPROVAL',
        decision_maker_id: 'user-789',
        options: JSON.stringify([
          { id: 'approve', label: 'Approve' },
          { id: 'reject', label: 'Reject' },
        ]),
        status: 'pending',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      const result = await createDecision(validInput);

      // Verify INSERT was called with correct params
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO decisions'),
        expect.arrayContaining(['decision-test-uuid-12345', 'org-123', 'project-456'])
      );

      // Verify decision returned
      expect(result).toBeDefined();
      expect(result.id).toBe('decision-test-uuid-12345');
      expect(result.status).toBe('pending');
    });

    it('should create default options for GO_NO_GO type', async () => {
      const goNoGoInput: CreateDecisionInput = {
        ...validInput,
        type: 'GO_NO_GO',
      };

      mockDb.get.mockResolvedValueOnce({
        id: 'decision-test-uuid-12345',
        organization_id: 'org-123',
        title: 'Go No Go Decision',
        type: 'GO_NO_GO',
        options: JSON.stringify([
          { id: 'go', label: 'Go', description: 'Proceed' },
          { id: 'no-go', label: 'No-Go', description: 'Do not proceed' },
        ]),
        status: 'pending',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      const result = await createDecision(goNoGoInput);

      // Verify options were set correctly
      expect(result.options).toHaveLength(2);
      expect(result.options[0].label).toBe('Go');
      expect(result.options[1].label).toBe('No-Go');
    });

    it('should record history after creation', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-test-uuid-12345',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        status: 'pending',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      await createDecision(validInput);

      // Verify history INSERT was called
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO decision_history'),
        expect.arrayContaining(['decision-test-uuid-12345', 'created', null, 'pending'])
      );
    });

    it('should add stakeholders when provided', async () => {
      const inputWithStakeholders: CreateDecisionInput = {
        ...validInput,
        stakeholderIds: ['stakeholder-1', 'stakeholder-2'],
      };

      mockDb.get.mockResolvedValueOnce({
        id: 'decision-test-uuid-12345',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        status: 'pending',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      await createDecision(inputWithStakeholders);

      // Verify stakeholder INSERT was called twice
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO decision_stakeholders'),
        expect.arrayContaining(['stakeholder-1'])
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO decision_stakeholders'),
        expect.arrayContaining(['stakeholder-2'])
      );
    });
  });

  describe('getDecision', () => {
    it('should return null for non-existent decision', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await getDecision('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return properly mapped decision', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-123',
        organization_id: 'org-123',
        project_id: 'project-456',
        initiative_id: null,
        task_id: null,
        title: 'Test Decision',
        description: 'Description',
        type: 'APPROVAL',
        decision_maker_id: 'user-789',
        options: JSON.stringify([{ id: 'approve', label: 'Approve' }]),
        criteria: null,
        deadline: '2026-01-30',
        escalation_deadline: '2026-02-06',
        status: 'pending',
        selected_option: null,
        decision_rationale: null,
        decided_at: null,
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      const result = await getDecision('decision-123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('decision-123');
      expect(result!.organizationId).toBe('org-123');
      expect(result!.projectId).toBe('project-456');
      expect(result!.options).toHaveLength(1);
    });
  });

  describe('makeDecision', () => {
    const mockDecision = {
      id: 'decision-123',
      organization_id: 'org-123',
      title: 'Test Decision',
      type: 'APPROVAL',
      options: JSON.stringify([
        { id: 'approve', label: 'Approve' },
        { id: 'reject', label: 'Reject' },
      ]),
      status: 'pending',
      decision_maker_id: 'user-789',
      created_by: 'user-001',
      created_at: '2026-01-23T00:00:00.000Z',
      updated_at: '2026-01-23T00:00:00.000Z',
    };

    it('should throw error for non-existent decision', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const input: MakeDecisionInput = {
        decisionId: 'non-existent',
        selectedOption: 'approve',
        rationale: 'Test',
        decidedBy: 'user-789',
      };

      await expect(makeDecision(input)).rejects.toThrow('Decision not found');
    });

    it('should throw error for already decided decision', async () => {
      mockDb.get.mockResolvedValueOnce({
        ...mockDecision,
        status: 'approved',
      });

      const input: MakeDecisionInput = {
        decisionId: 'decision-123',
        selectedOption: 'approve',
        decidedBy: 'user-789',
      };

      await expect(makeDecision(input)).rejects.toThrow('Cannot make decision in status');
    });

    it('should approve decision with approve option', async () => {
      // First call: getDecision before update
      mockDb.get.mockResolvedValueOnce(mockDecision);
      // Second call: getDecision after update
      mockDb.get.mockResolvedValueOnce({
        ...mockDecision,
        status: 'approved',
        selected_option: 'approve',
        decided_at: '2026-01-23T12:00:00.000Z',
      });

      const input: MakeDecisionInput = {
        decisionId: 'decision-123',
        selectedOption: 'approve',
        rationale: 'Looks good',
        decidedBy: 'user-789',
      };

      const result = await makeDecision(input);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE decisions SET'),
        expect.arrayContaining(['approved', 'approve', 'Looks good'])
      );
      expect(result.status).toBe('approved');
    });

    it('should reject decision with reject option', async () => {
      mockDb.get.mockResolvedValueOnce(mockDecision);
      mockDb.get.mockResolvedValueOnce({
        ...mockDecision,
        status: 'rejected',
        selected_option: 'reject',
      });

      const input: MakeDecisionInput = {
        decisionId: 'decision-123',
        selectedOption: 'reject',
        rationale: 'Not ready',
        decidedBy: 'user-789',
      };

      const result = await makeDecision(input);

      expect(result.status).toBe('rejected');
    });

    it('should reject decision with no-go option', async () => {
      mockDb.get.mockResolvedValueOnce({
        ...mockDecision,
        type: 'GO_NO_GO',
      });
      mockDb.get.mockResolvedValueOnce({
        ...mockDecision,
        type: 'GO_NO_GO',
        status: 'rejected',
        selected_option: 'no-go',
      });

      const input: MakeDecisionInput = {
        decisionId: 'decision-123',
        selectedOption: 'no-go',
        decidedBy: 'user-789',
      };

      const result = await makeDecision(input);

      expect(result.status).toBe('rejected');
    });
  });

  describe('getPendingDecisions', () => {
    it('should return empty array when no pending decisions', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await getPendingDecisions('user-123', 'org-123');

      expect(result).toEqual([]);
    });

    it('should return mapped pending decisions', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 'decision-1',
          organization_id: 'org-123',
          title: 'Decision 1',
          type: 'APPROVAL',
          options: JSON.stringify([]),
          status: 'pending',
          decision_maker_id: 'user-123',
          created_at: '2026-01-23T00:00:00.000Z',
        },
        {
          id: 'decision-2',
          organization_id: 'org-123',
          title: 'Decision 2',
          type: 'GO_NO_GO',
          options: JSON.stringify([]),
          status: 'escalated',
          decision_maker_id: 'user-123',
          created_at: '2026-01-22T00:00:00.000Z',
        },
      ]);

      const result = await getPendingDecisions('user-123', 'org-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('decision-1');
      expect(result[1].id).toBe('decision-2');
    });

    it('should query with correct filters', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await getPendingDecisions('user-123', 'org-456');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('pending', 'escalated')"),
        ['org-456', 'user-123']
      );
    });
  });

  describe('escalateDecision', () => {
    it('should throw error for non-existent decision', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(escalateDecision('non-existent', 'user-123', 'Urgent')).rejects.toThrow(
        'Decision not found'
      );
    });

    it('should throw error for non-pending decision', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-123',
        status: 'approved',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      await expect(escalateDecision('decision-123', 'user-123', 'Urgent')).rejects.toThrow(
        'Cannot escalate decision in status'
      );
    });

    it('should escalate pending decision', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-123',
        status: 'pending',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-123',
        status: 'escalated',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      const result = await escalateDecision('decision-123', 'user-123', 'Needs manager');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("status = 'escalated'"),
        expect.any(Array)
      );
      expect(result.status).toBe('escalated');
    });
  });

  describe('cancelDecision', () => {
    it('should throw error for made decision', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-123',
        status: 'approved',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      await expect(cancelDecision('decision-123', 'user-123', 'Changed mind')).rejects.toThrow(
        'Cannot cancel a decision in status: approved'
      );
    });

    it('should cancel pending decision', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-123',
        status: 'pending',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });
      mockDb.get.mockResolvedValueOnce({
        id: 'decision-123',
        status: 'cancelled',
        organization_id: 'org-123',
        title: 'Test',
        type: 'APPROVAL',
        options: '[]',
        decision_maker_id: 'user-789',
        created_by: 'user-001',
        created_at: '2026-01-23T00:00:00.000Z',
        updated_at: '2026-01-23T00:00:00.000Z',
      });

      const result = await cancelDecision('decision-123', 'user-123', 'No longer needed');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("status = 'cancelled'"),
        expect.any(Array)
      );
      expect(result.status).toBe('cancelled');
    });
  });
});
