/**
 * P08 Teresa Copilot Canon
 *
 * Frozen contract from FINAL_IMPLEMENTATION_PLAN_08_TERESA §2.3.
 *
 * Teresa is a contextual copilot — she proposes, the user approves,
 * the target module executes. No silent writes, no autonomous engine.
 *
 * Sections:
 *   §2.3.1 — P0 handoff targets + required context payload
 *   §2.3.2 — Action governance envelope
 *   §2.3.3 — Voice posture
 *   §2.3.4 — Evidence / citations posture
 *   §2.3.5 — Hard boundaries (Teresa vs Anna) + module-owned writes
 *   §2.3.6 — Anti-duplicate gate
 *   §2.3.7 — Degraded / error posture (10 scenarios)
 *   §2.3.8 — Acceptance checklist (12 items)
 */

// ────────────────────────────────────────────────────────────────
// §2.3.1 — Handoff targets + required context payload
// ────────────────────────────────────────────────────────────────

export const P08_COPILOT_CONTRACT = 'teresa_copilot_v1';

export type HandoffTargetModule =
  | 'radar'
  | 'initiatives'
  | 'calendar'
  | 'notebook'
  | 'interview'
  | 'excele'
  | 'ideas'
  | 'results'
  | 'kpi'
  | 'roi'
  | 'okr' // OKR-E008 — new slot, was never pre-reserved (unlike 'kpi'/'roi', both RN-G1 pre-reserved)
  | 'execution'
  | 'finance'
  | 'meeting'
  | 'outputs'
  | 'documents'
  | 'tables'
  | 'presentations';

export interface TeresaHandoffContext {
  origin: 'teresa';
  user_intent: string;
  active_surface: string;
  org_context_ref: string;
  operation_contract_ref?: string | null;
  runtime_binding?: {
    conversation_id?: string | null;
    session_id?: string | null;
    context_snapshot_id?: string | null;
    execution_run_id?: string | null;
    artifact_run_id?: string | null;
    tool_invocation_id?: string | null;
  };
  bounded_context_pack: Array<{
    ref: string;
    type: string;
    deeplink?: string | null;
  }>;
  constraints: string[];
  assumptions: string[];
  uncertainty_boundary: {
    missing_inputs: string[];
    conflicts: string[];
    what_would_change_next_action: string[];
  };
  evidence_pointers: string[];
  proposed_next_action: {
    target_module: HandoffTargetModule;
    handoff_intent: 'open' | 'create' | 'append';
    requires_approval: true;
  };
  audit_stub: {
    actor: string;
    timestamp: string;
    proposal_id?: string | null;
  };
}

export interface RadarHandoffPayload {
  why_now: string;
  time_window: string;
  triggered_rules: string[];
  evidence_pointers: string[];
  uncertainty_boundary: TeresaHandoffContext['uncertainty_boundary'];
  next_action_safe_fallback: string;
}

export interface InitiativesHandoffPayload {
  initiative_seed: {
    problem_statement: string;
    proposed_outcome: string;
    assumptions: string[];
    risks: string[];
    next_steps: string[];
    time_window?: string | null;
  };
  proposal_only: true;
}

export interface CalendarHandoffPayload {
  calendar_intent: {
    what: string;
    when: string;
    timezone: string;
  };
  permission_gradient_expectation: 'free_busy' | 'read' | 'write';
  conflict_safe_write_posture: 'if_match_etag' | 'deny';
  recovery_steps: string[];
}

export interface NotebookHandoffPayload {
  notebook_handoff_context: {
    title: string;
    body_preview: string;
    source: 'teresa' | 'user_edit' | 'ai_transform';
    /** #21: opcjonalny termin przypomnienia z „przypomnij mi …". */
    reminder?: { dueAt: string | null; term: string | null };
  };
  provenance_markers: {
    source: string;
    user_edit: boolean;
    ai_transform: boolean;
  };
  evidence_pointers: string[];
}

export interface InterviewHandoffPayload {
  interview_handoff_context: {
    action: 'generate_insight' | 'submit_review' | 'export_initiative' | 'view_evidence';
    session_ids?: string[];
    insight_id?: string;
    title?: string;
  };
  evidence_pointers: string[];
}

// ────────────────────────────────────────────────────────────────
// KPI-E006 — Results/KPI advisor handoff (three governed modes)
// ────────────────────────────────────────────────────────────────

export type ResultsKpiAdvisorMode =
  | 'draft_quality_review'   // KPI-F-027
  | 'check_in_manager_brief' // KPI-F-028
  | 'reflection_rca';        // KPI-F-030

export interface ResultsKpiEvidenceBreakdown {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

export interface KpiDraftQualityReviewPayload {
  proposed: {
    kpiCode: string;
    name: string;
    description: string | null;
    unit: string | null;
    targetGeometry: 'threshold_min' | 'threshold_max' | 'range' | 'exact' | 'binary' | 'custom';
    targetValue: number | null;
    targetMin: number | null;
    targetMax: number | null;
    warningLow: number | null;
    warningHigh: number | null;
    criticalLow: number | null;
    criticalHigh: number | null;
    binarySuccessValue: number | null;
    formulaText: string | null;
    ownerUserId: string | null;
  };
  quality_review: {
    purpose_question: string;
    actionability_question: string;
    owner_load_note: string | null;
    target_evidence_note: string | null;
    duplicate_risk: { candidate_kpi_ids: string[]; note: string | null };
  };
  evidence_breakdown: ResultsKpiEvidenceBreakdown;
}

export interface KpiCheckInManagerBriefPayload {
  scope: 'my_kpis' | 'team' | 'organization';
  cited_kpi_ids: string[];
  cited_deviation_case_ids: string[];
  narrative: string;
  evidence_breakdown: ResultsKpiEvidenceBreakdown;
}

export interface KpiReflectionRcaPayload {
  case_id: string;
  proposed_root_cause_summary: string;
  proposed_root_cause_category: string;
  recurrence_flag: boolean;
  evidence_breakdown: ResultsKpiEvidenceBreakdown;
}

export interface ResultsKpiHandoffContext {
  advisor_mode: ResultsKpiAdvisorMode;
  target_resource: {
    resource_type: 'kpi' | 'deviation_case';
    /** Decision #2: ALWAYS kpi_id (never definition_version_id) for the
     * 'kpi' resource_type — the handler resolves current_definition_version_id
     * internally via getKpi() when editing. null ONLY for draft_quality_review
     * on a brand-new KPI (create path). */
    resource_id: string | null;
  };
  expected_version: number | null; // null legal ONLY on the create path
  draft_quality_review?: KpiDraftQualityReviewPayload;
  check_in_manager_brief?: KpiCheckInManagerBriefPayload;
  reflection_rca?: KpiReflectionRcaPayload;
}

// ────────────────────────────────────────────────────────────────
// ROI-E008 — Results/ROI advisor handoff (one governed mode)
// ────────────────────────────────────────────────────────────────

export type ResultsRoiAdvisorMode =
  | 'pir_lessons_draft'; // ROI-E006 D13's deferred generation call — the ONLY named ROI advisor need

export interface RoiPirLessonsAdvisorEvidenceBreakdown {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

export interface RoiPirLessonsDraftPayload {
  draft_lessons_text: string;
  evidence_breakdown: RoiPirLessonsAdvisorEvidenceBreakdown;
  // Deliberately NOT draft_outcome/draft_recommendation: those stay
  // human-authored-only fields (the ROI-E006 PIR-draft-update command).
  // AC-06 of ROI-E006 names only "a Teresa-drafted LESSONS text" — do not
  // widen scope here.
}

export interface ResultsRoiHandoffContext {
  advisor_mode: ResultsRoiAdvisorMode;
  target_resource: {
    resource_type: 'roi_pir';
    resource_id: string; // pir_id — never null; the PIR must already exist
                          // (started via the ROI-E006 PIR-start command)
                          // before Teresa can draft lessons for it. No
                          // create path, unlike KPI's draft_quality_review.
  };
  case_id: string;
  expected_version: number; // PIR row_version — CAS, never null
  pir_lessons_draft?: RoiPirLessonsDraftPayload;
}

// ────────────────────────────────────────────────────────────────
// OKR-E008 — Results/OKR advisor handoff (three governed modes)
//
// IO-1 re-verification (done before writing this, since OKR_E008_DESIGN.md
// §3 was drafted against zero landed OKR code): the design proposed FIVE
// modes, one per literally-named ledger route
// (objective_draft/objective_quality_review/check_in_assist/manager_brief/
// reflection_synthesis). Direct re-read of EPIC_LEDGER_LIVE.md's real
// OKR-F-025/026/027 AC cells (the actual governing table, §0) shows the
// Command/query/API cells literally name only the ROUTE PAIRS — the same
// discipline KPI/ROI used ("count what the AC/plan actually names"), not a
// license to invent a 1:1 mode-per-route mapping when the underlying
// business capability is really narrower. Re-checked against the AC
// Requirement TEXT (not just the route list), mode by mode:
//   - objective_draft: BUILT. OKR-F-025's requirement text IS this vertical
//     slice, literally ("Objective → Teresa suggestion → accept/reject →
//     draft saved").
//   - objective_quality_review: BUILT. OKR-F-025's own Command/API cell
//     names `POST .../advisor/quality-review` as a second, distinct route
//     from `/advisor/draft` — real, narrative-only, real_entity:false.
//   - check_in_assist: BUILT. OKR-F-026's Command/API cell names
//     `POST .../advisor/check-in` as its own route, targeting OKR-E004's
//     now-landed `recordCheckIn` (okrCheckInCommands.ts).
//   - manager_brief: BUILT. OKR-F-026's Command/API cell names
//     `POST .../advisor/manager-brief` as its own route, citing OKR-E006's
//     now-landed `listOrganizationOkrAttention` (okrAttentionRepository.ts,
//     GET .../okr/attention) as its ONLY data source.
//   - reflection_synthesis: BUILT. OKR-F-027's requirement text is the
//     proposal-only reflection patch; OKR-E007's `okr_vnext_reflections`
//     landed with no Teresa draft columns reserved (unlike ROI-E006's PIR),
//     so OKR-E008 adds them (20260827_rvn_okr_teresa_reflection_draft.sql)
//     plus the write command (okrReflectionCommands.ts).
// All five modes survive re-verification against real, now-landed code —
// none were dropped. (KPI collapsed 5→3 and ROI collapsed to 1 because
// THEIR ledger cells named fewer distinct routes/capabilities; OKR's own
// cells name five, and five real capabilities exist behind them once
// E003/E004/E006/E007 are read directly instead of assumed.)
// ────────────────────────────────────────────────────────────────

export type ResultsOkrAdvisorMode =
  | 'objective_draft'          // OKR-F-025, POST .../advisor/draft
  | 'objective_quality_review' // OKR-F-025, POST .../advisor/quality-review
  | 'check_in_assist'          // OKR-F-026, POST .../advisor/check-in
  | 'manager_brief'            // OKR-F-026, POST .../advisor/manager-brief
  | 'reflection_synthesis';    // OKR-F-027, POST .../advisor/reflection

export interface ResultsOkrEvidenceBreakdown {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

/** Objective-only (no Key Results in the same call) — the AC's requirement
 * text is literally Objective-scoped; KRs are a human follow-on action via
 * the normal `POST .../objectives/:id/key-results` (OKR-E003), same as any
 * other Objective a human creates directly. Fields mirror `createObjective`'s
 * (okrObjectiveCommands.ts, OKR-E003) real, landed `CreateObjectiveInput`
 * shape exactly — `rationale` included since the real command accepts it,
 * a small addition over the design draft's own (pre-E003) guess. */
export interface OkrObjectiveDraftPayload {
  proposed: {
    setId: string;
    title: string;
    description: string | null;
    rationale: string | null;
    ambitionType: 'committed' | 'aspirational' | 'standard'; // OKR-F-007
    ownerUserId: string;
  };
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

/** Read+narrate only, `real_entity:false` in the response — reviews an
 * EXISTING Objective (human- or Teresa-drafted), never writes to
 * `okr_vnext_objectives`. Same shape as KPI's `draft_quality_review`
 * narrative-only sub-object. */
export interface OkrObjectiveQualityReviewPayload {
  objective_id: string;
  quality_review: {
    purpose_question: string;
    actionability_question: string;
    ambition_alignment_note: string | null;
    duplicate_risk: { candidate_objective_ids: string[]; note: string | null };
  };
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

/** Writes via OKR-E004's real `recordCheckIn` (okrCheckInCommands.ts).
 * DEVIATION FROM DESIGN: `cadenceOccurrenceId` is REQUIRED by the real,
 * landed `RecordCheckInInput`/`RecordOkrCheckInSchema` (a caller-resolved
 * UUID identifying which scheduled cadence occurrence this check-in
 * belongs to) — the design's own draft (written before OKR-E004 landed)
 * omitted it entirely. `proposed_value` must be cited from an
 * already-authorized source per OKR-F-025's domain-wide prohibition
 * ("Teresa nigdy nie wymyśla current value/progress/confidence/blocker") —
 * never a synthesized number; OKR-E004 landed no separate typed
 * suggested-value reference for Teresa to cite beyond the human-facing
 * `GET .../key-results/:id/suggested-value` endpoint, so `evidence_breakdown`
 * is what carries the citation obligation here. */
export interface OkrCheckInAssistPayload {
  key_result_id: string;
  cadence_occurrence_id: string;
  proposed_confidence: 'high' | 'medium' | 'low' | 'numeric' | null;
  proposed_confidence_numeric_value: number | null;
  proposed_value: number | null; // metric-type KR only; must cite evidence_breakdown, never fabricated
  note: string;
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

/** Read-only, `real_entity:false`. Cites OKR-E006's real, landed
 * `listOrganizationOkrAttention` (okrAttentionRepository.ts,
 * `GET .../okr/attention`) as its ONLY data source — never a raw query
 * Teresa builds itself (AC-026: "restricted data filtrowana PRZED
 * retrieval, nie redagowana po"). */
export interface OkrManagerBriefPayload {
  scope: 'my_sets' | 'team' | 'organization';
  cited_set_ids: string[];
  narrative: string;
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

/** Two-gate structure, mirrors ROI-E008's PIR lessons-draft exactly: Teresa
 * writes ONLY `teresa_draft_reflection_payload`/`teresa_draft_generated_at`
 * via the new `recordOkrReflectionTeresaDraft` (okrReflectionCommands.ts,
 * OKR-E008) — never `what_worked`/`what_did_not_work`/`why`/`learning`/
 * `next_cycle_change`/`disposition`. `set_id` is REQUIRED (a real
 * divergence from the design draft, which carried only `objective_id`) —
 * the reflection row may not exist yet when Teresa first drafts, and
 * `okr_vnext_reflections.set_id` is NOT NULL, so the create path needs it. */
export interface OkrReflectionSynthesisPayload {
  set_id: string;
  objective_id: string; // OKRReflection is Objective-scoped per OKR-F-021
  draft_reflection_text: string; // what worked / what didn't / why / lesson / change, Teresa's free-text synthesis
  proposed_disposition_hint: 'complete' | 'carry_forward' | 'drop' | 'redefine' | null; // advisory only, never auto-applied
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

export interface ResultsOkrHandoffContext {
  advisor_mode: ResultsOkrAdvisorMode;
  target_resource: {
    resource_type: 'okr_set' | 'okr_objective' | 'okr_key_result';
    resource_id: string | null; // null ONLY for objective_draft's create path
  };
  /** CAS precondition against the real target row's own `row_version` (or,
   * for `reflection_synthesis`, `okr_vnext_reflections.row_version` under
   * this file's own `expectedVersion=0` "no row yet" / `>=1` "CAS existing
   * row" convention — see okrReflectionCommands.ts). null legal ONLY on
   * objective_draft's create path. */
  expected_version: number | null;
  objective_draft?: OkrObjectiveDraftPayload;
  objective_quality_review?: OkrObjectiveQualityReviewPayload;
  check_in_assist?: OkrCheckInAssistPayload;
  manager_brief?: OkrManagerBriefPayload;
  reflection_synthesis?: OkrReflectionSynthesisPayload;
}

export const P08_HANDOFF_TARGETS = {
  radar: {
    module: 'Radar' as const,
    contract_ref: 'P06',
    description: 'Triage cockpit / why-now → next action',
    required_common_payload: true,
    required_extra_fields: [
      'why_now',
      'time_window',
      'triggered_rules',
      'evidence_pointers',
      'uncertainty_boundary',
      'next_action_safe_fallback',
    ] as const,
  },
  initiatives: {
    module: 'Inicjatywy' as const,
    contract_ref: 'P11',
    description: 'Living object (triage→plan→execute) with write-truth governance',
    required_common_payload: true,
    required_extra_fields: ['initiative_seed', 'proposal_only'] as const,
  },
  calendar: {
    module: 'Kalendarz' as const,
    contract_ref: 'P02',
    description: 'Time surface + interoperability; no fake writes',
    required_common_payload: true,
    required_extra_fields: [
      'calendar_intent',
      'permission_gradient_expectation',
      'conflict_safe_write_posture',
      'recovery_steps',
    ] as const,
  },
  notebook: {
    module: 'Notatki' as const,
    contract_ref: 'P07',
    description: 'Durable working memory + provenance; capture-first fallback lane',
    required_common_payload: true,
    required_extra_fields: [
      'notebook_handoff_context',
      'provenance_markers',
      'evidence_pointers',
    ] as const,
  },
  interview: {
    module: 'Wywiady' as const,
    contract_ref: 'P10',
    description: 'Interview insights — generate, review, export, evidence map',
    required_common_payload: true,
    required_extra_fields: ['interview_handoff_context', 'evidence_pointers'] as const,
  },
  kpi: {
    module: 'KPI' as const,
    contract_ref: 'KPI-E006',
    description:
      'Governed KPI advisor: drafting + quality-review for a new KPI, ' +
      'check-in/manager-brief assistance (visibility-scoped), deviation ' +
      'reflection/RCA drafting. Teresa never creates/activates/approves/' +
      'verifies/closes — see P08_KPI_FORBIDDEN_VERBS.',
    required_common_payload: true,
    required_extra_fields: ['kpi_handoff_context', 'evidence_pointers'] as const,
  },
  roi: {
    module: 'ROI' as const,
    contract_ref: 'ROI-E008',
    description:
      'Governed ROI advisor: Post-Investment-Review lessons-learned drafting ' +
      'only, grounded in the already-frozen, versioned review_snapshot_payload ' +
      '(AC-01). Teresa never creates/models/submits/approves/rejects/forecasts/' +
      'records-actual/verifies/disputes/schedules/closes a Case or PIR — see ' +
      'P08_ROI_FORBIDDEN_VERBS.',
    required_common_payload: true,
    required_extra_fields: ['roi_handoff_context', 'evidence_pointers'] as const,
  },
  okr: {
    module: 'OKR' as const,
    contract_ref: 'OKR-E008',
    description:
      'Governed OKR advisor: Objective drafting + quality-review, check-in ' +
      'assistance (visibility-scoped, writes via OKR-E004 recordCheckIn), ' +
      'manager brief (cites OKR-E006 attention read model only), ' +
      'reflection/next-cycle synthesis drafting (proposal-only, human ' +
      'disposition gate). Teresa never creates/submits/approves/rejects/' +
      'scores/carries-forward a Set, never invents current value/progress/' +
      'confidence/blocker/cause/intent — see P08_OKR_FORBIDDEN_VERBS.',
    required_common_payload: true,
    required_extra_fields: ['okr_handoff_context', 'evidence_pointers'] as const,
  },
  excele: {
    module: 'Excele' as const,
    contract_ref: 'P12',
    description: 'Workbook generation and spreadsheet workflows',
    required_common_payload: true,
    required_extra_fields: ['prompt'] as const,
  },
  ideas: {
    module: 'Ideas' as const,
    contract_ref: 'P09',
    description: 'Visual workspace tools: Mind Map, Process Flow, Table, Whiteboard',
    required_common_payload: true,
    required_extra_fields: ['ideas_context', 'canvas_type'] as const,
  },
  documents: {
    module: 'Dokumenty' as const,
    contract_ref: 'ARTIFACT_STUDIO_DOC',
    description: 'Governed edits of an opened Document Studio artifact',
    required_common_payload: true,
    required_extra_fields: ['artifact_id', 'instruction', 'document_context'] as const,
  },
  presentations: {
    module: 'Prezentacje' as const,
    contract_ref: 'ARTIFACT_STUDIO_PPT',
    description: 'Governed edits of an opened Presentation Studio deck',
    required_common_payload: true,
    required_extra_fields: ['deck_id', 'instruction', 'presentation_context'] as const,
  },
} as const;

export const P08_HANDOFF_TARGET_MODULES: HandoffTargetModule[] = [
  'radar',
  'initiatives',
  'calendar',
  'notebook',
  'interview',
  'excele',
  'ideas',
  'documents',
  'presentations',
  'kpi', // KPI-E006, appended — existing 9 entries untouched
  'roi', // ROI-E008, appended — existing 10 entries untouched
  'okr', // OKR-E008, appended — existing 11 entries untouched
];

// ────────────────────────────────────────────────────────────────
// KPI-E006 — forbidden verbs (documentation of an existing architectural
// fact: Teresa never imports/calls any of these; see §D grep-able proof
// in tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts)
// ────────────────────────────────────────────────────────────────

export const P08_KPI_FORBIDDEN_VERBS = [
  'approveDefinitionVersion', 'rejectDefinitionVersion', 'activateKpi',
  'suspendKpi', 'archiveKpi', 'verifyMeasurement', 'disputeMeasurement',
  'approvePlan', 'submitEffectivenessVerification', 'closeDeviationCase',
  'reopenDeviationCase',
] as const;

// ────────────────────────────────────────────────────────────────
// ROI-E008 — forbidden verbs (documentation of an existing architectural
// fact: Teresa never imports/calls any of these; see
// tests/resultsVnext/teresa-roi-forbidden-verbs.test.ts for the real,
// grep-able proof — the 2-name import whitelist in teresaCopilotService.ts
// is what actually enforces this, this array is documentation only).
//
// Re-derived per Decision D16 by running, at implementation time:
//   grep -nE "^export (async )?function [a-zA-Z]+" \
//     server/src/services/resultsVnext/roi/*Commands.ts \
//     server/src/services/resultsVnext/roi/roiEconomicModelFreeze.ts
// Scoped to real write/state-transition verbs (every exported async command
// function); pure read-side/type-conversion helpers with no state-mutation
// semantics of their own (e.g. `isRoiCaseReadyForReviewEligible`,
// `toDateOnlyString`, `assumptionRowToEngine`, `costLineRowToEngine`,
// `benefitLineRowToEngine`, `policyStampObject`,
// `computeCurrentEconomicModelHash`) are deliberately excluded — they are
// not "verbs" Teresa could use to mutate ROI state, and including them
// would dilute this list's documentation value without adding any real
// coverage (the import whitelist below is what actually enforces the
// boundary).
// ────────────────────────────────────────────────────────────────

export const P08_ROI_FORBIDDEN_VERBS = [
  // roiCaseCommands.ts
  'createRoiCase', 'updateRoiCaseDetails', 'archiveRoiCase', 'startModeling',
  'markReadyForReview', 'reopenRejectedRoiCase',
  // roiCaseApprovalCommands.ts
  'submitRoiCaseForApproval', 'approveRoiCase', 'rejectRoiCase',
  'requestChangesOnRoiCase', 'reopenApprovedRoiCaseForRevision',
  // roiBaselineCommands.ts
  'captureOrUpdateBaseline', 'freezeRoiBaseline', 'unfreezeRoiBaseline',
  // roiBenefitsRealizationCommands.ts
  'startRoiCaseBenefitsRealization', 'cancelRoiCase',
  // roiPirCommands.ts (ROI-E006 + this epic's own recordRoiPirTeresaLessonsDraft is the ONE exception)
  'scheduleRoiCasePostInvestmentReview', 'markRoiCasePostInvestmentReviewDue',
  'startRoiCasePostInvestmentReview', 'updateRoiPostInvestmentReviewDraft',
  'recordRoiPirTeresaDraftDisposition', 'closeRoiCase',
  // roiActualEntryCommands.ts / roiActualSnapshotCommands.ts
  'recordActualEntry', 'correctActualEntry', 'verifyActualEntry', 'disputeActualEntry',
  'publishRoiActualSnapshot',
  // roiVarianceCommands.ts
  'recordVariance', 'updateVarianceStatus', 'addVarianceCause', 'removeVarianceCause',
  // roiFinanceLinkCommands.ts / roiFinanceReconciliationCommands.ts (ROI-E007)
  'createRoiFinanceLink', 'removeRoiFinanceLink', 'openRoiFinanceReconciliation',
  'updateRoiFinanceReconciliationStatus',
  // roiBenefitEvidenceLinkCommands.ts (ROI-E002 + E007's flagEvidenceLinkFreshnessCheck)
  'addBenefitEvidenceLink', 'removeBenefitEvidenceLink', 'flagBenefitEvidenceLinkDisputed',
  'flagEvidenceLinkFreshnessCheck',
  // roiAssumptionCommands.ts
  'addAssumption', 'updateAssumption', 'removeAssumption',
  // roiBenefitLineCommands.ts
  'addBenefitLine', 'updateBenefitLine', 'removeBenefitLine',
  // roiCostLineCommands.ts
  'addCostLine', 'updateCostLine', 'removeCostLine',
  // roiCalculationRunCommands.ts (write verb only — see file-header note on
  // excluded pure helpers)
  'createRoiCalculationRun',
  // roiCalculationPolicyCommands.ts
  'captureOrUpdateCalculationPolicy',
  // roiScenarioCommands.ts
  'addScenario', 'updateScenario', 'removeScenario', 'setScenarioOverride',
  'removeScenarioOverride',
  // roiForecastVersionCommands.ts
  'createRoiForecastVersion',
  // roiTrackingCommands.ts
  'startRoiCaseTracking',
  // roiEconomicModelFreeze.ts
  'freezeRoiEconomicModel', 'unfreezeRoiEconomicModel',
] as const;

// ────────────────────────────────────────────────────────────────
// OKR-E008 — forbidden verbs (documentation of an existing architectural
// fact: Teresa never imports/calls any of these; see
// tests/resultsVnext/teresa-okr-forbidden-verbs.test.ts for the real,
// grep-able proof — the import whitelist in teresaCopilotService.ts is what
// actually enforces this, this array is documentation only).
//
// IO-1 re-verification (MANDATORY, per the design's own §3.6 blocker — done
// here since E001-E007 have now landed, unlike when that section was
// written against zero OKR code): re-derived by running, at implementation
// time:
//   grep -nE "^export (async )?function [a-zA-Z]+" \
//     server/src/services/resultsVnext/okr/*Commands.ts
// Scoped to real write/state-transition verbs (every exported async command
// function whose FIRST parameter is an `Input` object, not a `client:
// PoolClient`); pure read-side/boolean-check/type-conversion helpers whose
// first parameter IS `client: PoolClient` — meaning they require an
// already-open transaction the Teresa handoff layer never has, so they are
// not independently callable "verbs" at all — are deliberately excluded,
// same posture ROI-E008 D16 documented for its own excluded helpers:
// `insertManualOkrEvent`, `recomputeObjectiveRollup`,
// `assertSetEditableForUpdate`, `resolveOkrCyclePinnedPolicySnapshot`,
// `hasSufficientKeyResultCoverage`, `buildObjectivesSnapshotFragment`,
// `buildOkrSetApprovalSnapshotPayload`, `applySetRollupUpdate`,
// `assertNoAlignmentCycle` (all take `client: PoolClient` first). Also
// excluded: pure computation with no DB access at all
// (`applyOkrScoringModel`), pure boolean/read checks
// (`isVisibilityModeNarrowerOrEqual`, `isOkrSetReadyForSubmissionEligible`,
// `listOkrSetReviews`).
//
// `createObjective` (objective_draft) and `recordCheckIn` (check_in_assist)
// are Teresa's own two whitelisted write calls (§ import whitelist below) —
// EXCLUDED here, same as KPI's `createKpiDraft`/ROI's
// `recordRoiPirTeresaLessonsDraft` are excluded from THEIR own forbidden
// lists (real, callable write commands Teresa's governed handoff legitimately
// invokes are never also "forbidden"). `recordOkrReflectionTeresaDraft`
// (OKR-E008's own new write, reflection_synthesis) is excluded for the same
// reason. `recordOkrReflectionTeresaDraftDisposition` (the HUMAN's own
// disposition gate, never called by Teresa) — and `recordObjectiveReflection`/
// `finalScoreOkrSet` (the human's own narrative/scoring commit) — ARE listed
// below: Teresa never calls any of the three.
// ────────────────────────────────────────────────────────────────

export const P08_OKR_FORBIDDEN_VERBS = [
  // okrAlignmentCommands.ts (OKR-E005)
  'proposeAlignment', 'acceptAlignment', 'rejectAlignment', 'removeAlignment',
  // okrCarryForwardCommands.ts (OKR-E007)
  'carryForwardOkrSet',
  // okrCheckInCommands.ts (OKR-E004) — recordCheckIn is Teresa's own
  // check_in_assist whitelist call, excluded; correctCheckIn is not.
  'correctCheckIn',
  // okrKeyResultCommands.ts (OKR-E003)
  'createKeyResult', 'updateKeyResult', 'cancelKeyResult',
  // okrCycleCommands.ts (OKR-E001)
  'createCycle', 'runOkrCycleLifecycleTransition',
  // okrReviewCommands.ts (OKR-E007)
  'submitOkrSetSelfReview', 'submitOkrSetForManagerReview',
  'approveOkrSetManagerReview', 'requestChangesOnOkrSetManagerReview',
  'recordOkrSetReviewComment',
  // okrObjectiveCommands.ts (OKR-E003) — createObjective is Teresa's own
  // objective_draft whitelist call, excluded; updateObjective/cancelObjective
  // are not (Teresa never edits/cancels an existing Objective directly).
  'updateObjective', 'cancelObjective',
  // okrReflectionCommands.ts (OKR-E007 + this epic's own
  // recordOkrReflectionTeresaDraft is the ONE exception — same shape as
  // ROI-E008's recordRoiPirTeresaLessonsDraft exception)
  'finalScoreOkrSet', 'recordObjectiveReflection', 'recordOkrReflectionTeresaDraftDisposition',
  // okrProgramCommands.ts (OKR-E001)
  'createProgram', 'editProgramDraft', 'publishProgram',
  // okrDecisionCommands.ts (OKR-E006)
  'requestDecisionFromSupportRequest', 'acknowledgeDecisionResolution',
  // okrSetCommands.ts (OKR-E002)
  'createOkrSet', 'updateOkrSetDraft', 'narrowOkrSetVisibility',
  'submitOkrSetForApproval', 'approveOkrSet', 'requestChangesOnOkrSet',
  'runOkrSetLifecycleTransition', 'closeOkrSet',
  // okrSetMaterialChangeCommands.ts (OKR-E002)
  'recordOkrSetMaterialChange',
  // okrSupportCommands.ts (OKR-E006)
  'postComment', 'postRecognition', 'raiseSupportRequest',
  'acknowledgeSupportRequest', 'resolveSupportRequest', 'dismissSupportRequest',
] as const;

export const P08_COMMON_PAYLOAD_FIELDS = [
  'origin',
  'user_intent',
  'active_surface',
  'org_context_ref',
  'bounded_context_pack',
  'constraints',
  'assumptions',
  'uncertainty_boundary',
  'evidence_pointers',
  'proposed_next_action',
  'audit_stub',
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.2 — Action governance envelope
// ────────────────────────────────────────────────────────────────

export const P08_ACTION_ENVELOPE_STATES = [
  'proposal',
  'pending_approval',
  'approved',
  'executing',
  'completed',
  'undone',
  'rejected',
] as const;

export type ActionEnvelopeState = (typeof P08_ACTION_ENVELOPE_STATES)[number];

export const P08_ACTION_ENVELOPE_TRANSITIONS: Record<ActionEnvelopeState, ActionEnvelopeState[]> = {
  proposal: ['pending_approval', 'rejected'],
  pending_approval: ['approved', 'rejected'],
  approved: ['executing'],
  executing: ['completed', 'rejected'],
  completed: ['undone'],
  undone: [],
  rejected: [],
};

export const P08_ACTION_ENVELOPE_RULES = {
  approve_not_review:
    'approve(run) ≠ review(artifact): user must explicitly approve execution, not just review the proposal',
  no_silent_writes: 'No auto-apply, no background save. Every mutation requires explicit approval.',
  no_parallel_approvals:
    'Only one active approval request per user/session. New proposals must cancel/version previous.',
  idempotency_posture: 'Retry must not create duplicates, especially for create operations.',
  truth_preserving_failure:
    'If audit/traces cannot be written, the action is blocked or marked degraded(audit_unavailable) — never claim success.',
  audit_required: 'Every action has a trace: who/when/what input/what outcome. No ghost actions.',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Voice posture
// ────────────────────────────────────────────────────────────────

export type VoiceAvailability = 'available' | 'degraded' | 'unavailable';

export const P08_VOICE_POSTURE = {
  availability: {
    states: ['available', 'degraded', 'unavailable'] as VoiceAvailability[],
    rule: 'Teresa always communicates voice status and reason (permissions/device/network)',
  },
  fallback_to_text: {
    rule: 'When voice is degraded/unavailable, all critical actions fall back to text (readable proposal + Approve button)',
    trigger_conditions: [
      'voice_degraded',
      'voice_unavailable',
      'mic_permission_denied',
      'network_unstable',
    ],
  },
  recovery_grammar: [
    'Przechodzę na tekst, bo voice jest niestabilny. Oto proposal.',
    'Powtórz proszę ostatnią instrukcję',
    'Nie mogę wykonać tej akcji bez zatwierdzenia. Powiedz: "Zatwierdź" albo kliknij Approve.',
    'Wstrzymuję wykonanie — brak wymaganych danych: {missing_inputs}.',
  ] as const,
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.4 — Evidence / citations posture
// ────────────────────────────────────────────────────────────────

export const P08_CITATION_POSTURE = {
  explicit_sources: {
    rule: 'Teresa can give "why" only in cited mode: evidence_pointers[] with link/ref to app object / SSOT / activity',
    required_fields: ['evidence_pointers'],
  },
  missing_source_boundary: {
    rule: 'When source is missing, Teresa must declare uncertainty: missing_inputs[], conflicts[]',
    required_fields: ['missing_inputs', 'conflicts'],
  },
  uncertainty_marker: {
    rule: 'No overclaim "I know because I know" without evidence or uncertainty boundary. Opinion vs fact must be marked.',
    forbidden: ['overclaim_without_evidence', 'opinion_as_fact_unmarked'],
  },
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.5 — Hard boundaries: Teresa vs Anna + module-owned writes
// ────────────────────────────────────────────────────────────────

export const P08_ANNA_BOUNDARY = {
  teresa: {
    scope: 'Internal product copilot on org objects',
    can: [
      'Access org data within permission scope',
      'Initiate proposal + handoff to target modules',
      'Maintain conversation context across surfaces',
      'Voice + text interaction within product',
    ],
    cannot: [
      'Act as public-facing assistant',
      'Bypass module-owned write governance',
      'Execute without explicit user approval',
      'Access data outside org/tenant scope',
    ],
  },
  anna: {
    scope: 'Public assistant without org data access',
    can: [
      'Answer general product questions',
      'Guide visitors through public content',
      'Collect leads and demo requests',
    ],
    cannot: [
      'Access org data',
      'Execute runtime actions on org objects',
      'Be used as a policy escape for Teresa limitations',
    ],
  },
  no_bypass:
    'No copy/paste policy escape between Teresa and Anna. They are separate runtimes with separate data access.',
} as const;

export const P08_WRITE_OWNERSHIP = {
  rule: 'Teresa initiates handoff, module owns writes',
  detail:
    'The only place where writes happen are target modules (Radar/Inicjatywy/Kalendarz/Notatki/Wywiady) per their own canon. Teresa does not create side-writes or parallel models.',
  teresa_role: 'initiator' as const,
  module_role: 'writer' as const,
  forbidden: [
    'Teresa-owned side writes',
    'Parallel data models outside target modules',
    'Background saves without module governance',
    'Direct DB writes bypassing module service layer',
  ],
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.6 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const P08_ANTI_DUPLICATE_RULES = {
  run_grammar_source: 'P17 — run grammar is not duplicated in P08',
  single_payload_core:
    'Handoff payloads have 1 shared core (teresa_handoff_context) + per-target extensions; no payload v2 per module',
  near_duplicate_detection: {
    rule: 'If Teresa detects near-duplicate (parallel initiatives/notes for same problem statement), she must stop execution, indicate conflict, and propose merge/select-canonical',
    actions: ['stop_execution', 'indicate_conflict', 'propose_merge_or_select_canonical'],
  },
  no_parallel_approvals:
    'Only one active approval per user/session. New proposals cancel/version previous.',
  no_parallel_grammars: 'No per-module custom grammar; all modules consume the same envelope.',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.7 — Degraded / error posture (10 scenarios)
// ────────────────────────────────────────────────────────────────

export interface DegradedScenario {
  id: string;
  scenario: string;
  visible_state: string;
  safe_next_action: string;
  no_silent_data_loss: true;
}

export const P08_DEGRADED_SCENARIOS: DegradedScenario[] = [
  {
    id: 'D01',
    scenario: 'Voice unavailable / mic permission denied',
    visible_state: 'voice_unavailable',
    safe_next_action: 'Fallback to text + CTA "Continue in text"',
    no_silent_data_loss: true,
  },
  {
    id: 'D02',
    scenario: 'ASR uncertainty / low confidence',
    visible_state: 'asr_low_confidence',
    safe_next_action: 'Show transcript + ask to confirm; no execution',
    no_silent_data_loss: true,
  },
  {
    id: 'D03',
    scenario: 'Approval missing / timed out',
    visible_state: 'approval_expired',
    safe_next_action: 'Proposal expires; require re-approve; no partial writes',
    no_silent_data_loss: true,
  },
  {
    id: 'D04',
    scenario: 'Permission denied in target module',
    visible_state: 'blocked(permission)',
    safe_next_action: 'Request access / capture in Notatki as fallback',
    no_silent_data_loss: true,
  },
  {
    id: 'D05',
    scenario: 'Tool/action failed (network/timeout/503)',
    visible_state: 'degraded(tool_unavailable)',
    safe_next_action: 'Retry guidance + keep proposal intact',
    no_silent_data_loss: true,
  },
  {
    id: 'D06',
    scenario: 'Stale context / entity not found',
    visible_state: 'degraded(stale)',
    safe_next_action: 'Refresh/readback; never assume it worked',
    no_silent_data_loss: true,
  },
  {
    id: 'D07',
    scenario: 'Conflict/ETag mismatch (Calendar write)',
    visible_state: 'conflict',
    safe_next_action: 'Deny overwrite; propose manual resolution steps',
    no_silent_data_loss: true,
  },
  {
    id: 'D08',
    scenario: 'Audit/traces unavailable',
    visible_state: 'degraded(audit_unavailable)',
    safe_next_action:
      'Block execution or mark degraded with explicit warning; never claim completion',
    no_silent_data_loss: true,
  },
  {
    id: 'D09',
    scenario: 'Duplicate detected (near-duplicate initiative/note/signal)',
    visible_state: 'duplicate_detected',
    safe_next_action: 'Stop and propose merge/select-canonical',
    no_silent_data_loss: true,
  },
  {
    id: 'D10',
    scenario: 'Partial data (e.g. Radar sources 206)',
    visible_state: 'partial_data',
    safe_next_action: 'Show "partial" + list missing inputs; avoid P0 overclaim',
    no_silent_data_loss: true,
  },
];

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Acceptance checklist (12 items)
// ────────────────────────────────────────────────────────────────

export const P08_ACCEPTANCE_CHECKLIST: Array<{
  id: number;
  requirement: string;
  section: string;
  testable: boolean;
}> = [
  {
    id: 1,
    requirement: 'P0 targets list (3-5) frozen: Radar/P11/P02/P07',
    section: '§2.3.1',
    testable: true,
  },
  {
    id: 2,
    requirement:
      'Each target has required payload: common teresa_handoff_context + per-target additions',
    section: '§2.3.1',
    testable: true,
  },
  {
    id: 3,
    requirement: 'Action envelope: proposal→explicit approval→execution→audit/traces (per P17)',
    section: '§2.3.2',
    testable: true,
  },
  {
    id: 4,
    requirement: 'approve(run) ≠ review(artifact) is explicit; no silent writes',
    section: '§2.3.2',
    testable: true,
  },
  {
    id: 5,
    requirement: 'No parallel approvals is a hard rule (anti-duplicate governance)',
    section: '§2.3.2',
    testable: true,
  },
  {
    id: 6,
    requirement: 'Voice posture: availability + fallback to text + recovery grammar',
    section: '§2.3.3',
    testable: true,
  },
  {
    id: 7,
    requirement:
      'Evidence pointers/citations posture is explicit; missing source = uncertainty boundary',
    section: '§2.3.4',
    testable: true,
  },
  {
    id: 8,
    requirement: 'Hard boundary vs Anna/public assistant is documented; no bypass',
    section: '§2.3.5',
    testable: true,
  },
  {
    id: 9,
    requirement: 'Module-owned writes: Teresa initiates handoff, not owner of writes',
    section: '§2.3.5',
    testable: true,
  },
  {
    id: 10,
    requirement: 'Degraded/error posture has minimum 8 scenarios with safe next action',
    section: '§2.3.7',
    testable: true,
  },
  {
    id: 11,
    requirement: 'Anti-duplicate: near-duplicate stop + merge/select-canonical',
    section: '§2.3.6',
    testable: true,
  },
  { id: 12, requirement: 'Evidence ledger filled for P08', section: '§10', testable: true },
];

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Validate that a handoff context has all required common fields.
 */
export const P08_BOUNDED_CONTEXT_PACK_MAX = 5;

export function validateHandoffContext(ctx: Record<string, unknown>): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  for (const field of P08_COMMON_PAYLOAD_FIELDS) {
    if (ctx[field] === undefined || ctx[field] === null) {
      missing.push(field);
    }
  }
  const bcp = ctx.bounded_context_pack;
  if (Array.isArray(bcp) && bcp.length > P08_BOUNDED_CONTEXT_PACK_MAX) {
    warnings.push(
      `bounded_context_pack exceeds max ${P08_BOUNDED_CONTEXT_PACK_MAX} (got ${bcp.length})`
    );
  }
  return { valid: missing.length === 0, missing, warnings };
}

/**
 * Validate that a handoff to a specific target has the required extra fields.
 */
export function validateTargetPayload(
  target: HandoffTargetModule,
  payload: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const targetDef = (P08_HANDOFF_TARGETS as any)[target];
  if (!targetDef) {
    return { valid: false, missing: [`unsupported_target:${target}`] };
  }
  const missing: string[] = [];
  for (const field of targetDef.required_extra_fields) {
    if (payload[field] === undefined || payload[field] === null) {
      missing.push(field);
    }
  }
  return { valid: missing.length === 0, missing };
}

/**
 * Check if an envelope state transition is valid.
 */
export function isValidEnvelopeTransition(
  from: ActionEnvelopeState,
  to: ActionEnvelopeState
): boolean {
  return P08_ACTION_ENVELOPE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Determine voice availability based on runtime conditions.
 */
export function resolveVoiceAvailability(conditions: {
  micPermission: boolean;
  networkStable: boolean;
  runtimeReady: boolean;
}): VoiceAvailability {
  if (!conditions.micPermission) return 'unavailable';
  if (!conditions.networkStable || !conditions.runtimeReady) return 'degraded';
  return 'available';
}

/**
 * Check if an actor is Teresa (for write ownership validation).
 */
export function isTeresaInitiated(actor: string): boolean {
  return actor === 'teresa' || actor.startsWith('teresa:');
}

/**
 * Validate that Teresa is not the writer — only the initiator.
 */
export function validateWriteOwnership(
  initiator: string,
  writer: string
): {
  valid: boolean;
  reason?: string;
} {
  if (!isTeresaInitiated(initiator)) {
    return { valid: true };
  }
  if (isTeresaInitiated(writer)) {
    return {
      valid: false,
      reason: 'Teresa cannot be both initiator and writer. Module must own writes.',
    };
  }
  return { valid: true };
}
