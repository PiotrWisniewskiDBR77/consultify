/**
 * InitiativeService L2 Component Tests
 * Tests for initiative business logic and lifecycle management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import initiativeService from '../../../server/src/services/initiativeService';

// Mock dependencies
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
    queryOne: vi.fn(),
    queryRun: vi.fn(),
  };
  return { mockDb };
});

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockReturnValue(mockDb),
  default: mockDb,
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn().mockImplementation((sql, params) => mockDb.queryOne(sql, params)),
  queryRun: vi.fn().mockImplementation((sql, params) => mockDb.queryRun(sql, params)),
  queryAll: vi.fn().mockImplementation((sql, params) => mockDb.all(sql, params)),
}));

describe('InitiativeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initiativeService.setDependencies({ db: mockDb as any });

    // Default returns to prevent undefined errors
    mockDb.all.mockResolvedValue([]);
    mockDb.get.mockResolvedValue(null);
    mockDb.run.mockResolvedValue({ changes: 1, lastID: 1 });
  });

  describe('Definition Service', () => {
    it('should get initiative by id', async () => {
      const mockInitiative = {
        id: 'init-123',
        title: 'Test Initiative',
        organization_id: 'org-123',
      };
      mockDb.get.mockResolvedValue(mockInitiative);

      const result = await initiativeService.getInitiativeById('init-123', 'org-123');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'init-123',
          title: 'Test Initiative',
        })
      );
    });

    it('should create initiative', async () => {
      const data = {
        organization_id: 'org-123',
        title: 'New Initiative',
        status: 'DRAFT',
      };

      const mockCreatedInitiative = { id: 'new-id', ...data };
      mockDb.run.mockResolvedValue({ changes: 1, lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockCreatedInitiative);

      const result = await initiativeService.createInitiative(data as any);

      expect(result.title).toBe('New Initiative');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO initiatives/i),
        expect.any(Array)
      );
    });
  });

  describe('Progress Service', () => {
    it('should recalculate progress', async () => {
      // Mock tasks for weight calculation
      mockDb.all.mockResolvedValue([
        { progress: 100, priority: 'high' }, // weight 1.5, contribution 150
        { progress: 0, priority: 'medium' }, // weight 1.0, contribution 0
      ]);

      mockDb.run.mockResolvedValue({ changes: 1 });

      // Using the service directly which handles param normalization
      const progress = await initiativeService.recalculateProgress({
        initiativeId: 'init-123',
        organizationId: 'org-123',
      });

      expect(progress).toBe(60);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE initiatives SET progress =/i),
        expect.arrayContaining([60, 'init-123'])
      );
    });
  });

  describe('Financial Service', () => {
    it('should update financials', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const success = await initiativeService.updateFinancials('init-123', 1000, 500, 20);

      expect(success).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE initiatives/i),
        expect.arrayContaining([1000, 500, 20, 'init-123'])
      );
    });
  });
});
