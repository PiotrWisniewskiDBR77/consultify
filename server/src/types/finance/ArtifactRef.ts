/**
 * AP-00 — ArtifactRef: a typed reference to any Finance artifact.
 *
 * Program: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
 * section 5 (AP-00). ADR: `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md`.
 *
 * `artifactType` uses the SAME six literal values as the already-shipped
 * `finance_artifacts.artifact_type` CHECK constraint
 * (`server/migrations/20260809_finance_v3_b01_core_artifacts.sql` lines
 * 46-49) and `FinanceArtifactType` in
 * `server/src/services/finance/canonical/lifecycleService.ts` — NOT the
 * lowercase shorthand (`statement_pack`/`analysis`/`baseline_model`/
 * `scenario`/`valuation`) used in this work package's own task brief. See
 * the ADR section "Decisions / judgment calls" for why: those five
 * shorthand names don't match the real, already-tested database enum (which
 * also has six values, not five — `REPORT_EXPORT` is a real, addressable
 * artifact type today and excluding it would make ArtifactRef unable to
 * address an entire already-shipped class of artifacts).
 */

import { z } from 'zod';

import type { FinanceArtifactType as CanonicalFinanceArtifactType } from '../../services/finance/canonical/lifecycleService.js';

// ---------------------------------------------------------------------------
// artifact_type enum mirror
// ---------------------------------------------------------------------------

export const FinanceArtifactTypeValues = [
  'STATEMENT_PACK',
  'HISTORICAL_ANALYSIS',
  'BASELINE_MODEL',
  'PREDICTION_SCENARIO',
  'VALUATION_CASE',
  'REPORT_EXPORT',
] as const;
export type FinanceArtifactType = (typeof FinanceArtifactTypeValues)[number];

// Compile-time proof the locally-declared literal union here stays in sync
// with `lifecycleService.ts`'s independently-declared union (see that file's
// comment; this file intentionally does not import the runtime type from a
// service module to keep `server/src/types/*` dependency-free of
// `server/src/services/*`, mirroring the rest of this directory's
// convention). If either union ever drifts, one of the two assignments below
// stops compiling.
type _AssertArtifactTypeSuperset = FinanceArtifactType extends CanonicalFinanceArtifactType ? true : never;
type _AssertArtifactTypeSubset = CanonicalFinanceArtifactType extends FinanceArtifactType ? true : never;
const _artifactTypeSyncCheckA: _AssertArtifactTypeSuperset = true;
const _artifactTypeSyncCheckB: _AssertArtifactTypeSubset = true;
void _artifactTypeSyncCheckA;
void _artifactTypeSyncCheckB;

export const FinanceArtifactTypeSchema = z.enum(FinanceArtifactTypeValues);

// ---------------------------------------------------------------------------
// ArtifactRef — discriminated union on `artifactType`.
//
// Every branch is currently structurally identical to the shared base
// (organizationId/artifactId/businessVersionId/naturalKey). This is
// deliberate, not an oversight: WP-D02 (Historical Analysis), WP-D03
// (Baseline Models), WP-D04 (Prediction) and WP-D05 (Enterprise Valuation)
// have not been designed yet (only WP-D01 Statements exists at the time of
// this ADR), so this file does not pre-invent type-specific fields (e.g. a
// PredictionScenarioArtifactRef `scenarioKind: 'BASE'|'UPSIDE'|'DOWNSIDE'`)
// those future ADRs haven't committed to — the same "don't design what a
// future work package owns" discipline WP-D01 section 10.4 documents for
// its own rejected roll-forward generalization. The discriminated union
// exists so each branch CAN independently grow such fields later without a
// breaking change to any exhaustive `switch (ref.artifactType)` a consumer
// writes today.
// ---------------------------------------------------------------------------

const artifactRefBase = z.object({
  organizationId: z.string().min(1),
  artifactId: z.string().min(1),
  businessVersionId: z.string().min(1),
  /** Mirrors `finance_artifacts.natural_key` (nullable at the DB layer too). */
  naturalKey: z.string().min(1).nullable(),
});

export const statementPackArtifactRefSchema = artifactRefBase.extend({ artifactType: z.literal('STATEMENT_PACK') });
export const historicalAnalysisArtifactRefSchema = artifactRefBase.extend({ artifactType: z.literal('HISTORICAL_ANALYSIS') });
export const baselineModelArtifactRefSchema = artifactRefBase.extend({ artifactType: z.literal('BASELINE_MODEL') });
export const predictionScenarioArtifactRefSchema = artifactRefBase.extend({ artifactType: z.literal('PREDICTION_SCENARIO') });
export const valuationCaseArtifactRefSchema = artifactRefBase.extend({ artifactType: z.literal('VALUATION_CASE') });
export const reportExportArtifactRefSchema = artifactRefBase.extend({ artifactType: z.literal('REPORT_EXPORT') });

export const ArtifactRefSchema = z.discriminatedUnion('artifactType', [
  statementPackArtifactRefSchema,
  historicalAnalysisArtifactRefSchema,
  baselineModelArtifactRefSchema,
  predictionScenarioArtifactRefSchema,
  valuationCaseArtifactRefSchema,
  reportExportArtifactRefSchema,
]);
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

export type StatementPackArtifactRef = z.infer<typeof statementPackArtifactRefSchema>;
export type HistoricalAnalysisArtifactRef = z.infer<typeof historicalAnalysisArtifactRefSchema>;
export type BaselineModelArtifactRef = z.infer<typeof baselineModelArtifactRefSchema>;
export type PredictionScenarioArtifactRef = z.infer<typeof predictionScenarioArtifactRefSchema>;
export type ValuationCaseArtifactRef = z.infer<typeof valuationCaseArtifactRefSchema>;
export type ReportExportArtifactRef = z.infer<typeof reportExportArtifactRefSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isArtifactRefOfType<T extends FinanceArtifactType>(
  ref: ArtifactRef,
  artifactType: T
): ref is Extract<ArtifactRef, { artifactType: T }> {
  return ref.artifactType === artifactType;
}

/** Stable cache key for React Query / grid state maps. Deliberately NOT the artifactId alone — a reopened Draft has a new businessVersionId while artifactId stays constant, and most Analyst Productivity state (selection, filters, unsaved ops) is scoped to one specific business version, not the artifact identity. */
export function artifactRefKey(ref: Pick<ArtifactRef, 'artifactType' | 'businessVersionId'>): string {
  return `${ref.artifactType}:${ref.businessVersionId}`;
}

export type ArtifactRefParseResult =
  | { ok: true; ref: ArtifactRef }
  | { ok: false; code: 'INVALID_ARTIFACT_REF'; message: string };

/** Runtime validation entry point — mirrors the `{ ok }` result convention used throughout `server/src/services/finance/canonical/*.ts` rather than throwing. */
export function parseArtifactRef(input: unknown): ArtifactRefParseResult {
  const result = ArtifactRefSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, code: 'INVALID_ARTIFACT_REF', message: result.error.message };
  }
  return { ok: true, ref: result.data };
}
