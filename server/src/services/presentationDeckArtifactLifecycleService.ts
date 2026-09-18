import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';

type DeckRow = {
  id: string;
  organization_id: string;
  title?: string | null;
  deck_json?: string | null;
  slide_count?: number | null;
  status?: string | null;
  version?: number | null;
  exported_version?: number | null;
  exported_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
};

type VersionRow = {
  version: number;
  created_by?: string | null;
  created_at?: string | null;
};

type ArtifactOriginRow = {
  artifact_id: string;
};

export class DeckArtifactLifecycleError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'DeckArtifactLifecycleError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function safeParseDeckJson(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function countSlides(row: DeckRow, deckJson: Record<string, any>): number {
  if (Number.isFinite(Number(row.slide_count))) return Number(row.slide_count);
  if (Array.isArray(deckJson.cards)) return deckJson.cards.length;
  return 0;
}

function publishedVersion(row: DeckRow): number | null {
  if (Number.isFinite(Number(row.exported_version))) return Number(row.exported_version);
  const status = String(row.status || '').toLowerCase();
  if (status === 'ready' || status === 'exported' || status === 'published') {
    return Number.isFinite(Number(row.version)) ? Number(row.version) : null;
  }
  return null;
}

async function getDeck(deckId: string, organizationId: string): Promise<DeckRow> {
  const row = (await dbGet(
    `SELECT id, organization_id, title, deck_json, slide_count, status, version,
            exported_version, exported_at, created_by, updated_at
       FROM presentation_decks
      WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  )) as DeckRow | undefined;
  if (!row) {
    throw new DeckArtifactLifecycleError(404, 'DECK_NOT_FOUND', 'Deck not found');
  }
  return row;
}

async function findPresentationArtifact(
  deckId: string,
  organizationId: string
): Promise<string | null> {
  const row = (await dbGet(
    `SELECT artifact_id
       FROM v8_artifact_origin_links
      WHERE organization_id = ?
        AND origin_runtime = 'presentation'
        AND origin_record_id = ?
        AND is_primary_origin = 1
      LIMIT 1`,
    [organizationId, deckId]
  )) as ArtifactOriginRow | undefined;
  return row?.artifact_id || null;
}

async function readDeckVersion(deckId: string, version: number): Promise<VersionRow | null> {
  const row = (await dbGet(
    `SELECT version, created_by, created_at
       FROM presentation_deck_versions
      WHERE deck_id = ? AND version = ?
      LIMIT 1`,
    [deckId, version]
  )) as VersionRow | undefined;
  return row || null;
}

export async function readDeckArtifactLifecycle(params: {
  deckId: string;
  organizationId: string;
}) {
  const row = await getDeck(params.deckId, params.organizationId);
  const deckJson = safeParseDeckJson(row.deck_json);
  const fromVersion = publishedVersion(row);
  const versionRow = fromVersion ? await readDeckVersion(row.id, fromVersion) : null;
  const status = String(row.status || '').toLowerCase();
  const isPublished =
    fromVersion !== null && (status === 'ready' || status === 'exported' || status === 'published');

  return {
    status: isPublished ? 'published' : 'draft',
    dbStatus: row.status || 'draft',
    version: Number(row.version || 1),
    slideCount: countSlides(row, deckJson),
    updatedAt: row.updated_at || null,
    publication: isPublished
      ? {
          fromVersion,
          publishedBy: versionRow?.created_by || row.created_by || null,
          publishedAt: versionRow?.created_at || row.exported_at || row.updated_at || null,
        }
      : null,
  };
}

export async function publishDeckVersion(params: {
  deckId: string;
  organizationId: string;
  actorUserId: string;
}) {
  const row = await getDeck(params.deckId, params.organizationId);
  const deckJson = safeParseDeckJson(row.deck_json);
  const version = Number.isFinite(Number(row.version)) ? Number(row.version) : 1;
  const slideCount = countSlides(row, deckJson);
  const snapshot = row.deck_json || JSON.stringify(deckJson);
  const now = new Date().toISOString();

  const existingVersion = await readDeckVersion(row.id, version);
  if (!existingVersion) {
    await dbRun(
      `INSERT INTO presentation_deck_versions
         (id, deck_id, version, deck_json_snapshot, slide_count, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [randomUUID().replace(/-/g, ''), row.id, version, snapshot, slideCount, params.actorUserId]
    );
  }

  await dbRun(
    `UPDATE presentation_decks
        SET status = 'ready',
            exported_version = ?,
            exported_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?`,
    [version, row.id, params.organizationId]
  );

  const artifactId = await findPresentationArtifact(row.id, params.organizationId);
  if (artifactId) {
    await dbRun(
      `UPDATE v8_output_artifacts
          SET delivery_state = 'ready',
              is_draft = 0,
              last_transition_at = ?
        WHERE artifact_id = ? AND organization_id = ?`,
      [now, artifactId, params.organizationId]
    );
  }

  return {
    deckId: row.id,
    status: 'published',
    dbStatus: 'ready',
    version,
    slideCount,
    publishedBy: params.actorUserId,
    publishedAt: now,
    artifactId,
  };
}

export async function startDeckDraftRevision(params: {
  deckId: string;
  organizationId: string;
  actorUserId: string;
}) {
  const row = await getDeck(params.deckId, params.organizationId);
  const currentVersion = Number.isFinite(Number(row.version)) ? Number(row.version) : 1;
  const nextVersion = currentVersion + 1;

  await dbRun(
    `UPDATE presentation_decks
        SET status = 'draft',
            version = ?,
            exported_version = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?`,
    [nextVersion, row.id, params.organizationId]
  );

  const artifactId = await findPresentationArtifact(row.id, params.organizationId);
  if (artifactId) {
    await dbRun(
      `UPDATE v8_output_artifacts
          SET delivery_state = 'editing',
              is_draft = 1,
              last_transition_at = ?
        WHERE artifact_id = ? AND organization_id = ?`,
      [new Date().toISOString(), artifactId, params.organizationId]
    );
  }

  return {
    deckId: row.id,
    status: 'draft',
    version: nextVersion,
    previousPublishedVersion: currentVersion,
    actorUserId: params.actorUserId,
  };
}

export function sendDeckLifecycleError(res: Response, error: unknown): Response | null {
  if (!(error instanceof DeckArtifactLifecycleError)) return null;
  return res.status(error.statusCode).json({
    success: false,
    error: error.message,
    code: error.code,
  });
}
