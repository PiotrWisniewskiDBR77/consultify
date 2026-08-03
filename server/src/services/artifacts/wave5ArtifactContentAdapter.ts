import type { ArtifactContentEnvelopeV1 } from '../../types/artifactContent.js';
import { get as dbGet } from '../../utils/DbPromise.js';
import type { ArtifactContentAdapter } from './artifactContentResolverService.js';
import { presentationArtifactContentAdapter } from './presentationArtifactContentAdapter.js';
import { reportArtifactContentAdapter } from './reportArtifactContentAdapter.js';
import { sheetArtifactContentAdapter } from './sheetArtifactContentAdapter.js';

function json<T>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === 'object') return raw as T;
  try {
    return raw == null ? fallback : (JSON.parse(String(raw)) as T);
  } catch {
    return fallback;
  }
}

const originAdapters: Record<string, ArtifactContentAdapter> = {
  report: reportArtifactContentAdapter,
  presentation: presentationArtifactContentAdapter,
  sheet: sheetArtifactContentAdapter,
};

export const wave5ArtifactContentAdapter: ArtifactContentAdapter = {
  async resolve(params) {
    const row = await dbGet<any>(
      `SELECT artifact_id, artifact_type, canonical_format, content, content_md,
              content_json_native, content_schema_version, markdown_projection_status,
              markdown_projected_at, projection_error, current_version, updated_at,
              source_refs_json, provenance_json
         FROM wave5_artifacts
        WHERE artifact_id = ? AND organization_id = ?`,
      [params.originRecordId, params.organizationId],
      { fallback: false }
    );
    if (!row) return null;
    const provenance = json<Record<string, any>>(row.provenance_json, {});
    const refs = json<any[]>(row.source_refs_json, []);
    const mirror =
      provenance?.metadata?.contentAuthority === 'origin_runtime' ||
      provenance?.metadata?.mirroredFrom === 'v8_output_artifacts' ||
      refs.some((ref) => ref?.sourceClass === 'legacy_artifact');
    if (mirror) {
      const ref = refs.find((item) => item?.sourceClass === 'legacy_artifact');
      const runtime = String(ref?.originRuntime || provenance?.metadata?.originRuntime || '');
      const recordId = String(ref?.originRecordId || provenance?.metadata?.originRecordId || '');
      const adapter = originAdapters[runtime];
      if (!adapter || !recordId) return null;
      return adapter.resolve({ ...params, originRuntime: runtime, originRecordId: recordId });
    }

    const format = row.canonical_format === 'json' ? 'json' : 'markdown';
    const contentMd =
      row.content_md !== null && row.content_md !== undefined
        ? String(row.content_md)
        : format === 'markdown'
          ? String(row.content || '')
          : '';
    const contentJson = format === 'json' ? json(row.content_json_native, undefined) : undefined;
    const status = contentMd ? 'synced' : 'missing';
    const originRevision = `wave5:${Number(row.current_version || 1)}:${row.updated_at || 'legacy'}`;
    const envelope: ArtifactContentEnvelopeV1 = {
      envelopeVersion: 'artifact-content/v1',
      canonicalFormat: format,
      canonicalKind:
        row.artifact_type === 'slide_deck'
          ? 'presentation'
          : row.artifact_type === 'spreadsheet'
            ? 'sheet'
            : 'document',
      contentSchemaVersion: row.content_schema_version || 'wave5/v1',
      contentMd,
      ...(contentJson !== undefined ? { contentJson } : {}),
      projection: {
        status,
        projectedAt: row.markdown_projected_at || null,
        error: null,
        completeness: 'full',
        projectedFromRevision: originRevision,
        projectedFromHash: null,
      },
      provenance: {
        originRuntime: 'native_artifact',
        originRecordId: row.artifact_id,
        originRevision,
      },
      artifactType: row.artifact_type || 'native_artifact',
      markdownProjectionStatus: status,
      markdownProjectedAt: row.markdown_projected_at || null,
      projectionError: null,
    };
    return { envelope, originRevision };
  },
};
