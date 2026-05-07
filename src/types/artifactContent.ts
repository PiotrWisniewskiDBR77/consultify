export const CANONICAL_FORMATS = ['markdown', 'json'] as const;
export const MARKDOWN_PROJECTION_STATUSES = ['synced', 'stale', 'failed', 'missing'] as const;

export type CanonicalFormat = (typeof CANONICAL_FORMATS)[number];
export type MarkdownProjectionStatus = (typeof MARKDOWN_PROJECTION_STATUSES)[number];

export interface ArtifactContentEnvelope {
  canonicalFormat: CanonicalFormat;
  artifactType: string;
  contentMd: string;
  contentJson?: unknown;
  contentSchemaVersion?: string;
  markdownProjectionStatus: MarkdownProjectionStatus;
  markdownProjectedAt?: string;
  projectionError?: string;
}

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
  envelope: Partial<ArtifactContentEnvelope> | null | undefined
): ArtifactContentValidationResult {
  const errors: string[] = [];

  if (!envelope) {
    return { valid: false, errors: ['Content envelope is required.'] };
  }

  if (!isCanonicalFormat(envelope.canonicalFormat)) {
    errors.push('canonicalFormat must be markdown or json.');
  }

  if (!envelope.artifactType || typeof envelope.artifactType !== 'string') {
    errors.push('artifactType is required.');
  }

  if (typeof envelope.contentMd !== 'string') {
    errors.push('contentMd must be a string Markdown projection.');
  }

  if (!isMarkdownProjectionStatus(envelope.markdownProjectionStatus)) {
    errors.push('markdownProjectionStatus must be synced, stale, failed, or missing.');
  }

  if (envelope.canonicalFormat === 'markdown' && typeof envelope.contentMd === 'string') {
    if (envelope.contentMd.trim().length === 0) {
      errors.push('markdown-canonical artifacts require non-empty contentMd.');
    }
  }

  if (envelope.canonicalFormat === 'json' && envelope.contentJson === undefined) {
    errors.push('json-canonical artifacts require contentJson.');
  }

  if (
    envelope.markdownProjectionStatus === 'failed' &&
    (!envelope.projectionError || envelope.projectionError.trim().length === 0)
  ) {
    errors.push('failed projections require projectionError.');
  }

  return { valid: errors.length === 0, errors };
}

export function createMarkdownContentEnvelope(params: {
  artifactType: string;
  contentMd: string;
  contentSchemaVersion?: string;
  markdownProjectedAt?: string;
}): ArtifactContentEnvelope {
  return {
    canonicalFormat: 'markdown',
    artifactType: params.artifactType,
    contentMd: params.contentMd,
    contentSchemaVersion: params.contentSchemaVersion,
    markdownProjectionStatus: 'synced',
    markdownProjectedAt: params.markdownProjectedAt,
  };
}

export function createJsonContentEnvelope(params: {
  artifactType: string;
  contentJson: unknown;
  contentMd: string;
  contentSchemaVersion?: string;
  markdownProjectionStatus?: MarkdownProjectionStatus;
  markdownProjectedAt?: string;
  projectionError?: string;
}): ArtifactContentEnvelope {
  return {
    canonicalFormat: 'json',
    artifactType: params.artifactType,
    contentJson: params.contentJson,
    contentMd: params.contentMd,
    contentSchemaVersion: params.contentSchemaVersion,
    markdownProjectionStatus: params.markdownProjectionStatus ?? 'synced',
    markdownProjectedAt: params.markdownProjectedAt,
    projectionError: params.projectionError,
  };
}
