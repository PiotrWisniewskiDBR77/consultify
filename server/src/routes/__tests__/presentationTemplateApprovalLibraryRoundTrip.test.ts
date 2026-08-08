/** @vitest-environment node */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actor = { id: 'owner-1', organizationId: 'org-1', role: 'OWNER' };
const template = {
  id: 'ppt-template-1',
  organization_id: actor.organizationId,
  name: 'Board Portfolio Update — E2E-20260806',
  description: 'Eight-slide board template',
  deck_type: 'board decision deck',
  outline_json: JSON.stringify({
    outline: Array.from({ length: 8 }, (_, i) => ({ title: `Slide ${i + 1}` })),
  }),
  is_system: false,
  is_active: true,
  created_by: actor.id,
  created_at: '2026-08-06T12:00:00.000Z',
  updated_at: '2026-08-06T12:00:00.000Z',
};

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = actor.id;
    req.userRole = actor.role;
    req.organizationId = actor.organizationId;
    req.user = actor;
    next();
  },
}));
vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: any, next: () => void) => {
    req.emitAuditEvent = async () => undefined;
    next();
  },
}));
vi.mock('../../services/presentationAccessPolicyService.js', () => ({
  hasPresentationCapability: () => true,
}));
vi.mock('../../services/presentationTemplateGovernanceService.js', () => ({
  applyLifecycleTransition: vi.fn(async (input: any) => ({
    status: 'ok',
    record: { lifecycleState: input.targetState },
  })),
  assertEditableLifecycle: vi.fn(),
  computeLineageForClone: vi.fn(),
  deprecateTemplate: vi.fn(),
  fetchLineageChain: vi.fn(),
  listGovernanceEvents: vi.fn(),
  listTemplatesByState: vi.fn(),
  recordGovernanceEvent: vi.fn(),
}));
vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string) => (sql.includes('presentation_templates') ? template : null)),
  all: vi.fn(async () => []),
  run: vi.fn(async () => ({ changes: 1 })),
}));

const artifacts: any[] = [];
vi.mock('../../services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn(async (params: any) => {
    const row = {
      artifactId: 'artifact-ppt-template-1',
      ...params,
      resolvedTitle: params.titleSnapshot,
      isDraft: params.deliveryState === 'draft',
      createdAt: '2026-08-06T12:00:00.000Z',
    };
    artifacts.splice(0, artifacts.length, row);
    return row;
  }),
  listArtifactsForUser: vi.fn(async (params: any) =>
    artifacts.filter((row) => {
      if (row.organizationId !== params.organizationId) return false;
      if (params.filters?.artifactFamily && row.artifactFamily !== params.filters.artifactFamily)
        return false;
      if (params.filters?.outputType && row.outputType !== params.filters.outputType) return false;
      return params.filters?.drafts === 'include' || !row.isDraft;
    })
  ),
  listMyWorkArtifacts: vi.fn(async () => ({ mine: [], review: [], recent: [] })),
  getArtifactByOrigin: vi.fn(async () => null),
}));

vi.mock('../../services/wave5ArtifactRuntimeService.js', () => ({
  WAVE5_ARTIFACT_TYPES: [],
  WAVE5_ARTIFACT_LIFECYCLE: [],
  approveAndCommitWave5Mutation: vi.fn(),
  approveWave5Mutation: vi.fn(),
  buildWave5ExportManifest: vi.fn(),
  commitWave5Mutation: vi.fn(),
  createWave5Artifact: vi.fn(),
  fillWave5DocumentTemplate: vi.fn(),
  generateWave5StructuredArtifact: vi.fn(),
  getWave5Artifact: vi.fn(),
  listWave5Artifacts: vi.fn(),
  listWave5ArtifactVersions: vi.fn(),
  listWave5Mutations: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
  proposeWave5Mutation: vi.fn(),
  rejectWave5Mutation: vi.fn(),
}));

import artifactRoutes from '../artifacts.routes.js';
import presentationRoutes from '../presentations.routes.js';

function app(): Express {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/presentations', presentationRoutes);
  instance.use('/api/artifacts', artifactRoutes);
  return instance;
}

beforeEach(() => artifacts.splice(0));

describe('presentation template governance -> canonical Template Library query', () => {
  it('indexes an approved template in the default and draft-inclusive Library', async () => {
    const instance = app();
    const approve = await request(instance)
      .post(`/api/presentations/templates/${template.id}/governance/transition`)
      .send({ targetState: 'approved' });
    expect(approve.status).toBe(200);

    const defaultList = await request(instance).get(
      '/api/artifacts?artifactFamily=template&outputType=presentation'
    );
    expect(defaultList.status).toBe(200);
    expect(defaultList.body.data).toHaveLength(1);

    const libraryList = await request(instance).get(
      '/api/artifacts?artifactFamily=template&outputType=presentation&include=drafts'
    );
    expect(libraryList.status).toBe(200);
    expect(libraryList.body.data).toHaveLength(1);
    expect(libraryList.body.data[0]).toMatchObject({
      artifactFamily: 'template',
      outputType: 'presentation',
      originRuntime: 'presentation_template',
      originRecordId: template.id,
      titleSnapshot: template.name,
      originSummary: {
        template: {
          canonicalTemplateId: template.id,
          status: 'published',
          scope: 'organization',
          structureBlueprint: { outline: expect.any(Array) },
        },
      },
    });
    expect(libraryList.body.data[0].originSummary.template.structureBlueprint.outline).toHaveLength(
      8
    );
  });

  it('removes a template moved back to draft from the default Library', async () => {
    const instance = app();
    const approve = await request(instance)
      .post(`/api/presentations/templates/${template.id}/governance/transition`)
      .send({ targetState: 'approved' });
    expect(approve.status).toBe(200);

    const moveToDraft = await request(instance)
      .post(`/api/presentations/templates/${template.id}/governance/transition`)
      .send({ targetState: 'draft' });
    expect(moveToDraft.status).toBe(200);

    const defaultList = await request(instance).get(
      '/api/artifacts?artifactFamily=template&outputType=presentation'
    );
    expect(defaultList.status).toBe(200);
    expect(defaultList.body.data).toHaveLength(0);

    const draftList = await request(instance).get(
      '/api/artifacts?artifactFamily=template&outputType=presentation&include=drafts'
    );
    expect(draftList.status).toBe(200);
    expect(draftList.body.data).toHaveLength(1);
    expect(draftList.body.data[0]).toMatchObject({
      deliveryState: 'draft',
      visibilityScope: 'private',
      originSummary: { template: { status: 'draft' } },
    });
  });
});
