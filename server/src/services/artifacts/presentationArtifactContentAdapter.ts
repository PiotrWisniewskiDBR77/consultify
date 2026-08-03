import { createHash } from 'node:crypto';

import type { ArtifactContentEnvelopeV1 } from '../../types/artifactContent.js';
import { get as dbGet } from '../../utils/DbPromise.js';
import type { ArtifactContentAdapter } from './artifactContentResolverService.js';
import { projectArtifactToMarkdown } from './contentProjectionService.js';

interface PresentationRow {
  id: string;
  title: string | null;
  deck_json: string | null;
  content_json_native: string | null;
  outline_json: string | null;
  version: number | null;
  updated_at: string | null;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export const presentationArtifactContentAdapter: ArtifactContentAdapter = {
  async resolve(params) {
    const deck = await dbGet<PresentationRow>(
      `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [params.originRecordId, params.organizationId],
      { fallback: true }
    );
    if (!deck) return null;

    const raw = String(
      deck.content_json_native || deck.deck_json || deck.outline_json || ''
    ).trim();
    const revisionBase = `${deck.version ?? 'legacy'}:${deck.updated_at || 'legacy'}`;
    if (!raw) {
      const originRevision = `presentation:${revisionBase}:empty`;
      const envelope: ArtifactContentEnvelopeV1 = {
        envelopeVersion: 'artifact-content/v1',
        canonicalFormat: 'json',
        canonicalKind: 'presentation',
        contentSchemaVersion: 'presentation-deck/v1',
        contentMd: '',
        contentJson: null,
        projection: {
          status: 'missing',
          projectedAt: null,
          error: null,
          completeness: 'full',
          projectedFromRevision: originRevision,
          projectedFromHash: null,
        },
        provenance: {
          originRuntime: 'presentation',
          originRecordId: deck.id,
          originRevision,
        },
        artifactType: 'presentation',
        markdownProjectionStatus: 'missing',
      };
      return { envelope, originRevision };
    }

    try {
      const contentJson = JSON.parse(raw);
      const sourceHash = hash(JSON.stringify(contentJson));
      const originRevision = `presentation:${revisionBase}:${sourceHash}`;
      const projection = projectArtifactToMarkdown('presentation', contentJson);
      const contentMd = projection.contentMd;
      const envelope: ArtifactContentEnvelopeV1 = {
        envelopeVersion: 'artifact-content/v1',
        canonicalFormat: 'json',
        canonicalKind: 'presentation',
        contentSchemaVersion: 'presentation-deck/v1',
        contentMd,
        contentJson,
        projection: {
          status: contentMd.trim() ? 'synced' : 'missing',
          projectedAt: null,
          error: null,
          completeness: 'full',
          projectedFromRevision: originRevision,
          projectedFromHash: sourceHash,
        },
        provenance: {
          originRuntime: 'presentation',
          originRecordId: deck.id,
          originRevision,
          originHash: sourceHash,
        },
        artifactType: 'presentation',
        markdownProjectionStatus: contentMd.trim() ? 'synced' : 'missing',
      };
      return { envelope, originRevision };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Malformed presentation JSON';
      const sourceHash = hash(raw);
      const originRevision = `presentation:${revisionBase}:${sourceHash}`;
      const envelope: ArtifactContentEnvelopeV1 = {
        envelopeVersion: 'artifact-content/v1',
        canonicalFormat: 'json',
        canonicalKind: 'presentation',
        contentSchemaVersion: 'presentation-deck/v1',
        contentMd: '',
        projection: {
          status: 'failed',
          projectedAt: null,
          error: message,
          completeness: 'full',
          projectedFromRevision: originRevision,
          projectedFromHash: sourceHash,
        },
        provenance: {
          originRuntime: 'presentation',
          originRecordId: deck.id,
          originRevision,
          originHash: sourceHash,
        },
        artifactType: 'presentation',
        markdownProjectionStatus: 'failed',
        projectionError: message,
      };
      return { envelope, originRevision };
    }
  },
};
