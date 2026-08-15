/**
 * InitiativeController L2 Component Tests
 * Tests for initiative lifecycle management, financial calculations, and status updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InitiativeController } from '../../../server/src/controllers/InitiativeController';
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';
import notificationService from '../../../server/src/services/notificationService.js';

// Mock dependencies
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
  getTableColumns: vi.fn(async () => []),
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: {
    send: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/raidAnalyzeService.js', () => ({
  analyzeRaidWithAI: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('InitiativeController', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      user: {
        id: 'user-123',
        organizationId: 'org-123',
        role: 'ADMIN',
      },
      body: {},
      params: {},
      query: {},
      headers: {
        'accept-language': 'en-US,en;q=0.9',
      },
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInitiatives', () => {
    it('should return list of initiatives for organization', async () => {
      const mockInitiatives = [
        { id: 'init-1', organization_id: 'org-123', name: 'Initiative 1', status: 'DRAFT' },
        { id: 'init-2', organization_id: 'org-123', name: 'Initiative 2', status: 'PLANNING' },
      ];

      (queryHelpers.queryAll as any).mockResolvedValue(mockInitiatives);

      await InitiativeController.getInitiatives(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.any(Array));
      expect(mockRes.json.mock.calls[0][0]).toHaveLength(2);
      expect(queryHelpers.queryAll).toHaveBeenCalledWith(expect.stringContaining('SELECT i.*'), [
        'org-123',
      ]);
    });

    it('should filter by status if provided', async () => {
      mockReq.query = { status: 'DRAFT' };
      (queryHelpers.queryAll as any).mockResolvedValue([]);

      await InitiativeController.getInitiatives(mockReq, mockRes);

      expect(queryHelpers.queryAll).toHaveBeenCalledWith(
        expect.stringContaining('AND UPPER(i.status) = ?'),
        ['org-123', 'DRAFT']
      );
    });
  });

  describe('getInitiativeById', () => {
    it('should return initiative if it exists', async () => {
      mockReq.params = { id: 'init-123' };
      const mockInitiative = {
        id: 'init-123',
        organization_id: 'org-123',
        name: 'Test Initiative',
        status: 'DRAFT',
      };

      (queryHelpers.queryOne as any).mockResolvedValue(mockInitiative);

      await InitiativeController.getInitiativeById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'init-123',
        })
      );
    });

    it('should return 404 if not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      (queryHelpers.queryOne as any).mockResolvedValue(null);

      await InitiativeController.getInitiativeById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Initiative not found',
        code: 'INITIATIVE_NOT_FOUND',
      });
    });
  });

  describe('createInitiative', () => {
    it('should create a new initiative', async () => {
      mockReq.body = {
        title: 'New Initiative',
        projectId: 'project-123',
        axis: 'Growth',
        area: 'Marketing',
      };

      (queryHelpers.queryRun as any).mockResolvedValue({ changes: 1 });

      await InitiativeController.createInitiative(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          name: 'New Initiative',
        })
      );
      expect(queryHelpers.queryRun).toHaveBeenCalled();
    });

    it('should return the card-formula violation if title is missing', async () => {
      mockReq.body = { projectId: 'project-123' };

      await InitiativeController.createInitiative(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CARD_CONTENT_FORMULA_VIOLATION',
          kind: 'initiative',
          violations: [
            expect.objectContaining({
              code: 'initiative.title_present',
              severity: 'hard',
            }),
          ],
        })
      );
    });
  });
});
