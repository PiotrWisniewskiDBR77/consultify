/**
 * AssessmentReportView — local types.
 *
 * ★ WHY THESE TYPES EXIST SEPARATELY FROM `@/method-core/api/methodCoreApi`:
 * that file's exported `MethodOutputSummary` is a NARROWED client-side type
 * (no `aggregation`, `evidenceCompleteness`, `demoBypassActive`, per-finding
 * `supportingEvidence`/`confidence`/`riskOrOpportunity`/etc). The SERVER
 * handler (`GET /api/method/outputs/:id`, server/src/routes/method-core.
 * routes.ts:1280-1293) actually calls `methodOutputService.getOutput()` and
 * JSON-serializes the FULL `MethodOutputRecord`
 * (server/src/method-core/outputs/MethodOutputService.ts) — every field
 * below is really on the wire, just not reflected in the narrower client
 * type. Verified by reading the service's `toOutputRecord`/`toFindingRecord`
 * mappers, not guessed. This report renders straight from the real payload,
 * so it needs the real shape — hence a local, honest supertype instead of a
 * silent `as any`.
 *
 * This report is a RENDERER, not a calculator: every field here is read
 * VERBATIM from what the kernel already froze (`method_outputs` /
 * `method_findings`) or from adjacent, already-persisted, immutable facts
 * (session metadata, the approval trail). Nothing here is recomputed from
 * `method_events` or re-scored against the method pack.
 */

export type EvidenceStrength = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

export interface ReportEvidenceLocator {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly strength: EvidenceStrength;
  readonly locator: string;
  readonly title?: string;
}

export interface ReportFinding {
  readonly id: string;
  readonly outputId: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly supportingEvidence: readonly ReportEvidenceLocator[];
  readonly contradictingEvidence: readonly ReportEvidenceLocator[];
  readonly businessMeaning: string;
  readonly rootCauseHypothesis: string | null;
  readonly riskOrOpportunity: string | null;
  readonly recommendation: string;
  readonly prerequisite: string | null;
  readonly expectedOutcome: string | null;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly priorityRationale: string | null;
  readonly sourceLocators: readonly string[];
  readonly createdAt: string;
}

export interface ReportEvidenceCompleteness {
  readonly totalUnits: number;
  readonly unitsWithAcceptedEvidence: number;
  readonly unitsMissingEvidence: number;
  readonly completenessRatio: number;
}

export interface ReportAggregation {
  readonly byGroup: Record<string, number | null>;
  /** Cross-axis-comparable normalised twin, when the adapter provides one
   * (COORD-11 / drdAdapter.aggregate) — `(level-1)/(Lmax-1)`. May be absent
   * on older/other-method Outputs; never fabricated when missing. */
  readonly byGroupNorm?: Record<string, number | null>;
  readonly mappingVersion: string;
  readonly rule: string;
  readonly excluded: Record<string, string>;
}

/** The full, immutable Output record as it actually comes over the wire
 * from `GET /api/method/outputs/:id` (see header comment). */
export interface FullAssessmentOutput {
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
  readonly current: Record<string, number | null>;
  readonly target: Record<string, number | null>;
  readonly gap: Record<string, number | null>;
  readonly aggregation: ReportAggregation | null;
  readonly visualModel: unknown;
  readonly evidenceCompleteness: ReportEvidenceCompleteness | null;
  readonly limitations: readonly string[];
  readonly findings: readonly ReportFinding[];
  readonly prioritisationResult: unknown;
  readonly sourceRevisionOfSessionId: string | null;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly frozenAt: string;
  readonly demoBypassActive: boolean;
}

export interface ReportSessionMeta {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string | null;
  readonly module: 'assessment' | 'tools' | 'audits';
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly state: string;
  readonly domainStage: string | null;
  readonly mode: 'guided_manual' | 'teresa_led';
  readonly ownerUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface ReportApproval {
  readonly id: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly decision: 'approved' | 'sent_back';
  readonly comment: string | null;
  readonly actorUserId: string;
  readonly createdAt: string;
}

/** Everything the presentational document needs, already resolved — the
 * container's one job is to produce this bag (or explain why it can't). */
export interface AssessmentReportData {
  readonly output: FullAssessmentOutput;
  readonly superseded: boolean;
  readonly supersededByOutputId: string | null;
  readonly session: ReportSessionMeta | null;
  readonly approvals: readonly ReportApproval[];
}
