export const ARTIFACT_CONTENT_ENVELOPE_VERSION = 'artifact-content/v1' as const;
export const CANONICAL_FORMATS = ['markdown', 'json'] as const;
export const CANONICAL_KINDS = ['document', 'presentation', 'sheet', 'canvas', 'unknown'] as const;
export const MARKDOWN_PROJECTION_STATUSES = ['synced', 'stale', 'failed', 'missing'] as const;
export const PROJECTION_COMPLETENESS_VALUES = ['full', 'truncated'] as const;

export type CanonicalFormat = (typeof CANONICAL_FORMATS)[number];
export type ArtifactCanonicalKind = (typeof CANONICAL_KINDS)[number];
export type MarkdownProjectionStatus = (typeof MARKDOWN_PROJECTION_STATUSES)[number];
export type ArtifactProjectionCompleteness = (typeof PROJECTION_COMPLETENESS_VALUES)[number];

export interface ArtifactContentEnvelopeV1 {
  envelopeVersion: typeof ARTIFACT_CONTENT_ENVELOPE_VERSION;
  canonicalFormat: CanonicalFormat;
  canonicalKind: ArtifactCanonicalKind;
  contentSchemaVersion: string;
  contentMd: string;
  contentJson?: unknown;
  blocks?: unknown[];
  projection: {
    status: MarkdownProjectionStatus;
    projectedAt: string | null;
    error: string | null;
    completeness: ArtifactProjectionCompleteness;
    projectedFromRevision: string | null;
    projectedFromHash: string | null;
  };
  provenance: {
    originRuntime: string | null;
    originRecordId: string | null;
    originRevision: string | null;
    originHash?: string | null;
  };
  // Migration aliases retained while older consumers move to projection.*.
  artifactType: string;
  markdownProjectionStatus: MarkdownProjectionStatus;
  markdownProjectedAt?: string | null;
  projectionError?: string | null;
}

export interface LegacyArtifactContentEnvelope {
  canonicalFormat: CanonicalFormat;
  artifactType: string;
  contentMd: string;
  contentJson?: unknown;
  blocks?: unknown[];
  contentSchemaVersion?: string;
  markdownProjectionStatus: MarkdownProjectionStatus;
  markdownProjectedAt?: string | null;
  projectionError?: string | null;
}

/** Compatibility alias accepted by migration-period UI consumers. */
export type ArtifactContentEnvelope = ArtifactContentEnvelopeV1 | LegacyArtifactContentEnvelope;

export interface ArtifactContentValidationResult {
  valid: boolean;
  errors: string[];
}

export function isCanonicalFormat(value: unknown): value is CanonicalFormat {
  return typeof value === 'string' && CANONICAL_FORMATS.includes(value as CanonicalFormat);
}

export function isMarkdownProjectionStatus(value: unknown): value is MarkdownProjectionStatus {
  return (
    typeof value === 'string' &&
    MARKDOWN_PROJECTION_STATUSES.includes(value as MarkdownProjectionStatus)
  );
}

export function validateArtifactContentEnvelope(
  envelope: Partial<ArtifactContentEnvelopeV1> | LegacyArtifactContentEnvelope | null | undefined
): ArtifactContentValidationResult {
  const errors: string[] = [];
  if (!envelope) return { valid: false, errors: ['Content envelope is required.'] };
  if (!isCanonicalFormat(envelope.canonicalFormat))
    errors.push('canonicalFormat must be markdown or json.');
  if (typeof envelope.contentMd !== 'string')
    errors.push('contentMd must be a string Markdown projection.');
  if (
    'envelopeVersion' in envelope &&
    envelope.envelopeVersion !== ARTIFACT_CONTENT_ENVELOPE_VERSION
  ) {
    errors.push('envelopeVersion must be artifact-content/v1.');
  }
  if (
    'projection' in envelope &&
    envelope.projection &&
    !isMarkdownProjectionStatus(envelope.projection.status)
  ) {
    errors.push('projection.status must be synced, stale, failed, or missing.');
  }
  return { valid: errors.length === 0, errors };
}

function baseEnvelope(params: {
  canonicalFormat: CanonicalFormat;
  canonicalKind: ArtifactCanonicalKind;
  artifactType: string;
  contentMd: string;
  contentJson?: unknown;
  contentSchemaVersion?: string;
  status: MarkdownProjectionStatus;
  projectedAt?: string | null;
  error?: string | null;
}): ArtifactContentEnvelopeV1 {
  return {
    envelopeVersion: ARTIFACT_CONTENT_ENVELOPE_VERSION,
    canonicalFormat: params.canonicalFormat,
    canonicalKind: params.canonicalKind,
    contentSchemaVersion: params.contentSchemaVersion || 'legacy/v0',
    contentMd: params.contentMd,
    ...(params.contentJson !== undefined ? { contentJson: params.contentJson } : {}),
    projection: {
      status: params.status,
      projectedAt: params.projectedAt || null,
      error: params.error || null,
      completeness: 'full',
      projectedFromRevision: null,
      projectedFromHash: null,
    },
    provenance: { originRuntime: null, originRecordId: null, originRevision: null },
    artifactType: params.artifactType,
    markdownProjectionStatus: params.status,
    markdownProjectedAt: params.projectedAt || null,
    projectionError: params.error || null,
  };
}

export function createMarkdownContentEnvelope(params: {
  artifactType: string;
  canonicalKind?: ArtifactCanonicalKind;
  contentMd: string;
  contentSchemaVersion?: string;
  markdownProjectedAt?: string;
}): ArtifactContentEnvelopeV1 {
  return baseEnvelope({
    canonicalFormat: 'markdown',
    canonicalKind: params.canonicalKind || 'document',
    artifactType: params.artifactType,
    contentMd: params.contentMd,
    contentSchemaVersion: params.contentSchemaVersion,
    status: params.contentMd.trim() ? 'synced' : 'missing',
    projectedAt: params.markdownProjectedAt,
  });
}

export function createJsonContentEnvelope(params: {
  artifactType: string;
  canonicalKind?: ArtifactCanonicalKind;
  contentJson: unknown;
  contentMd: string;
  contentSchemaVersion?: string;
  markdownProjectionStatus?: MarkdownProjectionStatus;
  markdownProjectedAt?: string;
  projectionError?: string;
}): ArtifactContentEnvelopeV1 {
  const status = !params.contentMd.trim()
    ? 'missing'
    : params.markdownProjectionStatus === 'failed'
      ? 'failed'
      : 'stale';
  return baseEnvelope({
    canonicalFormat: 'json',
    canonicalKind: params.canonicalKind || 'unknown',
    artifactType: params.artifactType,
    contentJson: params.contentJson,
    contentMd: params.contentMd,
    contentSchemaVersion: params.contentSchemaVersion,
    status,
    projectedAt: params.markdownProjectedAt,
    error: status === 'failed' ? params.projectionError || 'Projection failed' : null,
  });
}
