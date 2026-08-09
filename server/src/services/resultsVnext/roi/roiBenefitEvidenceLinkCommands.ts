/**
 * ROI-E002 — benefit-evidence-link command layer (AC-02: a typed
 * `BenefitEvidenceLink`, never a loose `kpi_id`).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4, Decision D14.
 * Schema: server/migrations/20260816_rvn_roi_economic_model.sql.
 *
 * `addBenefitEvidenceLink` validates that `kpiId`/`pinnedKpiDefinitionVersionId`
 * exist and share the case's `organization_id` — an ORGANIZATION-scoped
 * existence check only, NOT a KPI-visibility check on the linker (Decision
 * D14: referencing a KPI by id/pinned-version is not itself a content leak;
 * only a repository read that HYDRATES the link into display-ready KPI
 * content must pass through KPI's own visibility scope —
 * `roiEconomicModelRepository.ts` owns that hydration rule).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';

import { RoiEconomicModelNotEditableError } from './roiCalculationPolicyCommands.js';
import { NON_EDITABLE_STATUSES, ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import {
  toRoiBenefitEvidenceLink,
  type RoiBenefitEvidenceLink,
  type RoiBenefitEvidenceLinkRow,
  type RoiEvidenceLinkPurpose,
} from './roiEconomicModelTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiBenefitEvidenceLinkValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_BENEFIT_EVIDENCE_LINK', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiBenefitEvidenceLinkValidationError';
    this.code = code;
    this.details = details;
  }
}

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
// addBenefitEvidenceLink
// ==========================================

export interface AddBenefitEvidenceLinkInput {
  benefitLineId: string;
  caseId: string;
  organizationId: string;
  kpiId: string;
  pinnedKpiDefinitionVersionId: string;
  expectedUnit?: string | null;
  purpose: RoiEvidenceLinkPurpose;
  notes?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function addBenefitEvidenceLink(
  input: AddBenefitEvidenceLinkInput
): Promise<AtomicCommandOutcome<RoiBenefitEvidenceLink>> {
  const {
    benefitLineId,
    caseId,
    organizationId,
    kpiId,
    pinnedKpiDefinitionVersionId,
    expectedUnit = null,
    purpose,
    notes = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCreate<RoiBenefitEvidenceLink>({
    organizationId,
    applyMutation: async (client) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'addBenefitEvidenceLink');

      const benefitLineResult = await client.query<{ benefit_line_id: string }>(
        `SELECT benefit_line_id FROM rvn_roi_benefit_lines
          WHERE benefit_line_id = $1 AND case_id = $2 AND organization_id = $3 AND deleted_at IS NULL`,
        [benefitLineId, caseId, organizationId]
      );
      if (!benefitLineResult.rows[0]) {
        throw new RoiBenefitEvidenceLinkValidationError(
          `Benefit line ${benefitLineId} not found on case ${caseId}`,
          'BENEFIT_LINE_NOT_FOUND',
          { benefitLineId, caseId }
        );
      }

      // Decision D14: organization-scoped existence check only — no
      // KPI-visibility check on the linker.
      const kpiResult = await client.query<{ kpi_id: string }>(
        `SELECT kpi_id FROM rvn_kpi_definitions WHERE kpi_id = $1 AND organization_id = $2`,
        [kpiId, organizationId]
      );
      if (!kpiResult.rows[0]) {
        throw new RoiBenefitEvidenceLinkValidationError(
          `KPI ${kpiId} not found in organization ${organizationId}`,
          'KPI_NOT_FOUND',
          { kpiId }
        );
      }
      const versionResult = await client.query<{ definition_version_id: string }>(
        `SELECT definition_version_id FROM rvn_kpi_definition_versions
          WHERE definition_version_id = $1 AND kpi_id = $2 AND organization_id = $3`,
        [pinnedKpiDefinitionVersionId, kpiId, organizationId]
      );
      if (!versionResult.rows[0]) {
        throw new RoiBenefitEvidenceLinkValidationError(
          `KPI definition version ${pinnedKpiDefinitionVersionId} not found for KPI ${kpiId}`,
          'KPI_DEFINITION_VERSION_NOT_FOUND',
          { kpiId, pinnedKpiDefinitionVersionId }
        );
      }

      const insertResult = await client.query<RoiBenefitEvidenceLinkRow>(
        `INSERT INTO rvn_roi_benefit_evidence_links
           (benefit_line_id, case_id, organization_id, kpi_id, pinned_kpi_definition_version_id,
            expected_unit, purpose, linked_by, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          benefitLineId,
          caseId,
          organizationId,
          kpiId,
          pinnedKpiDefinitionVersionId,
          expectedUnit,
          purpose,
          actorUserId,
          notes,
          actorUserId,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[addBenefitEvidenceLink] insert returned no row');
      return toRoiBenefitEvidenceLink(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { link: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.benefit_evidence_link_added',
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
        payload: { caseId, benefitLineId, linkId: result.linkId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// removeBenefitEvidenceLink / flagBenefitEvidenceLinkDisputed — shared loader
// ==========================================

async function loadEvidenceLinkForUpdate(
  client: PoolClient,
  linkId: string,
  organizationId: string
): Promise<RoiBenefitEvidenceLinkRow | undefined> {
  const result = await client.query<RoiBenefitEvidenceLinkRow>(
    `SELECT * FROM rvn_roi_benefit_evidence_links WHERE link_id = $1 AND organization_id = $2 FOR UPDATE`,
    [linkId, organizationId]
  );
  return result.rows[0];
}
const evidenceLinkRowVersion = (row: RoiBenefitEvidenceLinkRow) => row.row_version;

export interface RemoveBenefitEvidenceLinkInput {
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

/** Hard delete — `rvn_roi_benefit_evidence_links` has no `deleted_at` column
 * (design §3 DDL); a link is pure metadata about a relationship, not an
 * independent financial fact requiring soft-delete's audit trail (Decision
 * D6 is scoped to assumptions/cost/benefit lines/scenarios). */
export async function removeBenefitEvidenceLink(
  input: RemoveBenefitEvidenceLinkInput
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

  return executeAtomicCommand<RoiBenefitEvidenceLinkRow, { linkId: string }>({
    organizationId,
    aggregateId: linkId,
    expectedVersion,
    loadForUpdate: loadEvidenceLinkForUpdate,
    getCurrentVersion: evidenceLinkRowVersion,
    applyMutation: async (client, currentRow, _nextVersion) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'removeBenefitEvidenceLink');
      beforeState = { link: toRoiBenefitEvidenceLink(currentRow) };
      await client.query(`DELETE FROM rvn_roi_benefit_evidence_links WHERE link_id = $1`, [linkId]);
      return { linkId };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { link: null };
      return {
        schemaVersion: 1,
        eventType: 'roi.benefit_evidence_link_removed',
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

// ==========================================
// flagBenefitEvidenceLinkDisputed
// ==========================================

export interface FlagBenefitEvidenceLinkDisputedInput {
  linkId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  disputeStatus: 'none' | 'stale' | 'disputed';
  notes?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** Not gated by `NON_EDITABLE_STATUSES`/case-editable — flagging a link
 * stale/disputed is an evidence-quality signal, legitimately raised at any
 * point in the case's lifecycle (including post-approval, mirroring
 * `double_counting_resolution_note`'s own "stays editable" carve-out). */
export async function flagBenefitEvidenceLinkDisputed(
  input: FlagBenefitEvidenceLinkDisputedInput
): Promise<AtomicCommandOutcome<RoiBenefitEvidenceLink>> {
  const {
    linkId,
    caseId,
    organizationId,
    expectedVersion,
    disputeStatus,
    notes,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiBenefitEvidenceLinkRow, RoiBenefitEvidenceLink>({
    organizationId,
    aggregateId: linkId,
    expectedVersion,
    loadForUpdate: loadEvidenceLinkForUpdate,
    getCurrentVersion: evidenceLinkRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      beforeState = { link: toRoiBenefitEvidenceLink(currentRow) };
      const mergedNotes = notes !== undefined ? notes : currentRow.notes;
      const updateResult = await client.query<RoiBenefitEvidenceLinkRow>(
        `UPDATE rvn_roi_benefit_evidence_links
            SET dispute_status = $1, notes = $2, freshness_checked_at = now(),
                row_version = $3, updated_at = now()
          WHERE link_id = $4
          RETURNING *`,
        [disputeStatus, mergedNotes, nextVersion, linkId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[flagBenefitEvidenceLinkDisputed] update returned no row for ${linkId}`);
      return toRoiBenefitEvidenceLink(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { link: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.benefit_evidence_link_disputed',
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
        payload: { caseId, linkId },
      } satisfies AtomicEventInput;
    },
  });
}
