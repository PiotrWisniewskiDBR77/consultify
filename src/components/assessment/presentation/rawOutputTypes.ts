/**
 * RawAssessmentOutputRecord — the JSON shape actually returned by
 * `GET /api/method/outputs/:id` (`server/src/routes/method-core.routes.ts`
 * → `MethodOutputService.getOutput` → `toOutputRecord`, see
 * `server/src/method-core/outputs/MethodOutputService.ts`).
 *
 * ★ Why this exists instead of reusing `MethodOutputSummary` from
 * `@/method-core/api/methodCoreApi`: that client type is a DELIBERATELY
 * NARROWED subset (current/target/gap/limitations/findings-lite) used by the
 * Outputs list/preview tab — it does not declare `aggregation`,
 * `evidenceCompleteness`, `methodPackId`/`methodPackVersion` nesting, or the
 * full per-finding evidence fields the server actually sends. The real HTTP
 * response is the server's `MethodOutputRecord` (flat `methodPackId` /
 * `methodPackVersion` / `outputVersion`, not the nested `methodology`/
 * `version` used by the CLIENT-SIDE pure `AssessmentOutput` type in
 * `@/method-core/outputs/types.ts`). This presentation surface needs the
 * FULL record (overall result, per-dimension aggregation, evidence
 * completeness) to build 9 honest slides without recomputing any score
 * itself — see `outputAdapter.ts`, which reshapes this into the pure
 * `AssessmentOutput` shape so the kernel's own `buildReportSnapshot`/
 * `buildPresentationView` (`@/method-core/outputs`) can do the (already
 * canon, already-reviewed) derivation math, never this package.
 */

export type RawEvidenceType =
  | 'document'
  | 'system_record'
  | 'metric'
  | 'demonstration'
  | 'observation'
  | 'interview_statement'
  | 'media'
  | 'external_source';

export interface RawEvidenceLocator {
  readonly evidenceId: string;
  readonly evidenceType: RawEvidenceType;
  readonly strength: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  readonly locator: string;
  readonly title?: string;
}

export interface RawFinding {
  readonly id: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly supportingEvidence: readonly RawEvidenceLocator[];
  readonly contradictingEvidence: readonly RawEvidenceLocator[];
  readonly businessMeaning: string;
  readonly rootCauseHypothesis?: string | null;
  readonly riskOrOpportunity?: string | null;
  readonly recommendation: string;
  readonly prerequisite?: string | null;
  readonly expectedOutcome?: string | null;
  readonly kpiProposal?: unknown;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly priorityRationale?: string | null;
  readonly sourceLocators?: readonly string[];
}

export interface RawAggregationResult {
  readonly byGroup: Readonly<Record<string, number | null>>;
  readonly byGroupNorm?: Readonly<Record<string, number | null>>;
  readonly mappingVersion: string;
  readonly rule: string;
  readonly excluded?: Readonly<Record<string, string>>;
}

/**
 * ★ Known aggregation limitation (flagged 2026-08-13, coordinator + this
 * worker): `unitsMissingEvidence` collapses `dont_know` and `no_evidence`
 * answer states into ONE bucket before the Output is frozen
 * (`drdAdapter.ts`'s level-evaluation loop treats both as
 * `levelBlockedByMissing`) — an honest "we don't know" and a "we know but
 * haven't documented it" are indistinguishable in a bare frozen Output.
 * `unitsMissingEvidenceBreakdown` is a FORWARD-COMPATIBLE, OPTIONAL field:
 * if a future Output contract carries a per-reason split, this adapter
 * picks it up automatically (see `outputAdapter.ts`'s
 * `extractUnknownReasonBreakdown`); until then it is simply absent and
 * `slides.tsx`'s "Obszary bez dowodu" slide renders the single aggregated
 * count with an explicit disclaimer instead of guessing. Field name is
 * this worker's best-effort placeholder, not an agreed contract — whoever
 * lands the real breakdown on the Output should reconcile the name here.
 */
export interface RawUnknownReasonBreakdown {
  readonly dontKnow: number;
  readonly noEvidence: number;
  readonly other?: number;
}

export interface RawEvidenceCompleteness {
  readonly totalUnits: number;
  readonly unitsWithAcceptedEvidence: number;
  readonly unitsMissingEvidence: number;
  readonly completenessRatio: number;
  readonly unitsMissingEvidenceBreakdown?: RawUnknownReasonBreakdown;
}

export interface RawVisualModel {
  readonly kind: 'matrix' | 'radar' | 'heatmap' | 'gap_chart';
  readonly dataRef: Readonly<Record<string, number | null>>;
}

/** Server's `MethodOutputRecord` (see MethodOutputService.ts) — the actual
 * `output` field of `GET /api/method/outputs/:id`'s JSON body. */
export interface RawAssessmentOutputRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly module: 'assessment' | 'tools' | 'audits';
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly outputVersion: number;
  readonly revisionOfOutputId: string | null;
  readonly scope: string;
  readonly current: Readonly<Record<string, number | null>>;
  readonly target: Readonly<Record<string, number | null>>;
  readonly gap: Readonly<Record<string, number | null>>;
  readonly aggregation: RawAggregationResult;
  readonly visualModel?: RawVisualModel;
  readonly evidenceCompleteness: RawEvidenceCompleteness;
  readonly limitations: readonly string[];
  readonly findings: readonly RawFinding[];
  readonly prioritisationResult?: unknown;
  readonly sourceRevisionOfSessionId?: string | null;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly frozenAt: string;
  readonly demoBypassActive?: boolean;
}

export interface RawGetOutputResponse {
  readonly output: RawAssessmentOutputRecord;
  readonly superseded: boolean;
  readonly supersededByOutputId: string | null;
}
