/**
 * M18 Document Studio — Cross-org IDOR regression suite.
 *
 * Locks in the tenant-isolation invariant across the governance surfaces
 * that carry a server-generated id in the URL path: a caller authenticated
 * to org A must NEVER be able to read, mutate, or audit a resource created
 * by org B by guessing / replaying its id. The expected outcome is always
 * a 404 (deny-by-default, no existence leak) or — for list endpoints — an
 * empty result that excludes the foreign-tenant row.
 *
 * Mirrors the harness in `cross-org-idor.test.ts` (parent wave-5/6 suite)
 * and `document-studio-share-links.routes.test.ts`:
 *   - `verifyToken` is mocked so `mockUser` drives `(userId, organizationId)`.
 *   - Resources are created via the real HTTP routes as org B, then the
 *     same app instance is re-targeted to org A and the foreign id is
 *     replayed. Because the services key their in-process registries by a
 *     composite `${organizationId}::${id}` (or assert `row.organizationId`
 *     explicitly), the org A request must not resolve org B's row.
 *
 * Surfaces covered (every artifact-/id-scoped read+mutate+audit family):
 *   - Source packs           GET/audit/items/ready/archive/attach
 *   - Brand-voice profiles    GET/PATCH/activate/archive/audit
 *   - Audience profiles       GET/PATCH/activate/archive/audit
 *   - Content blocks          GET/PATCH/activate/archive/audit
 *   - Approvals               GET/decisions/cancel/audit
 *   - Comments                GET/reply/resolve/reopen/delete
 *   - Snapshots               GET (by versionId)
 *   - Templates               GET/approve/deprecate/audit
 *   - Share links             GET/revoke/rotate/audit (already covered in
 *                             the sibling suite; a thin smoke kept here so
 *                             the whole id-bearing surface lives in one file)
 *   - Assets                  GET/archive/audit
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();

const ARTIFACT_B = 'artifact-owned-by-B';
const ORG_B = 'org-victim-B';

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
}));

// Source-pack lifecycle writes now use the atomic persistence path, which
// selects the sequential DbPromise seam only when Database reports a mock.
// Without this explicit adapter the route-only IDOR harness accidentally opens
// the real PostgreSQL pool and draft creation fails before tenant isolation is
// exercised.
vi.mock('../../database/Database.js', () => ({
  getDatabaseAsync: vi.fn(async () => ({ isMock: true })),
}));

// Approval creation is intentionally fail-closed unless the requested document
// exists in the caller's tenant. Provide one real-shaped victim document while
// keeping every other artifact/org lookup absent, so this suite exercises IDOR
// isolation instead of bypassing the document-existence invariant.
vi.mock('../../services/wave5ArtifactRuntimeService.js', () => ({
  getWave5Artifact: vi.fn((artifactId: string, organizationId: string) =>
    Promise.resolve(
      artifactId === ARTIFACT_B && organizationId === ORG_B
        ? {
            artifact_id: ARTIFACT_B,
            organization_id: ORG_B,
            title: 'Victim document',
            content: 'Victim-owned content',
            metadata_json: {
              documentStudioSchema: {
                documentId: `doc-${ARTIFACT_B}`,
                artifactId: ARTIFACT_B,
                title: 'Victim document',
                documentType: 'report',
                language: 'en',
                audience: ['internal'],
                goal: 'inform',
                communicationRegister: 'formal',
                density: 'standard',
                languageStyle: 'plain',
                confidentiality: 'internal',
                formattingSchema: {},
                sections: [],
                sourceRefs: [],
                createdAt: '2026-08-14T00:00:00.000Z',
                updatedAt: '2026-08-14T00:00:00.000Z',
              },
            },
          }
        : null
    )
  ),
  buildWave5ExportManifest: vi.fn(() => Promise.resolve({})),
  createWave5Artifact: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

import { __resetApprovalServiceForTests } from '../../services/documentStudio/documentApprovalService.js';
import { __resetAssetRegistryForTests } from '../../services/documentStudio/documentAssetRegistryService.js';
import { __resetAudienceProfileServiceForTests } from '../../services/documentStudio/documentAudienceProfileService.js';
import { __resetBrandVoiceServiceForTests } from '../../services/documentStudio/documentBrandVoiceService.js';
import { __resetDocumentCommentsForTests } from '../../services/documentStudio/documentCommentsService.js';
import { __resetContentBlockServiceForTests } from '../../services/documentStudio/documentContentBlockService.js';
import { __resetShareLinkRegistryForTests } from '../../services/documentStudio/documentShareLinkService.js';
import { __resetSourcePackRegistryForTests } from '../../services/documentStudio/documentSourcePackService.js';
import { __resetTemplateRegistryForTests } from '../../services/documentStudio/documentTemplateService.js';

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
    }
    next();
  },
}));

// requireOrgAccess() is a no-op pass-through in this harness — the mocked
// verifyToken already stamps the tenant, and the IDOR defense under test
// lives in the per-service org-scoped lookups, not in this guard.
vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

import documentStudioRoutes from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

const UID_B = 'user-B';
const ORG_A = 'org-attacker-A';
const UID_A = 'user-A';

/** Authenticate the next request as the victim tenant (creator). */
function asVictim(role = 'OWNER'): void {
  mockUser = { id: UID_B, organizationId: ORG_B, role };
}
/** Authenticate the next request as the attacker tenant (foreign). */
function asAttacker(role = 'OWNER'): void {
  mockUser = { id: UID_A, organizationId: ORG_A, role };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbAll.mockResolvedValue([]);
  mockDbRun.mockResolvedValue({ rowCount: 0, success: true });
  mockDbGet.mockResolvedValue(null);
  __resetSourcePackRegistryForTests();
  __resetBrandVoiceServiceForTests();
  __resetAudienceProfileServiceForTests();
  __resetContentBlockServiceForTests();
  __resetApprovalServiceForTests();
  __resetDocumentCommentsForTests();
  __resetTemplateRegistryForTests();
  __resetAssetRegistryForTests();
  void __resetShareLinkRegistryForTests();
});

// =============================================================================
// Source packs
// =============================================================================
describe('Source packs — cross-org IDOR', () => {
  async function createPackAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post('/api/document-studio/source-packs')
      .send({ name: 'Victim pack', language: 'en' });
    expect(res.status).toBe(201);
    return res.body.pack.packId as string;
  }

  it('GET /source-packs/:packId is 404 for a foreign tenant', async () => {
    const app = createApp();
    const packId = await createPackAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/source-packs/${packId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('source_pack_not_found');
  });

  it('GET /source-packs/:packId/audit is 404 for a foreign tenant', async () => {
    const app = createApp();
    const packId = await createPackAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/source-packs/${packId}/audit`);
    expect(res.status).toBe(404);
  });

  it('POST /source-packs/:packId/ready is a no-op 404 for a foreign tenant', async () => {
    const app = createApp();
    const packId = await createPackAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/source-packs/${packId}/ready`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('POST /source-packs/:packId/archive is a no-op 404 for a foreign tenant', async () => {
    const app = createApp();
    const packId = await createPackAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/source-packs/${packId}/archive`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('GET /source-packs does not leak the victim pack to the attacker', async () => {
    const app = createApp();
    await createPackAsVictim(app);
    asAttacker();
    const res = await request(app).get('/api/document-studio/source-packs');
    expect(res.status).toBe(200);
    expect(res.body.packs).toHaveLength(0);
  });
});

// =============================================================================
// Brand-voice profiles
// =============================================================================
describe('Brand-voice profiles — cross-org IDOR', () => {
  async function createProfileAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post('/api/document-studio/brand-voice/profiles')
      .send({ name: 'Victim voice' });
    expect(res.status).toBe(201);
    return res.body.profile.profileId as string;
  }

  it('GET profile is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/brand-voice/profiles/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('profile_not_found');
  });

  it('PATCH profile is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app)
      .patch(`/api/document-studio/brand-voice/profiles/${id}`)
      .send({ name: 'hijacked' });
    expect(res.status).toBe(404);
  });

  it('activate is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/brand-voice/profiles/${id}/activate`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('archive is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/brand-voice/profiles/${id}/archive`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('audit returns empty for a foreign tenant (no leak)', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/brand-voice/profiles/${id}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.auditEntries).toHaveLength(0);
  });
});

// =============================================================================
// Audience profiles
// =============================================================================
describe('Audience profiles — cross-org IDOR', () => {
  async function createProfileAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post('/api/document-studio/audience-profiles')
      .send({ name: 'Victim audience' });
    expect(res.status).toBe(201);
    return res.body.profile.profileId as string;
  }

  it('GET profile is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/audience-profiles/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('profile_not_found');
  });

  it('PATCH profile is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app)
      .patch(`/api/document-studio/audience-profiles/${id}`)
      .send({ name: 'hijacked' });
    expect(res.status).toBe(404);
  });

  it('archive is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createProfileAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/audience-profiles/${id}/archive`)
      .send({});
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Content blocks
// =============================================================================
describe('Content blocks — cross-org IDOR', () => {
  async function createBlockAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post('/api/document-studio/content-blocks')
      .send({ name: 'Victim block', block: { type: 'paragraph', text: 'secret' } });
    expect(res.status).toBe(201);
    return res.body.contentBlock.contentBlockId as string;
  }

  it('GET block is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createBlockAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/content-blocks/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('content_block_not_found');
  });

  it('PATCH block is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createBlockAsVictim(app);
    asAttacker();
    const res = await request(app)
      .patch(`/api/document-studio/content-blocks/${id}`)
      .send({ name: 'hijacked' });
    expect(res.status).toBe(404);
  });

  it('archive is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createBlockAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/content-blocks/${id}/archive`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('GET /content-blocks does not leak the victim block to the attacker', async () => {
    const app = createApp();
    await createBlockAsVictim(app);
    asAttacker();
    const res = await request(app).get('/api/document-studio/content-blocks');
    expect(res.status).toBe(200);
    expect(res.body.contentBlocks).toHaveLength(0);
  });
});

// =============================================================================
// Approvals
// =============================================================================
describe('Approvals — cross-org IDOR', () => {
  async function createApprovalAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post(`/api/document-studio/${ARTIFACT_B}/approvals`)
      .send({ participants: [{ userId: 'reviewer-1' }], quorumPolicy: 'single_approval' });
    expect(res.status).toBe(201);
    return res.body.approval.approvalId as string;
  }

  it('GET approval is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createApprovalAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/${ARTIFACT_B}/approvals/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('approval_not_found');
  });

  it('record decision is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createApprovalAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/${ARTIFACT_B}/approvals/${id}/decisions`)
      .send({ kind: 'approve' });
    expect(res.status).toBe(404);
  });

  it('cancel is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createApprovalAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/${ARTIFACT_B}/approvals/${id}/cancel`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('GET /:artifactId/approvals does not leak the victim approval to the attacker', async () => {
    const app = createApp();
    await createApprovalAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/${ARTIFACT_B}/approvals`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('document_not_found');
  });
});

// =============================================================================
// Comments
// =============================================================================
describe('Comments — cross-org IDOR', () => {
  async function createCommentAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post(`/api/document-studio/${ARTIFACT_B}/comments`)
      .send({ body: 'victim note', anchor: { kind: 'document' } });
    expect(res.status).toBe(201);
    return res.body.comment.commentId as string;
  }

  it('GET comment is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createCommentAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/${ARTIFACT_B}/comments/${id}`);
    expect(res.status).toBe(404);
  });

  it('reply is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createCommentAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/${ARTIFACT_B}/comments/${id}/reply`)
      .send({ body: 'hijack reply' });
    expect(res.status).toBe(404);
  });

  it('resolve is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createCommentAsVictim(app);
    asAttacker();
    const res = await request(app)
      .post(`/api/document-studio/${ARTIFACT_B}/comments/${id}/resolve`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('delete is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createCommentAsVictim(app);
    asAttacker();
    const res = await request(app).delete(`/api/document-studio/${ARTIFACT_B}/comments/${id}`);
    expect(res.status).toBe(404);
  });

  it('GET /:artifactId/comments does not leak the victim comment to the attacker', async () => {
    const app = createApp();
    await createCommentAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/${ARTIFACT_B}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(0);
  });
});

// =============================================================================
// Templates
// =============================================================================
describe('Templates — cross-org IDOR', () => {
  async function createTemplateAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post('/api/document-studio/templates/plan')
      .send({ input: { purpose: 'Victim template', documentType: 'executive_memo' } });
    expect(res.status).toBe(200);
    return res.body.template.templateId as string;
  }

  it('GET template is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createTemplateAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/templates/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('template_not_found');
  });

  it('approve is 404 for a foreign tenant (privileged, role present)', async () => {
    const app = createApp();
    const id = await createTemplateAsVictim(app);
    asAttacker('OWNER');
    const res = await request(app).post(`/api/document-studio/templates/${id}/approve`).send({});
    expect(res.status).toBe(404);
  });

  it('approve is 403 for a non-privileged role regardless of tenant', async () => {
    const app = createApp();
    const id = await createTemplateAsVictim(app);
    // Same-tenant member without admin/owner/superadmin must still be denied.
    mockUser = { id: 'member-B', organizationId: ORG_B, role: 'MEMBER' };
    const res = await request(app).post(`/api/document-studio/templates/${id}/approve`).send({});
    expect(res.status).toBe(403);
  });

  it('deprecate is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createTemplateAsVictim(app);
    asAttacker('OWNER');
    const res = await request(app).post(`/api/document-studio/templates/${id}/deprecate`).send({});
    expect(res.status).toBe(404);
  });

  it('GET /templates does not leak the victim template to the attacker', async () => {
    const app = createApp();
    const victimId = await createTemplateAsVictim(app);
    asAttacker();
    const res = await request(app).get('/api/document-studio/templates');
    expect(res.status).toBe(200);
    // System-seed templates are a shared read-only catalogue visible to
    // every tenant; the org-private victim template must NOT be among them.
    const ids = (res.body.templates as Array<{ templateId: string }>).map((t) => t.templateId);
    expect(ids).not.toContain(victimId);
  });

  describe('restore-as-draft', () => {
    async function approveAsVictimAndGetAuditId(
      app: Express,
      templateId: string
    ): Promise<string> {
      asVictim();
      const approveRes = await request(app)
        .post(`/api/document-studio/templates/${templateId}/approve`)
        .send({});
      expect(approveRes.status).toBe(200);
      const auditRes = await request(app).get(
        `/api/document-studio/templates/${templateId}/audit`
      );
      expect(auditRes.status).toBe(200);
      const approvedEntry = (
        auditRes.body.auditEntries as Array<{ auditId: string; action: string }>
      ).find((entry) => entry.action === 'template_approved');
      expect(approvedEntry).toBeDefined();
      return approvedEntry!.auditId;
    }

    it('is 404 for a foreign tenant (no existence leak)', async () => {
      const app = createApp();
      const id = await createTemplateAsVictim(app);
      const auditId = await approveAsVictimAndGetAuditId(app, id);
      asAttacker();
      const res = await request(app).post(
        `/api/document-studio/templates/${id}/audit/${auditId}/restore-as-draft`
      );
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('template_not_found');
    });

    it('is 404 for a non-existent audit id', async () => {
      const app = createApp();
      const id = await createTemplateAsVictim(app);
      asVictim();
      const res = await request(app).post(
        `/api/document-studio/templates/${id}/audit/not-a-real-audit-id/restore-as-draft`
      );
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('template_audit_not_found');
    });

    it('restores an approved snapshot as an independent draft without mutating the source', async () => {
      const app = createApp();
      const id = await createTemplateAsVictim(app);
      const auditId = await approveAsVictimAndGetAuditId(app, id);
      asVictim();
      const restoreRes = await request(app).post(
        `/api/document-studio/templates/${id}/audit/${auditId}/restore-as-draft`
      );
      expect(restoreRes.status).toBe(201);
      expect(restoreRes.body.template.templateId).not.toBe(id);
      expect(restoreRes.body.template.status).toBe('draft');

      const sourceRes = await request(app).get(`/api/document-studio/templates/${id}`);
      expect(sourceRes.status).toBe(200);
      expect(sourceRes.body.template.status).toBe('approved');
    });
  });
});

// =============================================================================
// Assets (logo)
// =============================================================================
describe('Assets — cross-org IDOR', () => {
  // PNG magic-byte header + padding to clear the ≥100-byte sanity floor
  // enforced by `documentAssetRegistryService.decodeBase64Safely`.
  const PNG_BASE64 =
    'iVBORw0KGgoBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ==';

  async function createLogoAsVictim(app: Express): Promise<string> {
    asVictim();
    const res = await request(app)
      .post('/api/document-studio/assets/logo')
      .send({ mimeType: 'image/png', dataBase64: PNG_BASE64, filename: 'victim.png' });
    expect(res.status).toBe(201);
    return res.body.asset.assetId as string;
  }

  it('GET asset is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createLogoAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/assets/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('asset_not_found');
  });

  it('archive is 404 for a foreign tenant', async () => {
    const app = createApp();
    const id = await createLogoAsVictim(app);
    asAttacker();
    const res = await request(app).post(`/api/document-studio/assets/${id}/archive`).send({});
    expect(res.status).toBe(404);
  });

  it('GET /assets/:assetId/audit is 404 for a foreign tenant (no audit leak)', async () => {
    const app = createApp();
    const id = await createLogoAsVictim(app);
    asAttacker();
    const res = await request(app).get(`/api/document-studio/assets/${id}/audit`);
    expect(res.status).toBe(404);
  });

  it('GET /assets/logo/active does not surface the victim logo to the attacker', async () => {
    const app = createApp();
    await createLogoAsVictim(app);
    asAttacker();
    const res = await request(app).get('/api/document-studio/assets/logo/active');
    expect(res.status).toBe(404);
  });
});
