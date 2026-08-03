import type {
  ArtifactContentEnvelopeV1,
  ArtifactProjectionStatus,
} from '../../types/artifactContent.js';

export type CanvasCanonicalFormat = 'markdown' | 'json';

export interface CanvasContentColumns {
  canonical_format?: string | null;
  content_json?: string | null;
  content_md?: string | null;
  content_json_native?: string | null;
  blocks_json?: string | null;
  content_schema_version?: string | null;
  markdown_projection_status?: string | null;
  markdown_projected_at?: string | null;
  projection_error?: string | null;
  kind?: string | null;
}

export interface CanvasContentMutation {
  canonicalFormat?: CanvasCanonicalFormat;
  content?: unknown;
  contentMd?: string | null;
  contentJson?: unknown;
  blocks?: unknown[];
  contentSchemaVersion?: string | null;
}

function parsed(value: string | null | undefined): { present: boolean; value?: unknown } {
  if (value === null || value === undefined) return { present: false };
  try {
    return { present: true, value: JSON.parse(value) as unknown };
  } catch {
    return { present: true, value };
  }
}

function structured(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

function blocks(value: string | null | undefined): unknown[] {
  const result = parsed(value);
  return Array.isArray(result.value) ? result.value : [];
}

export function resolveCanvasCanonicalEnvelope(
  row: CanvasContentColumns
): ArtifactContentEnvelopeV1 {
  const legacy = parsed(row.content_json);
  const native = parsed(row.content_json_native);
  const legal =
    row.canonical_format === 'markdown' || row.canonical_format === 'json'
      ? row.canonical_format
      : null;
  const format: CanvasCanonicalFormat =
    legal ||
    ((native.present && structured(native.value)) || structured(legacy.value)
      ? 'json'
      : 'markdown');
  const inferred = legal === null;
  const contentMd =
    row.content_md !== null && row.content_md !== undefined
      ? row.content_md
      : typeof legacy.value === 'string'
        ? legacy.value
        : '';
  const contentJson =
    format === 'json' && native.present && structured(native.value)
      ? native.value
      : format === 'json' && structured(legacy.value)
        ? legacy.value
        : undefined;
  const requested = row.markdown_projection_status;
  const status: ArtifactProjectionStatus =
    requested === 'failed'
      ? 'failed'
      : format === 'json' && contentJson !== undefined
        ? requested === 'synced' && contentMd
          ? 'synced'
          : contentMd
            ? 'stale'
            : 'missing'
        : contentMd
          ? 'synced'
          : 'missing';
  return {
    envelopeVersion: 'artifact-content/v1',
    canonicalFormat: format,
    canonicalKind: 'canvas',
    contentSchemaVersion: row.content_schema_version || (inferred ? 'legacy/v0' : 'work-canvas/v1'),
    contentMd,
    ...(contentJson !== undefined ? { contentJson } : {}),
    ...(blocks(row.blocks_json).length ? { blocks: blocks(row.blocks_json) } : {}),
    projection: {
      status,
      projectedAt: row.markdown_projected_at || null,
      error: status === 'failed' ? row.projection_error || 'Projection failed' : null,
      completeness: 'full',
      projectedFromRevision: null,
      projectedFromHash: null,
    },
    provenance: { originRuntime: 'canvas', originRecordId: null, originRevision: null },
    artifactType: row.kind || 'canvas',
    markdownProjectionStatus: status,
    markdownProjectedAt: row.markdown_projected_at || null,
    projectionError: status === 'failed' ? row.projection_error || 'Projection failed' : null,
  };
}

export function buildCanvasCanonicalWrite(
  current: CanvasContentColumns,
  mutation: CanvasContentMutation
): CanvasContentColumns & { envelope: ArtifactContentEnvelopeV1 } {
  const previous = resolveCanvasCanonicalEnvelope(current);
  const format = mutation.canonicalFormat || previous.canonicalFormat;
  const formatChanged = format !== previous.canonicalFormat;
  const jsonChanged =
    mutation.contentJson !== undefined || (format === 'json' && mutation.content !== undefined);
  const nextJson =
    mutation.contentJson !== undefined
      ? mutation.contentJson
      : format === 'json' && mutation.content !== undefined
        ? mutation.content
        : previous.contentJson;
  const nextMd =
    mutation.contentMd !== undefined
      ? mutation.contentMd
      : format === 'markdown' && typeof mutation.content === 'string'
        ? mutation.content
        : format === 'markdown'
          ? previous.contentMd
          : formatChanged
            ? null
            : previous.contentMd;
  const projectionStatus: ArtifactProjectionStatus =
    format === 'json'
      ? nextMd === null || nextMd === ''
        ? 'missing'
        : jsonChanged && mutation.contentMd === undefined
          ? 'stale'
          : 'synced'
      : 'synced';
  const legacyValue = format === 'markdown' ? (nextMd ?? '') : nextJson;
  const columns: CanvasContentColumns = {
    ...current,
    canonical_format: format,
    content_json: JSON.stringify(legacyValue ?? (format === 'markdown' ? '' : null)),
    content_md: format === 'markdown' ? (nextMd ?? '') : nextMd,
    content_json_native:
      format === 'json' && nextJson !== undefined ? JSON.stringify(nextJson) : null,
    blocks_json:
      mutation.blocks !== undefined
        ? mutation.blocks.length
          ? JSON.stringify(mutation.blocks)
          : null
        : (current.blocks_json ?? null),
    content_schema_version:
      mutation.contentSchemaVersion !== undefined
        ? mutation.contentSchemaVersion
        : current.content_schema_version || 'work-canvas/v1',
    markdown_projection_status: projectionStatus,
    markdown_projected_at:
      projectionStatus === 'synced' ? current.markdown_projected_at || null : null,
    projection_error: null,
  };
  return { ...columns, envelope: resolveCanvasCanonicalEnvelope(columns) };
}

export function inferCanvasVersionFormat(
  version: Pick<CanvasContentColumns, 'content_md' | 'content_json_native' | 'blocks_json'>
): CanvasCanonicalFormat {
  const native = parsed(version.content_json_native);
  return native.present && structured(native.value) ? 'json' : 'markdown';
}
