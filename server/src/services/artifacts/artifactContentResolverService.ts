import { createHash } from 'node:crypto';

import {
  type ArtifactContentEnvelopeV1,
  ArtifactContentEnvelopeV1Schema,
} from '../../types/artifactContent.js';
import { get as dbGet } from '../../utils/DbPromise.js';
import { AppError } from '../../utils/ErrorHandler.js';
import { presentationArtifactContentAdapter } from './presentationArtifactContentAdapter.js';
import { reportArtifactContentAdapter } from './reportArtifactContentAdapter.js';
import { sheetArtifactContentAdapter } from './sheetArtifactContentAdapter.js';
import { wave5ArtifactContentAdapter } from './wave5ArtifactContentAdapter.js';

export const ARTIFACT_CONTENT_ERROR_CODES = {
  ARTIFACT_NOT_FOUND: 'ARTIFACT_CONTENT_ARTIFACT_NOT_FOUND',
  ORIGIN_MISSING: 'ARTIFACT_CONTENT_ORIGIN_MISSING',
  RUNTIME_UNSUPPORTED: 'ARTIFACT_CONTENT_RUNTIME_UNSUPPORTED',
  ORIGIN_NOT_FOUND: 'ARTIFACT_CONTENT_ORIGIN_NOT_FOUND',
  INVALID_ENVELOPE: 'ARTIFACT_CONTENT_INVALID_ENVELOPE',
} as const;

export interface ArtifactContentAdapterResult {
  envelope: ArtifactContentEnvelopeV1;
  originRevision?: string | null;
}

export interface ArtifactContentAdapter {
  resolve(params: {
    organizationId: string;
    artifactId: string;
    originRuntime: string;
    originRecordId: string;
  }): Promise<ArtifactContentAdapterResult | null>;
}

export interface ResolvedArtifactContent {
  artifactId: string;
  origin: { originRuntime: string; originRecordId: string };
  originRevision: string | null;
  contentHash: string;
  resolvedAt: string;
  etag: string;
  envelope: ArtifactContentEnvelopeV1;
}

const adapters = new Map<string, ArtifactContentAdapter>();
adapters.set('report', reportArtifactContentAdapter);
adapters.set('presentation', presentationArtifactContentAdapter);
adapters.set('sheet', sheetArtifactContentAdapter);
adapters.set('native_artifact', wave5ArtifactContentAdapter);

export function registerArtifactContentAdapter(
  originRuntime: string,
  adapter: ArtifactContentAdapter
): () => void {
  const key = originRuntime.trim();
  if (!key) throw new Error('originRuntime is required');
  adapters.set(key, adapter);
  return () => {
    if (adapters.get(key) === adapter) adapters.delete(key);
  };
}

export function clearArtifactContentAdaptersForTests(): void {
  adapters.clear();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return `{${Object.keys(source)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(source[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function computeArtifactContentHash(envelope: ArtifactContentEnvelopeV1): string {
  return createHash('sha256')
    .update(
      stableJson({
        canonicalFormat: envelope.canonicalFormat,
        canonicalKind: envelope.canonicalKind,
        contentSchemaVersion: envelope.contentSchemaVersion,
        contentMd: envelope.contentMd,
        contentJson: envelope.contentJson,
        blocks: envelope.blocks,
      })
    )
    .digest('hex');
}

export function computeArtifactContentEtag(params: {
  originRevision: string | null;
  contentHash: string;
}): string {
  const value = createHash('sha256')
    .update(`${params.originRevision || 'none'}:${params.contentHash}`)
    .digest('hex');
  return `"${value}"`;
}

export async function resolveArtifactContent(params: {
  artifactId: string;
  organizationId: string;
}): Promise<ResolvedArtifactContent> {
  const artifact = await dbGet<{ artifact_id: string }>(
    `SELECT artifact_id FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [params.artifactId, params.organizationId],
    { fallback: true }
  );
  if (!artifact) {
    throw new AppError('Artifact not found', 404, ARTIFACT_CONTENT_ERROR_CODES.ARTIFACT_NOT_FOUND, {
      artifactId: params.artifactId,
    });
  }

  const origin = await dbGet<{
    origin_runtime: string;
    origin_record_id: string;
  }>(
    `SELECT origin_runtime, origin_record_id
       FROM v8_artifact_origin_links
      WHERE artifact_id = ? AND organization_id = ? AND is_primary_origin = 1
      ORDER BY created_at ASC
      LIMIT 1`,
    [params.artifactId, params.organizationId],
    { fallback: true }
  );
  if (!origin?.origin_runtime || !origin.origin_record_id) {
    throw new AppError(
      'Primary artifact origin is missing',
      409,
      ARTIFACT_CONTENT_ERROR_CODES.ORIGIN_MISSING,
      { artifactId: params.artifactId }
    );
  }

  const adapter = adapters.get(origin.origin_runtime);
  if (!adapter) {
    throw new AppError(
      `Artifact content runtime ${origin.origin_runtime} is unsupported`,
      422,
      ARTIFACT_CONTENT_ERROR_CODES.RUNTIME_UNSUPPORTED,
      { artifactId: params.artifactId, originRuntime: origin.origin_runtime }
    );
  }

  const resolved = await adapter.resolve({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    originRuntime: origin.origin_runtime,
    originRecordId: origin.origin_record_id,
  });
  if (!resolved) {
    throw new AppError(
      'Artifact origin content was not found',
      404,
      ARTIFACT_CONTENT_ERROR_CODES.ORIGIN_NOT_FOUND,
      { artifactId: params.artifactId, originRecordId: origin.origin_record_id }
    );
  }

  const parsed = ArtifactContentEnvelopeV1Schema.safeParse(resolved.envelope);
  if (!parsed.success) {
    throw new AppError(
      'Artifact content adapter returned an invalid V1 envelope',
      502,
      ARTIFACT_CONTENT_ERROR_CODES.INVALID_ENVELOPE,
      { artifactId: params.artifactId }
    );
  }
  const envelope = parsed.data;
  const originRevision = resolved.originRevision || envelope.provenance.originRevision || null;
  const contentHash = computeArtifactContentHash(envelope);
  const etag = computeArtifactContentEtag({ originRevision, contentHash });

  return {
    artifactId: params.artifactId,
    origin: {
      originRuntime: origin.origin_runtime,
      originRecordId: origin.origin_record_id,
    },
    originRevision,
    contentHash,
    resolvedAt: new Date().toISOString(),
    etag,
    envelope,
  };
}
