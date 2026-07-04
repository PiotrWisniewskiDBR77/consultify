/**
 * HTTP-shape tests for `table-platform.ai-editor.routes.ts`.
 *
 * Strategy: import the actual router and walk its handler stack directly
 * (same pattern as `table-platform.routes.test.ts`). Avoids `app.listen()`.
 *
 * Covers: happy path (propose), missing auth → 401, missing org → 403,
 * cross-org table (IDOR) → 404, invalid body → 400.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProposeEdit = vi.fn();
const mockApplyProposal = vi.fn();
const mockRejectProposal = vi.fn();
const mockGetSnapshot = vi.fn();
const mockDbQuery = vi.fn();

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: (...args: unknown[]) => mockDbQuery(...args) }),
}));

vi.mock('../../services/tablePlatform/TableAiEditorService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/TableAiEditorService.js')
  >('../../services/tablePlatform/TableAiEditorService.js');
  return {
    ...actual,
    default: {
      proposeEdit: (...args: unknown[]) => mockProposeEdit(...args),
      applyProposal: (...args: unknown[]) => mockApplyProposal(...args),
      rejectProposal: (...args: unknown[]) => mockRejectProposal(...args),
    },
  };
});

vi.mock('../../services/tablePlatform/AiUsageService.js', () => ({
  default: { getSnapshot: (...args: unknown[]) => mockGetSnapshot(...args) },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (req.__noAuth) {
      return res.status(401).json({ error: 'No token provided' });
    }
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_AI_EDITOR: true },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    params: {},
    body: {},
    query: {},
    headers: {},
    user: { id: 'user-1' },
    userId: 'user-1',
    organizationId: 'org-A',
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.set = vi.fn().mockReturnValue(res);
  return res;
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.ai-editor.routes.js');
  return mod.default;
}

async function runRoute(path: string, method: string, req: any, res: any): Promise<void> {
  const router = await importRouter();
  const stack = (router as any).stack as any[];
  for (const layer of stack) {
    if (res.body !== undefined || res.headersEnded) return;
    if (layer.route) {
      const routePath = layer.route.path as string;
      if (routePath !== path) continue;
      if (!layer.route.methods?.[method.toLowerCase()]) continue;
      for (const innerLayer of layer.route.stack) {
        if (res.body !== undefined) return;
        let nextCalled = false;
        await innerLayer.handle(req, res, (err?: unknown) => {
          nextCalled = true;
          if (err) throw err;
        });
        if (!nextCalled) return;
      }
    } else {
      let nextCalled = false;
      await layer.handle(req, res, (err?: unknown) => {
        nextCalled = true;
        if (err) throw err;
      });
      if (!nextCalled) return;
    }
  }
}

describe('table-platform.ai-editor.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue({
      rows: [{ workspace_id: 'ws-1', organization_id: 'org-A' }],
    });
  });

  describe('POST /tables/:tableId/ai-editor/propose', () => {
    it('happy path: returns 202 with proposal payload', async () => {
      const proposal = { proposalId: 'prop-1', status: 'pending', level: 'cell' };
      mockProposeEdit.mockResolvedValue(proposal);

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { level: 'cell', prompt: 'Fix typo' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/ai-editor/propose', 'POST', req, res);

      expect(res.statusCode).toBe(202);
      expect(res.body).toEqual({ data: proposal });
      expect(mockProposeEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-1',
          level: 'cell',
          prompt: 'Fix typo',
          workspaceId: 'ws-1',
          organizationId: 'org-A',
          actorUserId: 'user-1',
        })
      );
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { level: 'cell', prompt: 'Fix typo' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/ai-editor/propose', 'POST', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockProposeEdit).not.toHaveBeenCalled();
    });

    it('missing organization context → 403', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { level: 'cell', prompt: 'Fix typo' },
        organizationId: undefined,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/ai-editor/propose', 'POST', req, res);

      expect(res.statusCode).toBe(403);
      expect(mockProposeEdit).not.toHaveBeenCalled();
    });

    it('table belongs to a different organization (IDOR) → 404', async () => {
      // Table resolves to org-B, actor is in org-A.
      mockDbQuery.mockResolvedValue({
        rows: [{ workspace_id: 'ws-2', organization_id: 'org-B' }],
      });

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-in-other-org' },
        body: { level: 'cell', prompt: 'Fix typo' },
        organizationId: 'org-A',
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/ai-editor/propose', 'POST', req, res);

      expect(res.statusCode).toBe(404);
      expect(mockProposeEdit).not.toHaveBeenCalled();
    });

    it('invalid level → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { level: 'not-a-real-level', prompt: 'Fix typo' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/ai-editor/propose', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_LEVEL' });
      expect(mockProposeEdit).not.toHaveBeenCalled();
    });

    it('missing prompt → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { level: 'cell' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/ai-editor/propose', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ code: 'PROMPT_REQUIRED' });
    });
  });

  describe('POST /ai-editor/proposals/:proposalId/apply', () => {
    it('happy path: returns 200 with applied proposal', async () => {
      const applied = { proposalId: 'prop-1', status: 'applied' };
      mockApplyProposal.mockResolvedValue(applied);

      const req = createMockReq({
        method: 'POST',
        params: { proposalId: 'prop-1' },
        body: { workspaceId: 'ws-1' },
      });
      const res = createMockRes();
      await runRoute('/ai-editor/proposals/:proposalId/apply', 'POST', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: applied });
    });

    it('workspaceId belonging to another org (IDOR) → 403', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] }); // workspaceBelongsToOrganization → false

      const req = createMockReq({
        method: 'POST',
        params: { proposalId: 'prop-1' },
        body: { workspaceId: 'ws-other-org' },
      });
      const res = createMockRes();
      await runRoute('/ai-editor/proposals/:proposalId/apply', 'POST', req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ code: 'TENANT_VIOLATION' });
      expect(mockApplyProposal).not.toHaveBeenCalled();
    });

    it('missing workspaceId → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { proposalId: 'prop-1' },
        body: {},
      });
      const res = createMockRes();
      await runRoute('/ai-editor/proposals/:proposalId/apply', 'POST', req, res);

      expect(res.statusCode).toBe(400);
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { proposalId: 'prop-1' },
        body: { workspaceId: 'ws-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/ai-editor/proposals/:proposalId/apply', 'POST', req, res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /ai-editor/budget', () => {
    it('happy path: returns 200 with budget snapshot', async () => {
      const snapshot = { workspaceId: 'ws-1', usedTokens: 100, limitTokens: 1000 };
      mockGetSnapshot.mockResolvedValue(snapshot);

      const req = createMockReq({
        method: 'GET',
        query: { workspaceId: 'ws-1' },
      });
      const res = createMockRes();
      await runRoute('/ai-editor/budget', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: snapshot });
    });

    it('workspace in another org (IDOR) → 403', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      const req = createMockReq({
        method: 'GET',
        query: { workspaceId: 'ws-other-org' },
      });
      const res = createMockRes();
      await runRoute('/ai-editor/budget', 'GET', req, res);

      expect(res.statusCode).toBe(403);
      expect(mockGetSnapshot).not.toHaveBeenCalled();
    });

    it('missing workspaceId query param → 400', async () => {
      const req = createMockReq({ method: 'GET', query: {} });
      const res = createMockRes();
      await runRoute('/ai-editor/budget', 'GET', req, res);

      expect(res.statusCode).toBe(400);
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'GET',
        query: { workspaceId: 'ws-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/ai-editor/budget', 'GET', req, res);

      expect(res.statusCode).toBe(401);
    });
  });
});
