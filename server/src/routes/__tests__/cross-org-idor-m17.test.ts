/**
 * @vitest-environment node
 *
 * M17 Outputs — cross-org IDOR contract tests (adversarial sweep, wave 5 cohort).
 *
 * Holes confirmed + fixed in this sweep:
 *   HOLE-1 — presentations POST /decks/:deckId/analytics/view looked the deck up
 *            by id WITHOUT an org filter → org A could write analytics rows against
 *            (and probe existence of) org B's deck. Now org-scoped.
 *   HOLE-2 — report-builder POST /:id/sections called addCustomSection(reportId)
 *            (keyed on report_id only) with NO org-ownership check → org A could
 *            insert sections into org B's report. Now guarded by getReport(id, org).
 *   HOLE-3 — report-builder DELETE /:id/sections/:sectionKey called
 *            removeSection(reportId, sectionKey) with NO org-ownership check →
 *            org A could delete org B's sections. Now guarded by getReport(id, org).
 *
 * Wave 6 addition:
 *   GATE-NOTION — report-builder POST /:id/export/notion published a report to an
 *            external workspace WITHOUT the export-readiness quality gate that the
 *            pdf/doc/docx/pptx exports enforce → un-vetted reports could leak
 *            outside. Now gated by enforceQualityGatesForExport (409 when not ready).
 *
 * Tests run against mocked DB / auth — no real network or DB.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (declared before vi.mock factories) ───────────────────

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();

const mockGetReport = vi.fn();
const mockAddCustomSection = vi.fn();
const mockRemoveSection = vi.fn();
const mockCreateExportRecord = vi.fn();
const mockCheckQualityGates = vi.fn();
const mockExportReportToNotion = vi.fn();

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const ORG_B = 'bbb00000-0000-4000-8000-000000000002';
const USER_A = 'user-a-111';

// ── Auth / RBAC middleware mocks ─────────────────────────────────────────────

vi.mock('../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: () => void) => {
      if (!req.user) return res.status(401).json({ error: 'No token' });
      if (!roles.includes(req.user.role))
        return res.status(403).json({ error: 'Insufficient role' });
      next();
    },
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess:
    () =>
    (req: any, res: any, next: () => void) => {
      if (!req.user) return res.status(401).json({ error: 'No token' });
      next();
    },
  requireOrgRole:
    () =>
    (req: any, res: any, next: () => void) => {
      if (!req.user) return res.status(401).json({ error: 'No token' });
      next();
    },
  validateOrgMembership: (req: any, res: any, next: () => void) => {
    if (!req.user) return res.status(401).json({ error: 'No token' });
    next();
  },
}));

vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: any, next: () => void) => {
    (req as any).emitAuditEvent = vi.fn(async () => undefined);
    next();
  },
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  default: (_req: any, _res: any, next: () => void) => next(),
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...a: unknown[]) => mockDbAll(...a),
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
}));

// ── report-builder service mock (HOLE-2 / HOLE-3) ────────────────────────────

vi.mock('../../services/reportBuilderService.js', () => {
  const svc = {
    getReport: (...a: unknown[]) => mockGetReport(...a),
    addCustomSection: (...a: unknown[]) => mockAddCustomSection(...a),
    removeSection: (...a: unknown[]) => mockRemoveSection(...a),
    createExportRecord: (...a: unknown[]) => mockCreateExportRecord(...a),
  };
  return { __esModule: true, default: svc, ...svc };
});

// Export-readiness quality gate (shared by all export formats).
vi.mock('../../services/reportQualityGatesService.js', () => ({
  checkQualityGates: (...a: unknown[]) => mockCheckQualityGates(...a),
}));

// External Notion publish target.
vi.mock('../../services/ai/integrationHubService.js', () => ({
  exportReportToNotion: (...a: unknown[]) => mockExportReportToNotion(...a),
}));

// ═══════════════════════════════════════════════════════════════════════════
// HOLE-2 / HOLE-3 — report-builder section mutations reject foreign-org reports
// ═══════════════════════════════════════════════════════════════════════════

describe('M17 HOLE-2/3 — report-builder section writes reject a foreign-org report', () => {
  async function buildReportBuilderApp(): Promise<Express> {
    const mod = await import('../report-builder.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/report-builder', mod.default);
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0 });
    mockDbAll.mockResolvedValue([]);
    mockAddCustomSection.mockResolvedValue({ sectionKey: 'custom_x' });
    mockRemoveSection.mockResolvedValue(true);
  });

  it('POST /:id/sections → 404 for a foreign-org report (no addCustomSection)', async () => {
    // getReport is org-scoped → returns null for a report the caller does not own.
    mockGetReport.mockResolvedValue(null);
    const app = await buildReportBuilderApp();

    const res = await request(app)
      .post('/api/report-builder/report-from-org-b/sections')
      .send({ title: 'cross-org section attempt' });

    expect(res.status).toBe(404);
    // Ownership SELECT ran org-scoped against the caller's org.
    expect(mockGetReport).toHaveBeenCalledWith('report-from-org-b', ORG_A);
    // The unscoped section write never executed.
    expect(mockAddCustomSection).not.toHaveBeenCalled();
  });

  it('POST /:id/sections → 201 + addCustomSection when the report is owned', async () => {
    mockGetReport.mockResolvedValue({ report: { id: 'report-owned', status: 'DRAFT' }, sections: [] });
    const app = await buildReportBuilderApp();

    const res = await request(app)
      .post('/api/report-builder/report-owned/sections')
      .send({ title: 'legit section' });

    expect(res.status).toBe(201);
    expect(mockGetReport).toHaveBeenCalledWith('report-owned', ORG_A);
    expect(mockAddCustomSection).toHaveBeenCalledTimes(1);
    expect(mockAddCustomSection.mock.calls[0][0]).toBe('report-owned');
  });

  it('DELETE /:id/sections/:sectionKey → 404 for a foreign-org report (no removeSection)', async () => {
    mockGetReport.mockResolvedValue(null);
    const app = await buildReportBuilderApp();

    const res = await request(app).delete(
      '/api/report-builder/report-from-org-b/sections/sec-1'
    );

    expect(res.status).toBe(404);
    expect(mockGetReport).toHaveBeenCalledWith('report-from-org-b', ORG_A);
    expect(mockRemoveSection).not.toHaveBeenCalled();
  });

  it('DELETE /:id/sections/:sectionKey → 200 + removeSection when the report is owned', async () => {
    mockGetReport.mockResolvedValue({ report: { id: 'report-owned', status: 'DRAFT' }, sections: [] });
    const app = await buildReportBuilderApp();

    const res = await request(app).delete('/api/report-builder/report-owned/sections/sec-1');

    expect(res.status).toBe(200);
    expect(mockGetReport).toHaveBeenCalledWith('report-owned', ORG_A);
    expect(mockRemoveSection).toHaveBeenCalledWith('report-owned', 'sec-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HOLE-1 — presentations analytics/view deck lookup is org-scoped (source guard)
//
// The presentations router has a very heavy import graph; a static source guard
// (mirroring the benefits IRIS guard in cross-org-idor.test.ts) pins the contract
// without booting the whole module: the deck lookup feeding the analytics write
// MUST carry an organization_id filter.
// ═══════════════════════════════════════════════════════════════════════════

describe('M17 HOLE-1 — presentations analytics/view deck lookup carries an org filter', () => {
  it('the deck lookup in POST /decks/:deckId/analytics/view is org-scoped (source guard)', async () => {
    const fs = await import('node:fs');
    const url = await import('node:url');
    const path = url.fileURLToPath(new URL('../presentations.routes.ts', import.meta.url));
    const src = fs.readFileSync(path, 'utf8');

    // Isolate the analytics/view handler block.
    const marker = "'/decks/:deckId/analytics/view'";
    const start = src.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    // Block ends at the next router.<verb>( registration.
    const after = src.slice(start + marker.length);
    const end = after.search(/router\.(get|post|put|patch|delete)\(/);
    const block = end === -1 ? after : after.slice(0, end);

    // Every presentation_decks lookup inside the handler must be org-scoped.
    const deckLookups = block.match(/FROM presentation_decks WHERE[^\n]*/g) || [];
    expect(deckLookups.length).toBeGreaterThan(0);
    for (const lookup of deckLookups) {
      expect(/organization_id\s*=\s*\?/.test(lookup)).toBe(true);
    }
  });

  it('no bare (org-less) "FROM presentation_decks WHERE id = ?" remains in the router', async () => {
    const fs = await import('node:fs');
    const url = await import('node:url');
    const path = url.fileURLToPath(new URL('../presentations.routes.ts', import.meta.url));
    const src = fs.readFileSync(path, 'utf8');

    // A deck lookup by id that is NOT immediately followed by an org filter is the
    // IDOR shape we just closed. (share_token / share_expires_at lookups are
    // intentionally token-scoped and excluded by the `id = ?` anchor.)
    const bareById = src.match(/FROM presentation_decks\s+WHERE id = \?(?!\s*AND organization_id)/g) || [];
    expect(bareById).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GATE-NOTION — Notion export honours the same export-readiness gate as the
// file-format exports (pdf/doc/docx/pptx). A report that fails quality gates
// must NOT be publishable to an external workspace.
// ═══════════════════════════════════════════════════════════════════════════

describe('M17 GATE-NOTION — report-builder Notion export enforces export-readiness gate', () => {
  // A valid, active Notion integration so getNotionConfigForUser would succeed —
  // proves the block is the gate, not a missing-config short-circuit.
  const notionPrefsRow = {
    preferences_data: JSON.stringify([
      { provider: 'notion', status: 'active', config: { apiKey: 'secret', parentPageId: 'page-1' } },
    ]),
  };

  async function buildReportBuilderApp(): Promise<Express> {
    const mod = await import('../report-builder.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/report-builder', mod.default);
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbGet.mockResolvedValue(notionPrefsRow);
    mockDbRun.mockResolvedValue({ changes: 0 });
    mockDbAll.mockResolvedValue([]);
    mockGetReport.mockResolvedValue({
      report: { id: 'report-owned', title: 'R', status: 'DRAFT' },
      sections: [],
    });
    mockCreateExportRecord.mockResolvedValue({ id: 'exp-1' });
    mockExportReportToNotion.mockResolvedValue({ success: true, url: 'https://notion.so/p' });
  });

  it('POST /:id/export/notion → 409 when the report fails quality gates (no external publish)', async () => {
    mockCheckQualityGates.mockResolvedValue({
      reportId: 'report-owned',
      canExport: false,
      canApprove: false,
      gates: [{ id: 'g1', gateType: 'empty_report', severity: 'error', message: 'x', category: 'structure' }],
      score: 0,
      checkedAt: new Date().toISOString(),
    });
    const app = await buildReportBuilderApp();

    const res = await request(app).post('/api/report-builder/report-owned/export/notion').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('REPORT_NOT_READY_FOR_EXPORT');
    // The gate ran for the caller's own report/org…
    expect(mockCheckQualityGates).toHaveBeenCalledWith(ORG_A, 'report-owned');
    // …and the external publish + export record never happened.
    expect(mockExportReportToNotion).not.toHaveBeenCalled();
    expect(mockCreateExportRecord).not.toHaveBeenCalled();
  });

  it('POST /:id/export/notion → 200 + publish when the report passes quality gates', async () => {
    mockCheckQualityGates.mockResolvedValue({
      reportId: 'report-owned',
      canExport: true,
      canApprove: true,
      gates: [],
      score: 100,
      checkedAt: new Date().toISOString(),
    });
    const app = await buildReportBuilderApp();

    const res = await request(app).post('/api/report-builder/report-owned/export/notion').send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockCheckQualityGates).toHaveBeenCalledWith(ORG_A, 'report-owned');
    expect(mockExportReportToNotion).toHaveBeenCalledTimes(1);
  });
});
