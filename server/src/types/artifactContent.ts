import { z } from 'zod';

export const ArtifactContentEnvelopeVersion = 'artifact-content/v1' as const;
export const ArtifactCanonicalFormatValues = ['markdown', 'json'] as const;
export const ArtifactCanonicalKindValues = [
  'document',
  'presentation',
  'sheet',
  'canvas',
  'unknown',
] as const;
export const ArtifactProjectionStatusValues = ['synced', 'stale', 'failed', 'missing'] as const;
export const ArtifactProjectionCompletenessValues = ['full', 'truncated'] as const;

export type ArtifactCanonicalFormat = (typeof ArtifactCanonicalFormatValues)[number];
export type ArtifactCanonicalKind = (typeof ArtifactCanonicalKindValues)[number];
export type ArtifactProjectionStatus = (typeof ArtifactProjectionStatusValues)[number];
export type ArtifactProjectionCompleteness = (typeof ArtifactProjectionCompletenessValues)[number];

export const ArtifactContentProjectionV1Schema = z.object({
  status: z.enum(ArtifactProjectionStatusValues),
  projectedAt: z.string().min(1).nullable(),
  error: z.string().min(1).nullable(),
  completeness: z.enum(ArtifactProjectionCompletenessValues),
  projectedFromRevision: z.string().min(1).nullable(),
  projectedFromHash: z.string().min(1).nullable(),
});

export const ArtifactContentProvenanceV1Schema = z.object({
  originRuntime: z.string().min(1).nullable(),
  originRecordId: z.string().min(1).nullable(),
  originRevision: z.string().min(1).nullable(),
  originHash: z.string().min(1).nullable().optional(),
});

export const ArtifactContentEnvelopeV1Schema = z.object({
  envelopeVersion: z.literal(ArtifactContentEnvelopeVersion),
  canonicalFormat: z.enum(ArtifactCanonicalFormatValues),
  canonicalKind: z.enum(ArtifactCanonicalKindValues),
  contentSchemaVersion: z.string().min(1),
  contentMd: z.string(),
  contentJson: z.unknown().optional(),
  blocks: z.array(z.unknown()).optional(),
  projection: ArtifactContentProjectionV1Schema,
  provenance: ArtifactContentProvenanceV1Schema,
  // Migration aliases. They mirror V1 fields and remain readable by old clients.
  artifactType: z.string().min(1),
  markdownProjectionStatus: z.enum(ArtifactProjectionStatusValues),
  markdownProjectedAt: z.string().nullable().optional(),
  projectionError: z.string().nullable().optional(),
});

export type ArtifactContentEnvelopeV1 = z.infer<typeof ArtifactContentEnvelopeV1Schema>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function inferCanonicalKind(value: unknown): ArtifactCanonicalKind {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('presentation') || normalized.includes('deck')) return 'presentation';
  if (
    normalized.includes('sheet') ||
    normalized.includes('table') ||
    normalized.includes('workbook')
  ) {
    return 'sheet';
  }
  if (normalized.includes('canvas') || normalized.includes('whiteboard')) return 'canvas';
  if (
    normalized.includes('document') ||
    normalized.includes('report') ||
    normalized.includes('markdown')
  ) {
    return 'document';
  }
  return 'unknown';
}

function normalizeCompleteness(value: unknown, contentMd: string): ArtifactProjectionCompleteness {
  if (value === 'truncated') return 'truncated';
  return /projection truncated|\btruncated\b/i.test(contentMd) ? 'truncated' : 'full';
}

export function normalizeArtifactContentEnvelope(input: unknown): ArtifactContentEnvelopeV1 {
  const source = record(input);
  const projectionSource = record(source.projection);
  const provenanceSource = record(source.provenance);
  const contentMd = typeof source.contentMd === 'string' ? source.contentMd : '';
  const canonicalFormat: ArtifactCanonicalFormat =
    source.canonicalFormat === 'json' || source.contentJson !== undefined ? 'json' : 'markdown';
  const canonicalKind = ArtifactCanonicalKindValues.includes(
    source.canonicalKind as ArtifactCanonicalKind
  )
    ? (source.canonicalKind as ArtifactCanonicalKind)
    : inferCanonicalKind(source.artifactType);

  const originRevision = optionalString(provenanceSource.originRevision ?? source.originRevision);
  const originHash = optionalString(provenanceSource.originHash ?? source.originHash);
  const projectedFromRevision = optionalString(
    projectionSource.projectedFromRevision ?? source.projectedFromRevision
  );
  const projectedFromHash = optionalString(
    projectionSource.projectedFromHash ?? source.projectedFromHash
  );
  const revisionMatches = Boolean(originRevision && projectedFromRevision === originRevision);
  const hashMatches = Boolean(originHash && projectedFromHash === originHash);
  const requestedStatus = projectionSource.status ?? source.markdownProjectionStatus;

  let status: ArtifactProjectionStatus;
  if (!contentMd.trim()) {
    status = 'missing';
  } else if (requestedStatus === 'failed') {
    status = 'failed';
  } else if (canonicalFormat === 'json' && !revisionMatches && !hashMatches) {
    status = 'stale';
  } else {
    status = 'synced';
  }

  const projectedAt = optionalString(projectionSource.projectedAt ?? source.markdownProjectedAt);
  const error =
    status === 'failed'
      ? optionalString(projectionSource.error ?? source.projectionError) || 'Projection failed'
      : null;
  const completeness = normalizeCompleteness(projectionSource.completeness, contentMd);
  const artifactType = optionalString(source.artifactType) || canonicalKind;

  return ArtifactContentEnvelopeV1Schema.parse({
    envelopeVersion: ArtifactContentEnvelopeVersion,
    canonicalFormat,
    canonicalKind,
    contentSchemaVersion: optionalString(source.contentSchemaVersion) || 'legacy/v0',
    contentMd,
    ...(source.contentJson !== undefined ? { contentJson: source.contentJson } : {}),
    ...(Array.isArray(source.blocks) ? { blocks: source.blocks } : {}),
    projection: {
      status,
      projectedAt,
      error,
      completeness,
      projectedFromRevision,
      projectedFromHash,
    },
    provenance: {
      originRuntime: optionalString(provenanceSource.originRuntime ?? source.originRuntime),
      originRecordId: optionalString(provenanceSource.originRecordId ?? source.originRecordId),
      originRevision,
      ...(originHash ? { originHash } : {}),
    },
    artifactType,
    markdownProjectionStatus: status,
    markdownProjectedAt: projectedAt,
    projectionError: error,
  });
}

export function serializeArtifactContentEnvelope(
  envelope: ArtifactContentEnvelopeV1
): ArtifactContentEnvelopeV1 {
  return ArtifactContentEnvelopeV1Schema.parse(envelope);
}
