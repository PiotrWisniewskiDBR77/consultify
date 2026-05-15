import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
    next();
  },
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () => new Set(['id', 'organization_id'])),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
  run: (...args: any[]) => dbRunMock(...args),
  all: vi.fn(async () => []),
}));

import workCanvasRoutes from '../../../server/src/routes/work-canvas.routes.js';

const makeDraftRow = (provenance: Record<string, unknown> = {}) => ({
  id: 'draft-1',
  organization_id: 'org-1',
  created_by: 'user-1',
  conversation_id: 'conv-1',
  kind: 'markdown',
  title: 'Canvas draft',
  content_json: '{}',
  canonical_format: 'markdown',
  content_md: '# Draft',
  content_json_native: null,
  blocks_json: null,
  content_schema_version: null,
  markdown_projection_status: 'synced',
  markdown_projected_at: null,
  projection_error: null,
  sources_json: '[]',
  provenance_json: JSON.stringify(provenance),
  project_id: 'project-1',
  owner_id: 'user-1',
  research_session_id: null,
  artifact_id: null,
  artifact_run_id: null,
  artifact_version: null,
  save_state: 'unsaved',
  lifecycle_state: 'draft',
  dirty_state: 'dirty',
  visibility: 'project',
  audit_status: 'not_required',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

describe('work-canvas workflow contract routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/work-canvas', workCanvasRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || err.status || 500).json({
      error: err.message,
      code: err.code,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // ensureStorage calls:
    dbRunMock.mockResolvedValue(undefined);
    // ownedDraft calls:
    dbGetMock.mockResolvedValue(makeDraftRow({ workflowRuns: [] }));
  });

  it('returns coded 400 for unsupported workflow template', async () => {
    const res = await request(app)
      .post('/api/work-canvas/drafts/draft-1/workflows')
      .send({ template: 'invalid_template' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WORK_CANVAS_WORKFLOW_TEMPLATE_INVALID');
  });

  it('returns coded 404 when resuming missing workflow run', async () => {
    const res = await request(app)
      .post('/api/work-canvas/drafts/draft-1/workflows/run-missing/resume')
      .send({ note: 'resume' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('WORK_CANVAS_WORKFLOW_RUN_NOT_FOUND');
  });

  it('returns coded 503 when workflow persistence fails after run creation', async () => {
    dbGetMock.mockResolvedValueOnce(makeDraftRow({ workflowRuns: [] }));
    dbRunMock.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('UPDATE work_canvas_drafts')) {
        throw new Error('db-write-failed');
      }
      return undefined;
    });

    const res = await request(app)
      .post('/api/work-canvas/drafts/draft-1/workflows')
      .send({ template: 'market_research_to_report' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('WORK_CANVAS_WORKFLOW_PERSIST_FAILED');
  });
});
