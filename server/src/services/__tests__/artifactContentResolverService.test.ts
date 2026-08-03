import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  artifacts: new Map<string, { artifact_id: string }>(),
  origins: new Map<string, { origin_runtime: string; origin_record_id: string }>(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string, params: unknown[]) => {
    const key = `${params[1]}:${params[0]}`;
    if (sql.includes('FROM v8_output_artifacts')) return state.artifacts.get(key) || null;
    if (sql.includes('FROM v8_artifact_origin_links')) return state.origins.get(key) || null;
    return null;
  }),
}));

import {
  ARTIFACT_CONTENT_ERROR_CODES,
  clearArtifactContentAdaptersForTests,
  computeArtifactContentEtag,
  computeArtifactContentHash,
  registerArtifactContentAdapter,
  resolveArtifactContent,
} from '../artifacts/artifactContentResolverService.js';

const envelope = {
  envelopeVersion: 'artifact-content/v1' as const,
  canonicalFormat: 'markdown' as const,
  canonicalKind: 'document' as const,
  contentSchemaVersion: 'document/v1',
  contentMd: '# Canonical content',
  projection: {
    status: 'synced' as const,
    projectedAt: '2026-07-31T12:00:00.000Z',
    error: null,
    completeness: 'full' as const,
    projectedFromRevision: 'rev-1',
    projectedFromHash: null,
  },
  provenance: {
    originRuntime: 'test_runtime',
    originRecordId: 'origin-1',
    originRevision: 'rev-1',
  },
  artifactType: 'document',
  markdownProjectionStatus: 'synced' as const,
};

function seed(organizationId = 'org-a') {
  state.artifacts.set(`${organizationId}:artifact-1`, { artifact_id: 'artifact-1' });
  state.origins.set(`${organizationId}:artifact-1`, {
    origin_runtime: 'test_runtime',
    origin_record_id: 'origin-1',
  });
}

describe('artifactContentResolverService', () => {
  beforeEach(() => {
    state.artifacts.clear();
    state.origins.clear();
    clearArtifactContentAdaptersForTests();
  });

  it('dispatches the tenant-scoped primary origin to the explicit adapter', async () => {
    seed();
    const resolve = vi.fn().mockResolvedValue({ envelope, originRevision: 'rev-1' });
    registerArtifactContentAdapter('test_runtime', { resolve });

    const result = await resolveArtifactContent({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });

    expect(resolve).toHaveBeenCalledWith({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
      originRuntime: 'test_runtime',
      originRecordId: 'origin-1',
    });
    expect(result).toEqual(
      expect.objectContaining({
        artifactId: 'artifact-1',
        origin: { originRuntime: 'test_runtime', originRecordId: 'origin-1' },
        originRevision: 'rev-1',
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        etag: expect.stringMatching(/^"[a-f0-9]{64}"$/),
        envelope,
      })
    );
  });

  it('does not resolve an artifact from another tenant', async () => {
    seed('org-b');
    await expect(
      resolveArtifactContent({ artifactId: 'artifact-1', organizationId: 'org-a' })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: ARTIFACT_CONTENT_ERROR_CODES.ARTIFACT_NOT_FOUND,
    });
  });

  it('fails closed when primary origin is missing', async () => {
    state.artifacts.set('org-a:artifact-1', { artifact_id: 'artifact-1' });
    await expect(
      resolveArtifactContent({ artifactId: 'artifact-1', organizationId: 'org-a' })
    ).rejects.toMatchObject({ code: ARTIFACT_CONTENT_ERROR_CODES.ORIGIN_MISSING });
  });

  it('fails closed for an unregistered runtime', async () => {
    seed();
    await expect(
      resolveArtifactContent({ artifactId: 'artifact-1', organizationId: 'org-a' })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: ARTIFACT_CONTENT_ERROR_CODES.RUNTIME_UNSUPPORTED,
    });
  });

  it('returns stable origin-not-found when the adapter cannot read its record', async () => {
    seed();
    registerArtifactContentAdapter('test_runtime', { resolve: vi.fn().mockResolvedValue(null) });
    await expect(
      resolveArtifactContent({ artifactId: 'artifact-1', organizationId: 'org-a' })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: ARTIFACT_CONTENT_ERROR_CODES.ORIGIN_NOT_FOUND,
    });
  });

  it('rejects adapter output that does not pass the V1 runtime schema', async () => {
    seed();
    registerArtifactContentAdapter('test_runtime', {
      resolve: vi.fn().mockResolvedValue({ envelope: { contentMd: 'placeholder' } as any }),
    });
    await expect(
      resolveArtifactContent({ artifactId: 'artifact-1', organizationId: 'org-a' })
    ).rejects.toMatchObject({ code: ARTIFACT_CONTENT_ERROR_CODES.INVALID_ENVELOPE });
  });

  it('computes deterministic content hash and revision-bound ETag', () => {
    const reordered = {
      ...envelope,
      provenance: { ...envelope.provenance },
      projection: { ...envelope.projection, projectedAt: '2026-08-01T12:00:00.000Z' },
    };
    const firstHash = computeArtifactContentHash(envelope);
    const secondHash = computeArtifactContentHash(reordered);
    expect(firstHash).toBe(secondHash);
    expect(computeArtifactContentEtag({ originRevision: 'rev-1', contentHash: firstHash })).toBe(
      computeArtifactContentEtag({ originRevision: 'rev-1', contentHash: secondHash })
    );
    expect(
      computeArtifactContentEtag({ originRevision: 'rev-2', contentHash: firstHash })
    ).not.toBe(computeArtifactContentEtag({ originRevision: 'rev-1', contentHash: firstHash }));
  });
});
