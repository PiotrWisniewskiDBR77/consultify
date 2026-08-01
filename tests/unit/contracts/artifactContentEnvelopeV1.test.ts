import { describe, expect, it } from 'vitest';

import type { ArtifactContentEnvelopeV1 as ClientEnvelope } from '../../../src/types/artifactContent';
import {
  ArtifactContentEnvelopeV1Schema,
  normalizeArtifactContentEnvelope,
  serializeArtifactContentEnvelope,
  type ArtifactContentEnvelopeV1 as ServerEnvelope,
} from '../../../server/src/types/artifactContent';
import { createArtifactContentEnvelope } from '../../../server/src/services/artifacts/contentProjectionService';

type Assert<T extends true> = T;
type IsMutuallyAssignable<L, R> = L extends R ? (R extends L ? true : false) : false;
type EnvelopeParity = Assert<IsMutuallyAssignable<ClientEnvelope, ServerEnvelope>>;
const envelopeParity: EnvelopeParity = true;

const fullV1: ServerEnvelope = {
  envelopeVersion: 'artifact-content/v1',
  canonicalFormat: 'json',
  canonicalKind: 'sheet',
  contentSchemaVersion: 'sheet/v3',
  contentMd: '| KPI |\n|---|\n| Revenue |',
  contentJson: { rows: [{ KPI: 'Revenue' }] },
  blocks: [{ id: 'block-1' }],
  projection: {
    status: 'synced',
    projectedAt: '2026-07-31T12:00:00.000Z',
    error: null,
    completeness: 'full',
    projectedFromRevision: 'rev-7',
    projectedFromHash: null,
  },
  provenance: {
    originRuntime: 'sheet',
    originRecordId: 'table-1',
    originRevision: 'rev-7',
  },
  artifactType: 'sheet',
  markdownProjectionStatus: 'synced',
  markdownProjectedAt: '2026-07-31T12:00:00.000Z',
  projectionError: null,
};

describe('Artifact Content Envelope V1 contract', () => {
  it('keeps frontend and backend V1 types mutually assignable', () => {
    expect(envelopeParity).toBe(true);
  });

  it('validates and serializes V1 without losing fields', () => {
    expect(serializeArtifactContentEnvelope(fullV1)).toEqual(fullV1);
    expect(ArtifactContentEnvelopeV1Schema.parse(fullV1)).toEqual(fullV1);
  });

  it('normalizes legacy payload deterministically to legacy/v0 with aliases', () => {
    const legacy = {
      canonicalFormat: 'markdown',
      artifactType: 'report',
      contentMd: '# Legacy report',
      markdownProjectionStatus: 'synced',
      markdownProjectedAt: '2026-07-30T10:00:00.000Z',
    };
    const first = normalizeArtifactContentEnvelope(legacy);
    const second = normalizeArtifactContentEnvelope(legacy);
    expect(first).toEqual(second);
    expect(first).toEqual(
      expect.objectContaining({
        envelopeVersion: 'artifact-content/v1',
        canonicalKind: 'document',
        contentSchemaVersion: 'legacy/v0',
        contentMd: '# Legacy report',
        markdownProjectionStatus: 'synced',
      }),
    );
    expect(first.projection.projectedAt).toBe('2026-07-30T10:00:00.000Z');
  });

  it('marks empty Markdown missing even when a legacy alias claims synced', () => {
    const normalized = normalizeArtifactContentEnvelope({
      canonicalFormat: 'markdown',
      artifactType: 'document',
      contentMd: '   ',
      markdownProjectionStatus: 'synced',
    });
    expect(normalized.projection.status).toBe('missing');
    expect(normalized.markdownProjectionStatus).toBe('missing');
  });

  it('marks JSON Markdown stale without a matching revision or hash', () => {
    const normalized = normalizeArtifactContentEnvelope({
      canonicalFormat: 'json',
      artifactType: 'sheet',
      contentJson: { rows: [] },
      contentMd: '# Projection',
      markdownProjectionStatus: 'synced',
    });
    expect(normalized.projection.status).toBe('stale');
  });

  it('preserves an explicit failed projection with a stable error', () => {
    const normalized = normalizeArtifactContentEnvelope({
      canonicalFormat: 'markdown',
      artifactType: 'document',
      contentMd: '# Partial projection',
      markdownProjectionStatus: 'failed',
      projectionError: 'Renderer unavailable',
    });
    expect(normalized.projection).toEqual(
      expect.objectContaining({ status: 'failed', error: 'Renderer unavailable' }),
    );
    expect(normalized.projectionError).toBe('Renderer unavailable');
  });

  it.each(['document', 'presentation', 'sheet', 'canvas', 'unknown'] as const)(
    'validates canonical kind %s at the runtime boundary',
    (canonicalKind) => {
      const parsed = ArtifactContentEnvelopeV1Schema.parse({
        ...fullV1,
        canonicalKind,
      });
      expect(parsed.canonicalKind).toBe(canonicalKind);
    },
  );

  it.each(['markdown', 'json'] as const)(
    'validates canonical format %s at the runtime boundary',
    (canonicalFormat) => {
      const parsed = ArtifactContentEnvelopeV1Schema.parse({
        ...fullV1,
        canonicalFormat,
      });
      expect(parsed.canonicalFormat).toBe(canonicalFormat);
    },
  );

  it.each([
    [{ originRevision: 'rev-2' }, { projectedFromRevision: 'rev-2' }],
    [{ originHash: 'sha256:abc' }, { projectedFromHash: 'sha256:abc' }],
  ])('allows JSON projection sync with matching revision/hash', (provenance, projection) => {
    const normalized = normalizeArtifactContentEnvelope({
      canonicalFormat: 'json',
      canonicalKind: 'sheet',
      contentSchemaVersion: 'sheet/v1',
      contentJson: { rows: [] },
      contentMd: '# Projection',
      provenance,
      projection: { status: 'synced', ...projection },
    });
    expect(normalized.projection.status).toBe('synced');
  });

  it.each([
    ['Complete projection', 'full'],
    ['Projection truncated to first 50 rows.', 'truncated'],
  ] as const)('derives %s completeness as %s', (contentMd, completeness) => {
    expect(normalizeArtifactContentEnvelope({ contentMd }).projection.completeness).toBe(completeness);
  });

  it('routes projection creation through the V1 runtime contract', () => {
    const envelope = createArtifactContentEnvelope({
      artifactType: 'table',
      canonicalFormat: 'json',
      contentJson: { rows: [{ KPI: 'Revenue' }] },
    });
    expect(ArtifactContentEnvelopeV1Schema.parse(envelope)).toEqual(envelope);
    expect(envelope.envelopeVersion).toBe('artifact-content/v1');
    expect(envelope.contentSchemaVersion).toBe('legacy/v0');
    expect(envelope.projection.status).toBe('stale');
  });
});
