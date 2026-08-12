/**
 * ROI-E002 — benefit-line command layer (`addBenefitLine`/`updateBenefitLine`/
 * `removeBenefitLine`).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4.
 * Schema: server/migrations/20260816_rvn_roi_economic_model.sql.
 *
 * `addBenefitLine`/`updateBenefitLine` enforce, in `applyMutation`, the
 * cross-field rule the design calls out explicitly: `isFinancial=true`
 * requires `amount`/`currency`; `isFinancial=false` requires `amount IS
 * NULL`. The DB constraint (`chk_rvn_roi_benefit_lines_financial_amount`)
 * is the backstop for the second half; this command-layer check gives a
 * clean typed error instead of a raw Postgres 23514 for BOTH halves.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { RoiEconomicModelNotEditableError } from './roiCalculationPolicyCommands.js';
import { NON_EDITABLE_STATUSES, ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import {
  toRoiBenefitLine,
  type RoiBenefitLine,
  type RoiBenefitLineRow,
  type RoiConfidenceLevel,
  type RoiRecurrenceCadence,
  type RoiTimingType,
} from './roiEconomicModelTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiBenefitLineFrozenError extends Error {
  code = 'BENEFIT_LINE_FROZEN';
  details: Record<string, unknown>;
  constructor(benefitLineId: string) {
    super(`ROI benefit line ${benefitLineId} is frozen — cannot be edited`);
    this.name = 'RoiBenefitLineFrozenError';
    this.details = { benefitLineId };
  }
}

export class RoiBenefitLineValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_BENEFIT_LINE', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiBenefitLineValidationError';
    this.code = code;
    this.details = details;
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_BENEFIT_LINE_CAPABILITIES = {
  add: 'results.roi.benefit_line.add',
  update: 'results.roi.benefit_line.update',
  remove: 'results.roi.benefit_line.remove',
} as const;

/** RN-G5: authorization runs FIRST — same rationale as roiAssumptionCommands.ts's
 * identical helper (that file's own doc comment has the full rationale). */
async function assertCaseEditableForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string,
  op: string,
  auth: { access: CommandAccessContext; actorUserId: string; capability: string }
): Promise<void> {
  const caseResult = await client.query<{ status: string; owner_user_id: string }>(
    `SELECT status, owner_user_id FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) {
    throw new Error(`[${op}] case ${caseId} not found`);
  }

  assertCommandCapability({
    access: auth.access,
    actorUserId: auth.actorUserId,
    capability: auth.capability,
    responsibleUserIds: [caseRow.owner_user_id],
  });

  if (NON_EDITABLE_STATUSES.includes(caseRow.status as (typeof NON_EDITABLE_STATUSES)[number])) {
    throw new RoiEconomicModelNotEditableError(caseId, caseRow.status);
  }
}

/** Design §4: isFinancial=true requires amount/currency; isFinancial=false
 * requires amount IS NULL — a clean typed 4xx instead of a raw 23514. */
function assertFinancialAmountRule(isFinancial: boolean, amount: number | null, currency: string | null): void {
  if (isFinancial) {
    if (amount === null || currency === null) {
      throw new RoiBenefitLineValidationError(
        'A financial benefit line requires both amount and currency',
        'FINANCIAL_BENEFIT_MISSING_AMOUNT',
        { isFinancial, amount, currency }
      );
    }
  } else if (amount !== null) {
    throw new RoiBenefitLineValidationError(
      'A non-financial benefit line must not carry an amount (honest N/A, not a fabricated $0)',
      'NON_FINANCIAL_BENEFIT_HAS_AMOUNT',
      { isFinancial, amount }
    );
  }
}

// ==========================================
// addBenefitLine
// ==========================================

export interface AddBenefitLineInput {
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  description?: string | null;
  isFinancial?: boolean;
  amount?: number | null;
  currency?: string | null;
  timingType: RoiTimingType;
  oneTimePeriodDate?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceCadence?: RoiRecurrenceCadence | null;
  rampPeriods?: number | null;
  doubleCountingGroup?: string | null;
  doubleCountingResolutionNote?: string | null;
  confidence?: RoiConfidenceLevel | null;
  source?: string | null;
  ownerUserId?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function addBenefitLine(input: AddBenefitLineInput): Promise<AtomicCommandOutcome<RoiBenefitLine>> {
  const {
    caseId,
    organizationId,
    category,
    label,
    description = null,
    isFinancial = true,
    amount = null,
    currency = null,
    timingType,
    oneTimePeriodDate = null,
    recurrenceStartDate = null,
    recurrenceEndDate = null,
    recurrenceCadence = null,
    rampPeriods = null,
    doubleCountingGroup = null,
    doubleCountingResolutionNote = null,
    confidence = null,
    source = null,
    ownerUserId = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  assertFinancialAmountRule(isFinancial, amount, currency);

  return executeAtomicCreate<RoiBenefitLine>({
    organizationId,
    applyMutation: async (client) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'addBenefitLine', {
        access,
        actorUserId,
        capability: ROI_BENEFIT_LINE_CAPABILITIES.add,
      });

      const insertResult = await client.query<RoiBenefitLineRow>(
        `INSERT INTO rvn_roi_benefit_lines
           (case_id, organization_id, category, label, description, is_financial, amount, currency,
            timing_type, one_time_period_date, recurrence_start_date, recurrence_end_date, recurrence_cadence,
            ramp_periods, double_counting_group, double_counting_resolution_note,
            confidence, source, owner_user_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING *`,
        [
          caseId,
          organizationId,
          category,
          label,
          description,
          isFinancial,
          amount,
          currency,
          timingType,
          oneTimePeriodDate,
          recurrenceStartDate,
          recurrenceEndDate,
          recurrenceCadence,
          rampPeriods,
          doubleCountingGroup,
          doubleCountingResolutionNote,
          confidence,
          source,
          ownerUserId,
          actorUserId,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[addBenefitLine] insert returned no row');
      return toRoiBenefitLine(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { benefitLine: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.benefit_line_added',
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
        payload: { caseId, benefitLineId: result.benefitLineId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateBenefitLine / removeBenefitLine — shared row loader
// ==========================================

async function loadBenefitLineForUpdate(
  client: PoolClient,
  benefitLineId: string,
  organizationId: string
): Promise<RoiBenefitLineRow | undefined> {
  const result = await client.query<RoiBenefitLineRow>(
    `SELECT * FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1 AND organization_id = $2 FOR UPDATE`,
    [benefitLineId, organizationId]
  );
  return result.rows[0];
}
const benefitLineRowVersion = (row: RoiBenefitLineRow) => row.row_version;

export interface UpdateBenefitLineInput {
  benefitLineId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  category?: string;
  label?: string;
  description?: string | null;
  isFinancial?: boolean;
  amount?: number | null;
  currency?: string | null;
  timingType?: RoiTimingType;
  oneTimePeriodDate?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceCadence?: RoiRecurrenceCadence | null;
  rampPeriods?: number | null;
  doubleCountingGroup?: string | null;
  doubleCountingResolutionNote?: string | null;
  confidence?: RoiConfidenceLevel | null;
  source?: string | null;
  ownerUserId?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function updateBenefitLine(input: UpdateBenefitLineInput): Promise<AtomicCommandOutcome<RoiBenefitLine>> {
  const {
    benefitLineId,
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
    ...edits
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiBenefitLineRow, RoiBenefitLine>({
    organizationId,
    aggregateId: benefitLineId,
    expectedVersion,
    loadForUpdate: loadBenefitLineForUpdate,
    getCurrentVersion: benefitLineRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // double_counting_resolution_note is deliberately NOT gated by the
      // frozen check below the same way other fields are — the DB trigger
      // itself already permits editing that one column post-freeze (design
      // §3's own comment); this command-layer guard mirrors that by still
      // allowing the UPDATE through even when frozen, PROVIDED every other
      // field is unchanged. Simpler and safer: block the whole command when
      // frozen UNLESS the only field being edited is the resolution note.
      const onlyResolutionNoteChanging =
        edits.doubleCountingResolutionNote !== undefined &&
        Object.keys(edits).every((k) => k === 'doubleCountingResolutionNote');
      if (currentRow.frozen_at !== null && !onlyResolutionNoteChanging) {
        throw new RoiBenefitLineFrozenError(benefitLineId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'updateBenefitLine', {
        access,
        actorUserId,
        capability: ROI_BENEFIT_LINE_CAPABILITIES.update,
      });

      beforeState = { benefitLine: toRoiBenefitLine(currentRow) };

      const merged = {
        category: edits.category ?? currentRow.category,
        label: edits.label ?? currentRow.label,
        description: edits.description !== undefined ? edits.description : currentRow.description,
        is_financial: edits.isFinancial !== undefined ? edits.isFinancial : currentRow.is_financial,
        amount: edits.amount !== undefined ? edits.amount : currentRow.amount,
        currency: edits.currency !== undefined ? edits.currency : currentRow.currency,
        timing_type: edits.timingType ?? currentRow.timing_type,
        one_time_period_date:
          edits.oneTimePeriodDate !== undefined ? edits.oneTimePeriodDate : currentRow.one_time_period_date,
        recurrence_start_date:
          edits.recurrenceStartDate !== undefined ? edits.recurrenceStartDate : currentRow.recurrence_start_date,
        recurrence_end_date:
          edits.recurrenceEndDate !== undefined ? edits.recurrenceEndDate : currentRow.recurrence_end_date,
        recurrence_cadence:
          edits.recurrenceCadence !== undefined ? edits.recurrenceCadence : currentRow.recurrence_cadence,
        ramp_periods: edits.rampPeriods !== undefined ? edits.rampPeriods : currentRow.ramp_periods,
        double_counting_group:
          edits.doubleCountingGroup !== undefined ? edits.doubleCountingGroup : currentRow.double_counting_group,
        double_counting_resolution_note:
          edits.doubleCountingResolutionNote !== undefined
            ? edits.doubleCountingResolutionNote
            : currentRow.double_counting_resolution_note,
        confidence: edits.confidence !== undefined ? edits.confidence : currentRow.confidence,
        source: edits.source !== undefined ? edits.source : currentRow.source,
        owner_user_id: edits.ownerUserId !== undefined ? edits.ownerUserId : currentRow.owner_user_id,
      };

      assertFinancialAmountRule(
        merged.is_financial,
        merged.amount === null ? null : Number(merged.amount),
        merged.currency
      );

      const updateResult = await client.query<RoiBenefitLineRow>(
        `UPDATE rvn_roi_benefit_lines
            SET category = $1, label = $2, description = $3, is_financial = $4, amount = $5, currency = $6,
                timing_type = $7, one_time_period_date = $8, recurrence_start_date = $9, recurrence_end_date = $10,
                recurrence_cadence = $11, ramp_periods = $12, double_counting_group = $13,
                double_counting_resolution_note = $14, confidence = $15, source = $16, owner_user_id = $17,
                row_version = $18, updated_at = now()
          WHERE benefit_line_id = $19
          RETURNING *`,
        [
          merged.category,
          merged.label,
          merged.description,
          merged.is_financial,
          merged.amount,
          merged.currency,
          merged.timing_type,
          merged.one_time_period_date,
          merged.recurrence_start_date,
          merged.recurrence_end_date,
          merged.recurrence_cadence,
          merged.ramp_periods,
          merged.double_counting_group,
          merged.double_counting_resolution_note,
          merged.confidence,
          merged.source,
          merged.owner_user_id,
          nextVersion,
          benefitLineId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[updateBenefitLine] update returned no row for ${benefitLineId}`);
      return toRoiBenefitLine(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { benefitLine: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.benefit_line_updated',
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
        payload: { caseId, benefitLineId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// removeBenefitLine (soft delete)
// ==========================================

export interface RemoveBenefitLineInput {
  benefitLineId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function removeBenefitLine(input: RemoveBenefitLineInput): Promise<AtomicCommandOutcome<RoiBenefitLine>> {
  const {
    benefitLineId,
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiBenefitLineRow, RoiBenefitLine>({
    organizationId,
    aggregateId: benefitLineId,
    expectedVersion,
    loadForUpdate: loadBenefitLineForUpdate,
    getCurrentVersion: benefitLineRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.frozen_at !== null) {
        throw new RoiBenefitLineFrozenError(benefitLineId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'removeBenefitLine', {
        access,
        actorUserId,
        capability: ROI_BENEFIT_LINE_CAPABILITIES.remove,
      });

      beforeState = { benefitLine: toRoiBenefitLine(currentRow) };

      const updateResult = await client.query<RoiBenefitLineRow>(
        `UPDATE rvn_roi_benefit_lines
            SET deleted_at = now(), deleted_by = $1, row_version = $2, updated_at = now()
          WHERE benefit_line_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, benefitLineId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[removeBenefitLine] update returned no row for ${benefitLineId}`);
      return toRoiBenefitLine(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { benefitLine: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.benefit_line_removed',
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
        payload: { caseId, benefitLineId },
      } satisfies AtomicEventInput;
    },
  });
}
