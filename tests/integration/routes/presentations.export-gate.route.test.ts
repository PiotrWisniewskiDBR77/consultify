/**
 * P0.4 — Route-level contract for presentation export quality-gate enforcement.
 *
 * The module-level contract for `enforceQualityGateForExport` / `canOverrideQualityGate`
 * is already pinned by `tests/integration/presentations/export-quality-gate.regression.test.ts`
 * (L-02/L-07). This file drives the SAME contract through the real HTTP route
 * (`POST /presentations/decks/:deckId/export/png`) so the wiring between the
 * router, the auth/role middleware, and the quality-gate helper is exercised
 * end-to-end — not just the helper in isolation.
 *
 * Covers (Harvard/wdrozenie-100/_NARZEDZIE_PREZENTACJE_AUDYT_I_PLAN_2026-07-04.md, P0.4):
 *  (a) export with a failing quality gate -> 422 QUALITY_GATE_BLOCKED
 *  (b) ?overrideQualityGate=true with a role OUTSIDE OVERRIDE_ROLES -> gate still enforced
 *  (c) ?overrideQualityGate=true with an allowed role (ADMIN/OWNER/SUPERADMIN) -> gate bypassed
 *
 * Mocking strategy mirrors `tests/unit/backend/routes/presentations.routes.org-guard.test.ts`:
 * boot the real router behind a minimal Express app, mock only the auth
 * middleware + DB/service boundary (DbPromise, artifactRegistryService,
 * reportsPresModelService, OrgPoliciesService, notificationService,
 * presentationQualityGatesService), and drive it with supertest. Everything
 * else (PNG rendering via `sharp`, zip via `archiver`, capability checks,
 * confidentiality policy) is exercised for real.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'OWNER',
  organizationId: 'org-A',
};

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser?.id;
    req.userRole = mockUser?.role;
    req.organizationId = mockUser?.organizationId;
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: vi.fn(),
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: vi.fn().mockResolvedValue({ artifactId: 'artifact-1' }),
  getArtifactByOriginUnscoped: vi.fn(),
  registerArtifactOrigin: vi.fn(),
  mapPresentationStatusToDeliveryState: vi.fn(() => 'delivered'),
  deriveArtifactVisibilityScope: vi.fn(() => 'private'),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn().mockResolvedValue(undefined),
}));

const { mockCheckGates } = vi.hoisted(() => ({ mockCheckGates: vi.fn() }));
vi.mock('../../../server/src/services/presentationQualityGatesService.js', () => ({
  checkDeckQualityGates: mockCheckGates,
}));

const DECK_ROW = {
  id: 'deck-1',
  organization_id: 'org-A',
  title: 'Q3 Steering Deck',
  theme: 'corporate',
  deck_json: JSON.stringify({
    schemaVersion: 1,
    cards: [
      { card_id: 'c1', intent: 'cover', title: 'Cover', blocks: [] },
      { card_id: 'c2', intent: 'executive_summary', title: 'Summary', blocks: [] },
    ],
  }),
};

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(DECK_ROW),
  run: vi.fn().mockResolvedValue(undefined),
}));

function blockedGateReport() {
  return {
    canExport: false,
    canShare: false,
    result: 'BLOCKED_P1',
    scorecard: { p0: 1, p1: 0, p2: 0, passVocabulary: 'BLOCKED_P1' },
    gates: [
      {
        id: 'qg-1',
        gateType: 'EMPTY_CONTENT_CARD',
        severity: 'error',
        priority: 'P0',
        message: 'Card 2 has no content',
        category: 'content',
      },
    ],
  };
}

function passingGateReport() {
  return {
    canExport: true,
    canShare: true,
    result: 'PASS',
    scorecard: { p0: 0, p1: 0, p2: 0, passVocabulary: 'PASS' },
    gates: [],
  };
}

async function buildApp() {
  vi.resetModules();
  const { default: router } = await import('../../../server/src/routes/presentations.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/presentations', router);
  return app;
}

describe('P0.4 — POST /presentations/decks/:deckId/export/png quality-gate contract', () => {
  beforeEach(() => {
    mockCheckGates.mockReset();
    mockUser = { id: 'user-1', role: 'OWNER', organizationId: 'org-A' };
  });

  it('(a) blocked deck without override -> 422 QUALITY_GATE_BLOCKED', async () => {
    mockCheckGates.mockResolvedValue(blockedGateReport());
    const app = await buildApp();

    const res = await request(app).post('/presentations/decks/deck-1/export/png');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      code: 'QUALITY_GATE_BLOCKED',
      format: 'png',
    });
  });

  it('(b) blocked deck + ?overrideQualityGate=true with a role OUTSIDE OVERRIDE_ROLES -> gate still enforced (422)', async () => {
    mockUser = { id: 'user-2', role: 'PROJECT_MANAGER', organizationId: 'org-A' };
    mockCheckGates.mockResolvedValue(blockedGateReport());
    const app = await buildApp();

    const res = await request(app).post(
      '/presentations/decks/deck-1/export/png?overrideQualityGate=true'
    );

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('QUALITY_GATE_BLOCKED');
  });

  it('(b2) blocked deck + ?overrideQualityGate=true with USER role -> gate still enforced (422)', async () => {
    mockUser = { id: 'user-3', role: 'USER', organizationId: 'org-A' };
    mockCheckGates.mockResolvedValue(blockedGateReport());
    const app = await buildApp();

    const res = await request(app).post(
      '/presentations/decks/deck-1/export/png?overrideQualityGate=true'
    );

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('QUALITY_GATE_BLOCKED');
  });

  it.each(['ADMIN', 'OWNER', 'SUPERADMIN'])(
    '(c) blocked deck + ?overrideQualityGate=true with %s -> gate bypassed (not 422)',
    async (role) => {
      mockUser = { id: 'user-4', role, organizationId: 'org-A' };
      mockCheckGates.mockResolvedValue(blockedGateReport());
      const app = await buildApp();

      const res = await request(app).post(
        '/presentations/decks/deck-1/export/png?overrideQualityGate=true'
      );

      // The quality gate was bypassed, but restricted MAT policy still denies
      // the unapproved sharp/SVG engine before rendering or receipt creation.
      expect(res.status).not.toBe(422);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('EXPORT_ENGINE_NOT_APPROVED');
    }
  );

  it('passing deck reaches restricted engine policy and fails explicitly', async () => {
    mockCheckGates.mockResolvedValue(passingGateReport());
    const app = await buildApp();

    const res = await request(app).post('/presentations/decks/deck-1/export/png');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('EXPORT_ENGINE_NOT_APPROVED');
  });
});
