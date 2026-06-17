/**
 * M22 L-08 — Route-integration tests for Wave 6 Teresa-memory routes.
 *
 * Mounts the REAL wave6-context router (`/api/ai-context/*`) via makeTestApp and
 * verifies that key endpoints:
 *   (a) are mounted and reachable behind verifyToken (stubbed → pass-through),
 *   (b) return the expected JSON envelope shape,
 *   (c) forward the caller's organizationId / userId to the underlying service
 *       (org-scoping), and
 *   (d) propagate the 201 / blocked status codes the route encodes.
 *
 * The wave6ContextLearningService is fully mocked — no real DB is touched.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTestApp } from '../_helpers/testApp';

// ── Hoisted service spies ─────────────────────────────────────────────────────
const svc = vi.hoisted(() => ({
  listWave6ContextPanel: vi.fn(),
  captureWave6ContextSnapshot: vi.fn(),
  recordWave6ContextLedgerEntry: vi.fn(),
  forgetWave6ContextLedgerEntry: vi.fn(),
  captureWave6MemoryCandidate: vi.fn(),
  decideWave6MemoryCandidate: vi.fn(),
  normalizeWave6AssistantScope: vi.fn((s: unknown) => s ?? 'teresa'),
}));

// verifyToken → pass-through; req.user is injected by beforeMount below.
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/wave6ContextLearningService.js', () => svc);

const BASE = '/api/ai-context';
const ORG = 'org-wave6';
const USER = 'user-wave6';

let router: any;

const makeApp = (user: Record<string, unknown> = { id: USER, organizationId: ORG, role: 'admin' }) =>
  makeTestApp({
    mountPath: BASE,
    router,
    beforeMount: (app) => {
      app.use((req: any, _res, next) => {
        req.user = user;
        next();
      });
    },
  });

beforeEach(async () => {
  vi.clearAllMocks();
  svc.normalizeWave6AssistantScope.mockImplementation((s: unknown) => s ?? 'teresa');
  router = (await import('../../../server/src/routes/wave6-context.routes.ts')).default;
});

describe('M22 L-08 — Wave 6 /api/ai-context routes', () => {
  it('GET /panel returns 200 with { success, panel } and org/user scoping', async () => {
    svc.listWave6ContextPanel.mockResolvedValue({ snapshots: [], ledger: [], candidates: [] });

    const res = await request(makeApp()).get(`${BASE}/panel`).query({ projectId: 'p-1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.panel).toEqual({ snapshots: [], ledger: [], candidates: [] });
    expect(svc.listWave6ContextPanel).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: USER,
      projectId: 'p-1',
    });
  });

  it('POST /snapshots returns 201 with { success, snapshot }', async () => {
    svc.captureWave6ContextSnapshot.mockResolvedValue({ id: 'snap-1', snapshotType: 'project' });

    const res = await request(makeApp())
      .post(`${BASE}/snapshots`)
      .send({ snapshotType: 'project', facts: { a: 1 }, sourceRefs: ['s1'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, snapshot: { id: 'snap-1' } });
    expect(svc.captureWave6ContextSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: USER, snapshotType: 'project' })
    );
  });

  it('POST /memory/candidates returns 201 when not blocked', async () => {
    svc.captureWave6MemoryCandidate.mockResolvedValue({ blocked: false, candidate: { id: 'c-1' } });

    const res = await request(makeApp())
      .post(`${BASE}/memory/candidates`)
      .send({ key: 'pref', value: 'dark-mode', memoryScope: 'user' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, blocked: false, candidate: { id: 'c-1' } });
    expect(svc.captureWave6MemoryCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: USER, key: 'pref', value: 'dark-mode' })
    );
  });

  it('POST /memory/candidates returns 200 (not 201) when service blocks the write', async () => {
    svc.captureWave6MemoryCandidate.mockResolvedValue({ blocked: true, reason: 'private_mode' });

    const res = await request(makeApp())
      .post(`${BASE}/memory/candidates`)
      .send({ key: 'pref', value: 'x', privateMode: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, blocked: true, reason: 'private_mode' });
  });

  it('POST /memory/candidates/:id/decision returns 200 with the decided candidate (stewardship)', async () => {
    svc.decideWave6MemoryCandidate.mockResolvedValue({ id: 'c-9', status: 'approved' });

    const res = await request(makeApp())
      .post(`${BASE}/memory/candidates/c-9/decision`)
      .send({ decision: 'approve', reason: 'useful' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, candidate: { id: 'c-9', status: 'approved' } });
    expect(svc.decideWave6MemoryCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, candidateId: 'c-9', decision: 'approve' })
    );
  });

  it('POST /ledger/:id/forget returns 200 with the service result envelope', async () => {
    svc.forgetWave6ContextLedgerEntry.mockResolvedValue({ success: true, forgotten: true });

    const res = await request(makeApp()).post(`${BASE}/ledger/led-1/forget`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, forgotten: true });
    expect(svc.forgetWave6ContextLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, ledgerId: 'led-1' })
    );
  });
});
