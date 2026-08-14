/**
 * M18 · L-03 — Export QA gate, tested at the HTTP route (403), not only the
 * service.
 *
 * The audit card §03 flagged: the S6 QA gate was only exercised against
 * `exportDocumentArtifact` directly; `grep qa_blocking` in tests = 0, so the
 * route-layer translation (QaBlockingError → 403 { error: 'qa_blocking' }) and
 * the role-gated override were never proven through the real Express router.
 *
 * This test mounts the REAL `document-studio.routes` router via supertest and
 * drives the REAL `exportDocumentArtifact` end-to-end. Only the data seams are
 * mocked:
 *   - `verifyToken`            → inject a deterministic (userId, org, role).
 *   - `wave5ArtifactRuntimeService` → return an approval-gated artifact whose
 *     metadata carries a DocumentSchema (so `requiresApprovalForExport` fires).
 *   - `documentQaService.runDocumentQa` → return a BLOCKING report
 *     deterministically. The real `QaBlockingError`, `QaOverrideUnauthorizedError`,
 *     `canOverrideQa`, and `requiresApprovalForExport` are preserved (importActual)
 *     so the route's `instanceof` translation and the role gate run for real.
 *   - `DbPromise`              → no-op so cold-start hydration is silent (no PG).
 *
 * Asserted contract:
 *   1. blocking QA + no override        → 403 { error: 'qa_blocking' } + report.
 *   2. override by UNAUTHORIZED role    → 403 { error: 'qa_override_unauthorized' }
 *                                          + audit `qa_override_denied`.
 *   3. override by AUTHORIZED role      → 200 (gate bypassed, audited override).
 *
 * Anti-false-green: a `runDocumentQa` mock that returns a NON-blocking report
 * makes the export pass (200) — so the 403 assertions genuinely depend on the
 * gate, not on the route rejecting everything.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DocumentQaReport,
  DocumentSchema,
} from '../../../server/src/services/documentStudio/documentStudioTypes.js';

// ---------------------------------------------------------------------------
// Auth seam — role injected per-test via `mockUser`.
// ---------------------------------------------------------------------------
let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

// ---------------------------------------------------------------------------
// DB seam — hydration is best-effort + try/catch swallowed; make it silent.
// ---------------------------------------------------------------------------
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: () => Promise.resolve([]),
  get: () => Promise.resolve(null),
  run: () => Promise.resolve({ success: true, changes: 0 }),
  default: {},
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Successful exports now require durable MAT-010 lineage. That contract has
// dedicated real-Postgres coverage; this suite isolates the QA gate while
// representing a successful durable lineage write.
vi.mock('../../../server/src/services/lineage/artifactLineageService.js', () => ({
  deriveCreatedEventIdempotencyKey: () => 'qa-gate-created-key',
  deriveRequestBoundIdempotencyKey: () => 'qa-gate-request-key',
  recordLineageEventSafe: async () => true,
  recordLineageEventTracked: async () => ({ durable: true, status: 'RECORDED' }),
}));

// ---------------------------------------------------------------------------
// Wave5 artifact seam — an approval-gated artifact carrying a DocumentSchema.
// `getDocumentArtifact` reads `metadata_json.documentStudioSchema`.
// ---------------------------------------------------------------------------
const APPROVAL_GATED_TYPE = 'sales_proposal';
let schemaVersion = new Date(0).toISOString();

function makeSchema(artifactId: string): DocumentSchema {
  return {
    documentId: `doc-${artifactId}`,
    artifactId,
    title: 'QA gate fixture',
    documentType: APPROVAL_GATED_TYPE as DocumentSchema['documentType'],
    language: 'en',
    audience: ['client'],
    goal: 'inform' as DocumentSchema['goal'],
    communicationRegister: 'formal' as DocumentSchema['communicationRegister'],
    density: 'standard' as DocumentSchema['density'],
    languageStyle: 'plain' as DocumentSchema['languageStyle'],
    confidentiality: 'internal' as DocumentSchema['confidentiality'],
    formattingSchema: {} as DocumentSchema['formattingSchema'],
    sections: [],
    sourceRefs: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: schemaVersion,
  };
}

vi.mock('../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  getWave5Artifact: vi.fn((artifactId: string, organizationId: string) =>
    Promise.resolve({
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'QA gate fixture',
      content: 'body',
      metadata_json: { documentStudioSchema: makeSchema(artifactId) },
    })
  ),
  buildWave5ExportManifest: vi.fn(() => Promise.resolve({})),
  createWave5Artifact: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

// ---------------------------------------------------------------------------
// QA seam — keep the real error classes + policy, override only `runDocumentQa`.
// `qaBlocking` toggles whether the report blocks (anti-false-green control).
// ---------------------------------------------------------------------------
let qaBlocking = true;

function buildReport(artifactId: string, blocking: boolean): DocumentQaReport {
  return {
    artifactId,
    organizationId: '',
    generatedAt: new Date(0).toISOString(),
    anyBlocking: blocking,
    categories: [
      {
        category: 'completeness' as DocumentQaReport['categories'][number]['category'],
        score: blocking ? 40 : 100,
        findings: blocking
          ? [
              {
                findingId: 'f1',
                severity: 'high',
                message: 'Missing executive summary',
                code: 'missing_section',
              },
            ]
          : [],
        blocking,
        summary: blocking ? '1 blocking finding' : 'clean',
      },
    ],
  };
}

vi.mock('../../../server/src/services/documentStudio/documentQaService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../server/src/services/documentStudio/documentQaService.js')
  >('../../../server/src/services/documentStudio/documentQaService.js');
  return {
    ...actual,
    runDocumentQa: vi.fn((schema: DocumentSchema) => buildReport(schema.artifactId, qaBlocking)),
  };
});

import { listDocumentAuditEntries } from '../../../server/src/services/documentStudio/documentStudioService.js';
import {
  __resetApprovalServiceForTests,
  recordApprovalDecision,
} from '../../../server/src/services/documentStudio/documentApprovalService.js';

import documentStudioRoutes from '../../../server/src/routes/document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

const ORG = 'org-qa-gate';
let artifactSeq = 0;
function nextArtifact(): string {
  artifactSeq += 1;
  return `art-qa-gate-${artifactSeq}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetApprovalServiceForTests();
  qaBlocking = true;
  schemaVersion = new Date(0).toISOString();
  mockUser = { id: 'user-qa-1', organizationId: ORG, role: 'CONSULTANT' };
});

describe('M18 · GET /:artifactId/export/:format — QA gate at the route (L-03)', () => {
  it('blocking QA without override → 403 { error: "qa_blocking" } + report', async () => {
    const artifactId = nextArtifact();
    mockUser = { id: 'user-qa-1', organizationId: ORG, role: 'CONSULTANT' };

    const res = await request(createApp()).get(
      `/api/document-studio/${artifactId}/export/markdown`
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('qa_blocking');
    expect(res.body.report).toBeDefined();
    expect(res.body.report.anyBlocking).toBe(true);
  });

  it('override by UNAUTHORIZED role → 403 qa_override_unauthorized + audit qa_override_denied', async () => {
    const artifactId = nextArtifact();
    mockUser = { id: 'user-qa-2', organizationId: ORG, role: 'CONSULTANT' };

    const res = await request(createApp())
      .get(`/api/document-studio/${artifactId}/export/markdown`)
      .query({ qaOverride: 'true' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('qa_override_unauthorized');
    expect(res.body.role).toBe('CONSULTANT');

    // The unauthorized override attempt is audited independently of whether
    // QA itself would have passed (gate runs BEFORE QA).
    const audit = listDocumentAuditEntries(artifactId, ORG);
    expect(audit.some((e) => e.action === 'qa_override_denied')).toBe(true);
  });

  it('override by AUTHORIZED role (admin) bypasses the blocking gate → 200', async () => {
    const artifactId = nextArtifact();
    mockUser = { id: 'user-qa-3', organizationId: ORG, role: 'ADMIN' };

    const res = await request(createApp())
      .get(`/api/document-studio/${artifactId}/export/markdown`)
      .query({ qaOverride: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('markdown');
    // Authorized override is recorded as an override export, NOT a denial.
    const audit = listDocumentAuditEntries(artifactId, ORG);
    expect(audit.some((e) => e.action === 'qa_override_export')).toBe(true);
    expect(audit.some((e) => e.action === 'qa_override_denied')).toBe(false);
  });

  it('anti-false-green: non-blocking QA exports cleanly → 200 (gate is the cause of 403)', async () => {
    const artifactId = nextArtifact();
    qaBlocking = false;
    mockUser = { id: 'user-qa-4', organizationId: ORG, role: 'CONSULTANT' };

    const res = await request(createApp()).get(
      `/api/document-studio/${artifactId}/export/markdown`
    );

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('markdown');
  });

  it('blocks final export when approval belongs to an older document version', async () => {
    const artifactId = nextArtifact();
    qaBlocking = false;
    schemaVersion = '2026-08-09T01:00:00.000Z';

    const requested = await request(createApp())
      .post(`/api/document-studio/${artifactId}/approvals`)
      .send({ participants: [{ userId: 'reviewer-1', required: true }] });
    expect(requested.status).toBe(201);
    expect(requested.body.approval.versionId).toBe(schemaVersion);

    recordApprovalDecision({
      organizationId: ORG,
      approvalId: requested.body.approval.approvalId,
      reviewerId: 'reviewer-1',
      kind: 'approve',
    });

    schemaVersion = '2026-08-09T02:00:00.000Z';
    const staleExport = await request(createApp())
      .get(`/api/document-studio/${artifactId}/export/markdown`)
      .query({ mode: 'final' });

    expect(staleExport.status).toBe(409);
    expect(staleExport.body.code).toBe('ARTIFACT_EXPORT_BLOCKED');
    expect(staleExport.body.blocks).toContain('CURRENT_APPROVAL_REQUIRED');
  });
});
