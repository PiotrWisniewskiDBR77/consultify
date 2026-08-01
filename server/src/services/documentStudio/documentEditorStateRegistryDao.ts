/**
 * Consultify Document Studio — Editor State Registry DAO.
 *
 * Module 10 (Dokumenty) hardening. Persists the three pieces of editor
 * state that previously lived only in process memory in
 * `documentStudioService.ts`:
 *
 *   - editor proposals      (`proposalStore`)
 *   - the per-artifact audit ledger (`auditStore`)
 *   - the live schema overlay       (`schemaOverlayStore`)
 *
 * Backing tables (migration `20260603_document_studio_editor_state.sql`):
 *   - document_studio_editor_proposals
 *   - document_studio_editor_audit
 *   - document_studio_schema_overlay
 *
 * Design contract (mirrors `documentTemplateRegistryDao.ts`):
 *   - The DAO is a write-through layer behind the in-process Map cache
 *     in `documentStudioService.ts`. The service public API stays
 *     synchronous; persistence is a best-effort side-effect.
 *   - Every operation is failure-tolerant: a missing migration, a DB
 *     outage, or any other error path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads hydrate the cache lazily once per (organization, artifact)
 *     on cold start.
 *
 * Tenant safety: every query carries `organization_id` in the WHERE
 * clause; cross-tenant reads are deny-by-default.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type {
  DocumentAuditEntry,
  DocumentEditorProposal,
  DocumentProposalStatus,
  DocumentSchema,
} from './documentStudioTypes.js';

interface ProposalRow {
  proposal_id: string;
  artifact_id: string;
  organization_id: string;
  scope: string;
  status: string;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
  proposal_json: unknown;
}

interface AuditRow {
  audit_id: string;
  artifact_id: string;
  organization_id: string;
  proposal_id?: string | null;
  action: string;
  actor_id: string;
  occurred_at: string | Date;
  details?: unknown;
}

interface OverlayRow {
  artifact_id: string;
  organization_id: string;
  schema_json: unknown;
  updated_at: string | Date;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

/**
 * C2 hardening — outcome of a single durable-write attempt. `ok: true`
 * means the INSERT/UPSERT was confirmed by the driver. `ok: false`
 * always carries `degraded` so the caller can tell a missing migration
 * (tolerated degradation) apart from a live DB failure (real risk of
 * data loss — should be surfaced, not swallowed silently).
 */
export interface PersistOutcome {
  ok: boolean;
  degraded?: 'schema_missing' | 'db_error';
  reason?: string;
}

/**
 * Best-effort classifier: is this error message consistent with the
 * backing table/relation not existing yet (pre-migration environment)?
 * Mirrors the "table not found" detection already used by
 * `DbPromise.ts`'s internal fallback logging so the signal stays
 * consistent across the codebase.
 */
function isSchemaMissingError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes('no such table') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('Database not initialized')
  );
}

function toPersistOutcome(result: { success: boolean; error?: string }): PersistOutcome {
  if (result.success) return { ok: true };
  return {
    ok: false,
    degraded: isSchemaMissingError(result.error) ? 'schema_missing' : 'db_error',
    reason: result.error,
  };
}

// ============================================================
// PROPOSALS
// ============================================================

/**
 * Load every proposal for a given (artifact, organization). Resolves to
 * `[]` on any failure path. Cross-tenant rows are excluded by the WHERE
 * clause.
 */
export async function loadProposalsForArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentEditorProposal[]> {
  if (!artifactId || !organizationId) return [];
  try {
    const rows = await dbAll<ProposalRow>(
      `SELECT * FROM document_studio_editor_proposals
        WHERE artifact_id = $1 AND organization_id = $2
        ORDER BY created_at ASC`,
      [artifactId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows
      .map((row) => parseJson<DocumentEditorProposal | null>(row.proposal_json, null))
      .filter((p): p is DocumentEditorProposal => Boolean(p && p.proposalId));
  } catch (err) {
    logger.warn('[DocumentStudio][EditorStateDao] loadProposalsForArtifact failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Upsert a proposal (write-through, idempotent via `ON CONFLICT ... DO
 * UPDATE`). Never throws — every failure path resolves to a
 * `PersistOutcome` with `ok: false` plus a `degraded` reason so the
 * caller (the service's `persistProposalWriteThrough`) can decide
 * whether to log loudly (`db_error`) or tolerate quietly
 * (`schema_missing`, i.e. pre-migration environment).
 */
export async function persistProposal(proposal: DocumentEditorProposal): Promise<PersistOutcome> {
  if (!proposal?.proposalId || !proposal.artifactId || !proposal.organizationId) {
    return { ok: false, degraded: 'db_error', reason: 'invalid_proposal_input' };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_studio_editor_proposals (
         proposal_id, artifact_id, organization_id, scope, status,
         created_by, created_at, updated_at, proposal_json
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb
       )
       ON CONFLICT (proposal_id) DO UPDATE SET
         scope = EXCLUDED.scope,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         proposal_json = EXCLUDED.proposal_json`,
      [
        proposal.proposalId,
        proposal.artifactId,
        proposal.organizationId,
        proposal.scope,
        proposal.status,
        proposal.createdBy,
        proposal.createdAt,
        new Date().toISOString(),
        JSON.stringify(proposal),
      ]
    );
    const outcome = toPersistOutcome(result);
    if (!outcome.ok) {
      logger.warn('[DocumentStudio][EditorStateDao] persistProposal did not confirm', {
        proposalId: proposal.proposalId,
        organizationId: proposal.organizationId,
        degraded: outcome.degraded,
        reason: outcome.reason,
      });
    }
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[DocumentStudio][EditorStateDao] persistProposal failed', {
      proposalId: proposal.proposalId,
      organizationId: proposal.organizationId,
      message,
    });
    return {
      ok: false,
      degraded: isSchemaMissingError(message) ? 'schema_missing' : 'db_error',
      reason: message,
    };
  }
}

// ============================================================
// AUDIT LEDGER
// ============================================================

/**
 * Load the full audit ledger for a given (artifact, organization),
 * ordered oldest-first to match the in-process push order. Resolves to
 * `[]` on any failure.
 */
export async function loadAuditForArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentAuditEntry[]> {
  if (!artifactId || !organizationId) return [];
  try {
    const rows = await dbAll<AuditRow>(
      `SELECT * FROM document_studio_editor_audit
        WHERE artifact_id = $1 AND organization_id = $2
        ORDER BY occurred_at ASC, audit_id ASC`,
      [artifactId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map((row) => ({
      auditId: row.audit_id,
      artifactId: row.artifact_id,
      organizationId: row.organization_id,
      proposalId: row.proposal_id ?? undefined,
      action: row.action as DocumentAuditEntry['action'],
      actorId: row.actor_id,
      occurredAt:
        row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
      details: parseJson<Record<string, unknown> | undefined>(row.details, undefined),
    }));
  } catch (err) {
    logger.warn('[DocumentStudio][EditorStateDao] loadAuditForArtifact failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Append a single audit entry. Idempotent on duplicate `auditId` — a
 * second persist with the same id is a no-op so retries don't
 * double-count. Best-effort; never throws.
 */
export async function persistAuditEntry(entry: DocumentAuditEntry): Promise<{ ok: boolean }> {
  if (!entry?.auditId || !entry.artifactId || !entry.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_studio_editor_audit (
         audit_id, artifact_id, organization_id, proposal_id, action,
         actor_id, occurred_at, details
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::jsonb
       )
       ON CONFLICT (audit_id) DO NOTHING`,
      [
        entry.auditId,
        entry.artifactId,
        entry.organizationId,
        entry.proposalId ?? null,
        entry.action,
        entry.actorId,
        entry.occurredAt,
        JSON.stringify(entry.details ?? {}),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][EditorStateDao] persistAuditEntry failed', {
      auditId: entry.auditId,
      artifactId: entry.artifactId,
      organizationId: entry.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

// ============================================================
// SCHEMA OVERLAY
// ============================================================

/**
 * Load the live schema overlay for a given (artifact, organization), or
 * `null` when none exists / on any failure.
 */
export async function loadSchemaOverlay(
  artifactId: string,
  organizationId: string
): Promise<DocumentSchema | null> {
  if (!artifactId || !organizationId) return null;
  try {
    const row = await dbGet<OverlayRow>(
      `SELECT * FROM document_studio_schema_overlay
        WHERE artifact_id = $1 AND organization_id = $2
        LIMIT 1`,
      [artifactId, organizationId]
    );
    if (!row) return null;
    return parseJson<DocumentSchema | null>(row.schema_json, null);
  } catch (err) {
    logger.warn('[DocumentStudio][EditorStateDao] loadSchemaOverlay failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Upsert the schema overlay. Best-effort; never throws.
 */
export async function persistSchemaOverlay(
  artifactId: string,
  organizationId: string,
  schema: DocumentSchema,
  expectedVersion?: string
): Promise<{ ok: boolean; conflict?: boolean }> {
  if (!artifactId || !organizationId || !schema) return { ok: false };
  try {
    const result = await dbRun(
      `INSERT INTO document_studio_schema_overlay (
         artifact_id, organization_id, schema_json, updated_at
       ) VALUES (
         $1, $2, $3::jsonb, $4
       )
       ON CONFLICT (artifact_id, organization_id) DO UPDATE SET
         schema_json = EXCLUDED.schema_json,
         updated_at = EXCLUDED.updated_at
       ${
         expectedVersion
           ? `WHERE document_studio_schema_overlay.schema_json->>'updatedAt' = $5`
           : ''
       }`,
      [
        artifactId,
        organizationId,
        JSON.stringify(schema),
        new Date().toISOString(),
        ...(expectedVersion ? [expectedVersion] : []),
      ]
    );
    if (result.success === true && expectedVersion && Number(result.changes ?? 0) === 0) {
      return { ok: false, conflict: true };
    }
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][EditorStateDao] persistSchemaOverlay failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

// Note: `DocumentProposalStatus` is intentionally re-exported so the
// service layer can type its status transitions against the DAO module
// without a second import of the types file.
export type { DocumentProposalStatus };

/**
 * Test-only helper: nukes every persistence artifact written by the DAO.
 * Production callers MUST NOT use it.
 * @internal
 */
export async function __resetEditorStateRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun(`DELETE FROM document_studio_editor_proposals`, []);
    await dbRun(`DELETE FROM document_studio_editor_audit`, []);
    await dbRun(`DELETE FROM document_studio_schema_overlay`, []);
  } catch {
    // Tables may not exist in the test DB — silently ignore so the test
    // suite stays compatible with the pre-migration baseline.
  }
}

/** @internal Test-only reset — best-effort DELETE of the schema overlay table only. */
export async function __resetSchemaOverlayDaoForTests(): Promise<void> {
  try {
    await dbRun(`DELETE FROM document_studio_schema_overlay`, []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
