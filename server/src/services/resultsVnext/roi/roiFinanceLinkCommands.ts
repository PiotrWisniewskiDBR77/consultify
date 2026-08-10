/**
 * ROI-E007 — Finance-link command layer (AC-01: a full pinned envelope;
 * AC-02: zero overwrite in either direction).
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §4, Decision D4.
 *
 * `createRoiFinanceLink` performs NO existence validation against any
 * Finance table (Decision D4 — a hard FK or a read-through existence check
 * on `finance_artifact_id`/`finance_artifact_type`/`finance_version_id`
 * would reintroduce exactly the "shared mutable table" coupling D06
 * declares off-limits). A link to a fabricated Finance artifact id is
 * accepted without error — the reconciliation mechanism (AC-03), not a
 * referential-integrity check, is the designed answer to a bad pin.
 *
 * Both commands are gated by the SAME `NON_EDITABLE_STATUSES` guard every
 * other economic-model-adjacent command file in this package uses (a
 * Finance link is metadata about the case, not part of the frozen economic
 * model — editable whenever the case itself is editable) — reuses
 * `RoiEconomicModelNotEditableError` rather than declaring a new error
 * class, matching `roiScenarioCommands.ts`/`roiBenefitEvidenceLinkCommands.ts`'s
 * precedent (this epic's own design §7 file list does not name a new
 * "not editable" error class for finance links).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';

import { RoiEconomicModelNotEditableError } from './roiCalculationPolicyCommands.js';
import { NON_EDITABLE_STATUSES, ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import { toRoiFinanceLink, type RoiFinanceLink, type RoiFinanceLinkRow } from './roiFinanceSeamTypes.js';

// ==========================================
// SHARED GUARD (same shape every other economic-model-adjacent commands
// file in this package declares locally — roiAssumptionCommands.ts/
// roiCostLineCommands.ts/roiBenefitLineCommands.ts/roiScenarioCommands.ts/
// roiBenefitEvidenceLinkCommands.ts).
// ==========================================

async function assertCaseEditableForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string,
  op: string
): Promise<void> {
  const caseResult = await client.query<{ status: string }>(
    `SELECT status FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) {
    throw new Error(`[${op}] case ${caseId} not found`);
  }
  if (NON_EDITABLE_STATUSES.includes(caseRow.status as (typeof NON_EDITABLE_STATUSES)[number])) {
    throw new RoiEconomicModelNotEditableError(caseId, caseRow.status);
  }
}

// ==========================================
// createRoiFinanceLink
// ==========================================

export interface CreateRoiFinanceLinkInput {
  caseId: string;
  organizationId: string;
  financeArtifactType: string;
  financeArtifactId: string;
  financeVersionId: string;
  mappingVersion?: number;
  source: string;
  asOf: string;
  semanticUnit?: string | null;
  currency?: string | null;
  linkPurpose: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function createRoiFinanceLink(
  input: CreateRoiFinanceLinkInput
): Promise<AtomicCommandOutcome<RoiFinanceLink>> {
  const {
    caseId,
    organizationId,
    financeArtifactType,
    financeArtifactId,
    financeVersionId,
    mappingVersion = 1,
    source,
    asOf,
    semanticUnit = null,
    currency = null,
    linkPurpose,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCreate<RoiFinanceLink>({
    organizationId,
    applyMutation: async (client) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'createRoiFinanceLink');

      // Decision D4: no existence check against any financial_* table here
      // — finance_artifact_type/finance_artifact_id/finance_version_id are
      // accepted as pure, unvalidated pinned TEXT references.
      const insertResult = await client.query<RoiFinanceLinkRow>(
        `INSERT INTO rvn_roi_finance_links (
           case_id, organization_id, finance_artifact_type, finance_artifact_id, finance_version_id,
           mapping_version, source, as_of, semantic_unit, currency, link_purpose,
           linked_by, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          caseId,
          organizationId,
          financeArtifactType,
          financeArtifactId,
          financeVersionId,
          mappingVersion,
          source,
          asOf,
          semanticUnit,
          currency,
          linkPurpose,
          actorUserId,
          actorUserId,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[createRoiFinanceLink] insert returned no row');
      return toRoiFinanceLink(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { financeLink: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.finance_link_created',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId, linkId: result.linkId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// removeRoiFinanceLink
// ==========================================

async function loadFinanceLinkForUpdate(
  client: PoolClient,
  linkId: string,
  organizationId: string
): Promise<RoiFinanceLinkRow | undefined> {
  const result = await client.query<RoiFinanceLinkRow>(
    `SELECT * FROM rvn_roi_finance_links WHERE link_id = $1 AND organization_id = $2 FOR UPDATE`,
    [linkId, organizationId]
  );
  return result.rows[0];
}
const financeLinkRowVersion = (row: RoiFinanceLinkRow) => row.row_version;

export interface RemoveRoiFinanceLinkInput {
  linkId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** Hard delete, same shape as `removeBenefitEvidenceLink` — a link is pure
 * pinned metadata, not an independent financial fact requiring soft-delete's
 * audit trail. Same `NON_EDITABLE_STATUSES` guard as `createRoiFinanceLink`. */
export async function removeRoiFinanceLink(
  input: RemoveRoiFinanceLinkInput
): Promise<AtomicCommandOutcome<{ linkId: string }>> {
  const {
    linkId,
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiFinanceLinkRow, { linkId: string }>({
    organizationId,
    aggregateId: linkId,
    expectedVersion,
    loadForUpdate: loadFinanceLinkForUpdate,
    getCurrentVersion: financeLinkRowVersion,
    applyMutation: async (client, currentRow, _nextVersion) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'removeRoiFinanceLink');
      beforeState = { financeLink: toRoiFinanceLink(currentRow) };
      await client.query(`DELETE FROM rvn_roi_finance_links WHERE link_id = $1`, [linkId]);
      return { linkId };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { financeLink: null };
      return {
        schemaVersion: 1,
        eventType: 'roi.finance_link_removed',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, linkId: result.linkId },
      } satisfies AtomicEventInput;
    },
  });
}
