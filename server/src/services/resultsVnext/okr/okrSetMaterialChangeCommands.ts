/**
 * OKR-E002 — `OKRMaterialChange` command layer (F-005-AC-02, design §4.8).
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §4.8.
 * Schema: server/migrations/20260823_rvn_okr_set.sql.
 *
 * Hand-written `executeAtomicCommand` call (not the generic
 * `runOkrSetLifecycleTransition` helper) — this command does NOT change
 * `status`, it writes a `title`/`owner_user_id`/`reviewer_user_id` field on
 * an already-`active` Set and appends an `okr_vnext_set_versions` row.
 * Matches `kpiDefinitionCommands.ts`/`roiCaseApprovalCommands.ts`'s own
 * convention: any command writing fields beyond `status` is hand-written,
 * never routed through a generic status-transition helper.
 *
 * THE literal F-005-AC-02 guarantee this file exists to prove: the approved
 * snapshot (`okr_vnext_approved_snapshots`) is NEVER touched by this
 * command — only `okr_vnext_sets` (the live field + `current_version`) and
 * `okr_vnext_set_versions` (the append-only history row) are written.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';

import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import { OkrSetValidationError } from './okrSetCommands.js';
import { toOkrSet, type OkrSet, type OkrSetRow } from './okrSetTypes.js';
import {
  toOkrSetVersion,
  type OkrSetVersion,
  type OkrSetVersionFieldName,
  type OkrSetVersionRow,
} from './okrSetTypes.js';

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadOkrSetForUpdate(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<OkrSetRow | undefined> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
    [setId, organizationId]
  );
  return result.rows[0];
}

function setRowVersion(row: OkrSetRow): number {
  return row.row_version;
}

/** Whitelisted mapping from the allowed `field_name` values to the actual
 * `okr_vnext_sets` column name they write — both currently identical
 * strings, but expressed as an explicit map (not string interpolation of
 * caller input) so this can never become a SQL-injection vector even if the
 * allowed field set grows. */
const FIELD_COLUMN: Record<OkrSetVersionFieldName, 'title' | 'owner_user_id' | 'reviewer_user_id'> = {
  title: 'title',
  owner_user_id: 'owner_user_id',
  reviewer_user_id: 'reviewer_user_id',
};

export interface RecordOkrSetMaterialChangeInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  fieldName: OkrSetVersionFieldName;
  afterValue: string;
  reason: string;
  requestedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

export interface RecordOkrSetMaterialChangeResult {
  set: OkrSet;
  version: OkrSetVersion;
}

/**
 * Guard: `status !== 'active'` -> `OkrSetValidationError('NOT_ACTIVE', ...)`.
 * Reads `before_value` from `currentRow[fieldName]`; INSERTs the version row
 * (`version_number = current_version + 1`); UPDATEs the Set's field AND
 * `current_version` (D5/D6: `current_version` bumps ONLY here). The
 * standard CAS `row_version` also advances via `nextVersion`, same as every
 * other command in this domain. The approved snapshot table is never
 * referenced by this function at all — F-005-AC-02's literal guarantee.
 */
export async function recordOkrSetMaterialChange(
  input: RecordOkrSetMaterialChangeInput
): Promise<AtomicCommandOutcome<RecordOkrSetMaterialChangeResult>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    fieldName,
    afterValue,
    reason,
    requestedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSetRow, RecordOkrSetMaterialChangeResult>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'active') {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — material changes may only be recorded on an "active" Set`,
          'NOT_ACTIVE',
          { setId, status: currentRow.status }
        );
      }

      const column = FIELD_COLUMN[fieldName];
      const beforeValue = (currentRow as unknown as Record<string, string | null>)[column] ?? null;
      const versionNumber = currentRow.current_version + 1;

      beforeState = { set: toOkrSet(currentRow) };

      const versionInsert = await client.query<OkrSetVersionRow>(
        `INSERT INTO okr_vnext_set_versions
           (set_id, organization_id, version_number, field_name, before_value, after_value, reason, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [setId, organizationId, versionNumber, fieldName, beforeValue, afterValue, reason, requestedBy]
      );
      const versionRow = versionInsert.rows[0];
      if (!versionRow) {
        throw new Error(`[recordOkrSetMaterialChange] insert into okr_vnext_set_versions returned no row for ${setId}`);
      }

      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET ${column} = $1, current_version = $2, row_version = $3, updated_by = $4, updated_at = now()
          WHERE set_id = $5
          RETURNING *`,
        [afterValue, versionNumber, nextVersion, requestedBy, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[recordOkrSetMaterialChange] update returned no row for ${setId}`);
      }

      return { set: toOkrSet(updatedRow), version: toOkrSetVersion(versionRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState: Record<string, unknown> = { set: result.set, version: result.version };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.material_change_recorded',
        aggregateType: 'okr_set',
        aggregateId: setId,
        organizationId,
        actorUserId: requestedBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId, versionId: result.version.versionId, fieldName, versionNumber: result.version.versionNumber },
      } satisfies AtomicEventInput;
    },
  });
}
