/**
 * suggestedChangesService — additive "Suggested changes" slice (Formula §5 / Faza 4).
 *
 * When the Initiative Generator proposes a CHANGE to an EXISTING initiative it must
 * NOT mutate it directly. The change becomes a *suggested change* (a proposal) that
 * the owner accepts/rejects via a mini-gate. Accepting only marks the proposal as
 * accepted — applying the change to the initiative stays a separate, manual step
 * (doctrine: changes are proposals, the owner decides).
 *
 * Storage: a single org-scoped table, created lazily via a guarded
 * `CREATE TABLE IF NOT EXISTS` (DB_MANAGED_SCHEMA=off → no migrations). This mirrors
 * the pattern in initiativeWizardService.ts.
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';

export type SuggestedChangeKind = 'extend' | 'evidence' | 'conflict' | 're_prioritize';
export type SuggestedChangeStatus = 'pending' | 'accepted' | 'rejected';

const VALID_KINDS: SuggestedChangeKind[] = ['extend', 'evidence', 'conflict', 're_prioritize'];

export interface SuggestedChangeRow {
  id: string;
  initiativeId: string;
  organizationId: string;
  kind: SuggestedChangeKind;
  title: string;
  rationale: string;
  sourceType: string | null;
  sourceId: string | null;
  status: SuggestedChangeStatus;
  createdBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface CreateSuggestedChangeInput {
  initiativeId: string;
  organizationId: string;
  kind: SuggestedChangeKind;
  title: string;
  rationale: string;
  sourceType?: string | null;
  sourceId?: string | null;
  createdBy?: string | null;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      // Guarded lazy create — additive, idempotent, no migrations.
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS initiative_suggested_changes (
          id TEXT PRIMARY KEY,
          initiative_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          rationale TEXT NOT NULL DEFAULT '',
          source_type TEXT,
          source_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          resolved_by TEXT
        )`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_initiative_suggested_changes_initiative
         ON initiative_suggested_changes(initiative_id, status)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_initiative_suggested_changes_org
         ON initiative_suggested_changes(organization_id, status)`
      );
    })();
  }
  await ensureTablePromise;
}

export function isValidKind(value: unknown): value is SuggestedChangeKind {
  return typeof value === 'string' && VALID_KINDS.includes(value as SuggestedChangeKind);
}

function mapRow(row: any): SuggestedChangeRow {
  return {
    id: String(row.id),
    initiativeId: String(row.initiative_id),
    organizationId: String(row.organization_id),
    kind: String(row.kind) as SuggestedChangeKind,
    title: String(row.title ?? ''),
    rationale: String(row.rationale ?? ''),
    sourceType: row.source_type != null ? String(row.source_type) : null,
    sourceId: row.source_id != null ? String(row.source_id) : null,
    status: String(row.status ?? 'pending') as SuggestedChangeStatus,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    createdAt: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
    resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
    resolvedBy: row.resolved_by != null ? String(row.resolved_by) : null,
  };
}

/**
 * Create a PENDING suggested change against an existing initiative.
 */
export async function createSuggestedChange(
  input: CreateSuggestedChangeInput
): Promise<SuggestedChangeRow> {
  await ensureTable();

  const id = `isc_${uuidv4()}`;
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `INSERT INTO initiative_suggested_changes
       (id, initiative_id, organization_id, kind, title, rationale, source_type, source_id, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      id,
      input.initiativeId,
      input.organizationId,
      input.kind,
      input.title.trim(),
      (input.rationale ?? '').trim(),
      input.sourceType ?? null,
      input.sourceId ?? null,
      input.createdBy ?? null,
      now,
    ]
  );

  const row = await queryHelpers.queryOne(
    `SELECT * FROM initiative_suggested_changes WHERE id = ? AND organization_id = ?`,
    [id, input.organizationId]
  );
  return mapRow(row);
}

/**
 * List suggested changes for an initiative (org-scoped). Optional status filter.
 */
export async function listSuggestedChanges(params: {
  initiativeId: string;
  organizationId: string;
  status?: SuggestedChangeStatus;
}): Promise<SuggestedChangeRow[]> {
  await ensureTable();

  const sqlParams: unknown[] = [params.initiativeId, params.organizationId];
  let sql = `SELECT * FROM initiative_suggested_changes
             WHERE initiative_id = ? AND organization_id = ?`;
  if (params.status) {
    sql += ` AND status = ?`;
    sqlParams.push(params.status);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = await queryHelpers.queryAll(sql, sqlParams);
  return (rows || []).map(mapRow);
}

/**
 * Resolve a suggested change (the mini-gate). On 'accepted' we ONLY mark it accepted —
 * we never auto-mutate the initiative. Returns null if not found in the caller's org,
 * or if the change is already resolved with a different status (idempotency guard).
 */
export async function resolveSuggestedChange(params: {
  id: string;
  organizationId: string;
  status: 'accepted' | 'rejected';
  resolvedBy?: string | null;
}): Promise<SuggestedChangeRow | null> {
  await ensureTable();

  const existing = await queryHelpers.queryOne(
    `SELECT * FROM initiative_suggested_changes WHERE id = ? AND organization_id = ?`,
    [params.id, params.organizationId]
  );
  if (!existing) return null;

  const now = new Date().toISOString();
  await queryHelpers.queryRun(
    `UPDATE initiative_suggested_changes
       SET status = ?, resolved_at = ?, resolved_by = ?
     WHERE id = ? AND organization_id = ?`,
    [params.status, now, params.resolvedBy ?? null, params.id, params.organizationId]
  );

  const updated = await queryHelpers.queryOne(
    `SELECT * FROM initiative_suggested_changes WHERE id = ? AND organization_id = ?`,
    [params.id, params.organizationId]
  );
  return updated ? mapRow(updated) : null;
}
