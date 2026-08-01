import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSnapshot = vi.fn();

vi.mock('../../../server/src/services/v8/executionManagementSnapshotService.js', () => ({
  getExecutionManagementSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
}));
vi.mock('../../../server/src/services/v8/executionSpineService.js', () => ({}));
vi.mock('../../../server/src/services/v8/toolGovernanceService.js', () => ({}));
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({}));

import executionRoutes from '../../../server/src/routes/v8/execution.routes.js';

const ORG = '11111111-1111-4111-8111-111111111111';

function createApp(withContext = true): Express {
  const app = express();
  app.use(express.json());
  if (withContext) {
    app.use((req: any, _res, next) => {
      req.v8Context = { organizationId: ORG, userId: 'user-1', userRole: 'ADMIN' };
      next();
    });
  }
  app.use('/api/v8/execution', executionRoutes);
  return app;
}

describe('GET /api/v8/execution/management/initiatives/:initiativeId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a stable snapshot envelope and forwards project scope', async () => {
    mockGetSnapshot.mockResolvedValue({
      contractVersion: 'execution_management_snapshot_v1',
      asOf: '2026-08-01T10:00:00.000Z',
      initiative: { id: 'ini-1' },
      milestones: [],
      tasks: [],
      decisions: [],
      provenance: {},
      degradedSections: [],
    });
    const res = await request(createApp()).get(
      '/api/v8/execution/management/initiatives/ini-1?projectId=project-1'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.contractVersion).toBe('execution_management_snapshot_v1');
    expect(mockGetSnapshot).toHaveBeenCalledWith(ORG, 'ini-1', 'project-1');
  });

  it('returns indistinguishable 404 for missing, foreign-org or project mismatch', async () => {
    mockGetSnapshot.mockResolvedValue(null);
    const res = await request(createApp()).get(
      '/api/v8/execution/management/initiatives/foreign?projectId=foreign-project'
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Initiative not found',
      code: 'EXECUTION_MANAGEMENT_INITIATIVE_NOT_FOUND',
    });
  });
});
