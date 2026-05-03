# MDI Implementation Plan — Interview Insight Report Pack Completion

Date: 2026-05-03  
Owner: Product + Engineering  
Status: READY FOR IMPLEMENTATION  
Scope: complete `Interview Insight` from governed insight generation into a client-ready report pack with all required worksheets, evidence, quality gates, downstream actions and audit posture.

---

## 0. MDI Meaning

For this work packet, `MDI` means:

- `M` — Mission: why this work exists and what business outcome must be achieved.
- `D` — Delivery: exact implementation phases, files, contracts, data shapes and tests.
- `I` — Integrity: gates, DoD, traceability, anti-hallucination controls and no-skip rules.

This document is intended to be used directly by implementation agents. It must preserve enough context that work can continue without relying on chat memory.

---

## 1. Mission

The final business goal is not a nicer AI summary.

The goal is a consultant-grade workbench that turns approved interview/survey-like evidence into:

1. A controlled analysis scope.
2. A structured consulting insight.
3. A complete report pack with all required worksheets.
4. Evidence-backed P10 findings.
5. Clear material quality and limitations.
6. Contradiction and gap handling.
7. Recommended next decisions/actions with confidence boundaries.
8. Six downstream actions:
   - report,
   - presentation,
   - table/sheet,
   - idea,
   - note,
   - initiative draft.

The desired user outcome:

`approved material -> controlled scope -> analysis -> complete report pack -> reviewed actions`

The report pack must be strong enough for real client work. It must explain what was analyzed, how reliable the material is, what was found, what evidence supports it, where the contradictions are, and what should happen next.

---

## 2. Source Of Truth

Before coding, read or keep open these documents:

- `docs/product/DOCUMENTATION_REGISTRY.md`
- `docs/product/INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
- `docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `docs/product/INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/MDI_INTERVIEW_INSIGHT_SCOPE_BUILDER_FULL_IMPLEMENTATION_PLAN_2026-05-02.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_10_WNIOSKI_W_INTERVIEW_2026-03-29.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_21_RAPORTY_2026-03-29.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_15_TABELE_2026-03-29.md`
- `docs/product/CANVAS_SOURCE_OF_TRUTH.md`
- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `server/src/services/v8/interviewInsightCanon.ts`

If code and docs disagree:

1. Do not guess.
2. Treat the mismatch as implementation debt.
3. Resolve against the product docs above.
4. If the product docs conflict, use this priority:
   - `DRD/UI_UX_SOURCE_OF_TRUTH.md` for UI/UX, AI execution, traceability and degraded states.
   - `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md` for Insight semantics.
   - `INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md` for evidence/confidence.
   - `INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md` for downstream actions.
   - P10 final plan and `interviewInsightCanon.ts` for finding/publish/handoff semantics.

---

## 3. Non-Negotiable Product Decisions

These decisions are frozen for this work:

- Insight generation uses only approved/completed interview material.
- The user selects source material through scope filters, not individual answer snippets.
- Scope filters include:
  - respondent/person,
  - role,
  - department,
  - template/sheet,
  - date range,
  - topic focus,
  - selected source sessions.
- If topic focus is empty, AI performs a general consulting synthesis.
- Leading question is optional.
- Consultant note is optional but must be passed to the generation layer when provided.
- `Material Quality` is generated after insight creation. It is not a pre-generation blocking gate.
- Two context modes exist:
  - `selected_interview_material_only`
  - `selected_material_plus_approved_org_knowledge`
- Organizational knowledge can enrich interpretation, but cannot erase interview limitations or contradictions.
- P10 findings remain the publishable truth layer.
- Recommendations are allowed only as labeled recommendations/hypotheses/actions, not as hidden facts.
- All important AI mutations follow:

`proposal -> approval -> execution -> audit`

---

## 4. Current Runtime Baseline

Known implementation areas:

- Frontend creator:
  - `src/components/Interview/InsightCreatorModal.tsx`
- Insight viewer:
  - `src/components/Interview/InsightViewer.tsx`
- V8 frontend API:
  - `src/services/api/v8/interview.ts`
- V8 routes:
  - `server/src/routes/v8/interview.routes.ts`
  - `server/src/routes/v8/interview-insights.routes.ts`
- Legacy controller:
  - `server/src/controllers/InterviewController.ts`
- Core generation service:
  - `server/src/services/InterviewInsightService.ts`
- P10 services:
  - `server/src/services/v8/interviewInsightCanon.ts`
  - `server/src/services/v8/interviewInsightCandidateService.ts`
  - `server/src/services/v8/interviewInsightFindingsService.ts`
  - `server/src/services/v8/interviewInsightAnalysisService.ts`
- Canvas/artifacts/report runtime touchpoints:
  - `server/src/routes/work-canvas.routes.ts`
  - `src/components/AIChat/WorkCanvasDocumentPanel.tsx`
  - `src/components/shared/artifact-actions/ArtifactActionPanel.tsx`
  - `src/services/api.ts`

Known gaps from audit:

- Scope filters are stored, but must be enforced against the actual material used by the backend prompt.
- Multi-select UI choices for output type / analysis mode must either become real behavior or be simplified.
- `recommendations` conflict with current no-recommendations prompt posture unless separated into labeled recommendation hypotheses.
- `topic_focus`, `consultant_note` and `leading_question` must be consistently wired from UI to service.
- Regeneration must preserve or rebuild selected context documents.
- Evidence refs must be validated against actual answer IDs.
- The final report pack does not yet exist as a complete controlled artifact with worksheets.

---

## 5. Target Product Object Model

### 5.1 InterviewInsight

`InterviewInsight` remains the analysis artifact produced from approved source material.

It must contain:

- title,
- scope,
- generation context,
- material quality,
- themes/issues/opportunities/signals,
- evidence refs,
- contradictions,
- candidate findings,
- limits,
- context provenance.

### 5.2 InterviewReportPack

Add or implement a report-pack projection from an insight.

`InterviewReportPack` is the client-ready deliverable package derived from `InterviewInsight`.

It should include:

- stable ID,
- source `insight_id`,
- source `project_id` / `org_id`,
- report status,
- worksheet list,
- worksheet completeness,
- report-level material quality,
- source ledger,
- evidence ledger,
- degraded flags,
- generation plan,
- review metadata,
- export ledger.

Minimum suggested shape:

```ts
type InterviewReportPackStatus =
  | 'draft'
  | 'generating'
  | 'needs_review'
  | 'approved'
  | 'exported'
  | 'failed';

type InterviewReportWorksheetStatus =
  | 'generated'
  | 'partial'
  | 'empty'
  | 'degraded'
  | 'failed';

interface InterviewReportPack {
  id: string;
  orgId: string;
  projectId?: string | null;
  insightId: string;
  title: string;
  status: InterviewReportPackStatus;
  templateId?: string | null;
  audience?: 'client_board' | 'management' | 'project_team' | 'consultant_internal';
  language?: string;
  scopeSnapshot: InsightAnalysisScope;
  materialQualitySnapshot: InsightMaterialQuality;
  worksheets: InterviewReportWorksheet[];
  sourceLedger: InterviewReportSourceLedgerEntry[];
  evidenceLedger: InterviewReportEvidenceLedgerEntry[];
  degradedFlags: InterviewReportDegradedFlags;
  generationPlan: InterviewReportGenerationPlan;
  reviewState: 'not_reviewed' | 'in_review' | 'approved' | 'changes_requested';
  exportLedger: InterviewReportExportLedgerEntry[];
  createdAt: string;
  updatedAt: string;
}
```

Do not create a second truth system for findings. P10 findings remain the governed truth layer.

### 5.3 Worksheet

Each worksheet is a structured section/table inside the report pack.

Suggested shape:

```ts
interface InterviewReportWorksheet {
  id: string;
  reportPackId: string;
  key: InterviewReportWorksheetKey;
  title: string;
  status: InterviewReportWorksheetStatus;
  completenessScore: number;
  rows?: unknown[];
  markdown?: string;
  warnings: string[];
  sourceRefs: string[];
  evidenceRefs: string[];
  updatedAt: string;
}
```

Implementation may store worksheets as JSON first and later project them to Canvas/table/report artifacts.

---

## 6. Required Report Pack Worksheets

The complete report pack must include these worksheets/tabs.

| Key | Title | Required | Purpose |
| --- | --- | --- | --- |
| `executive_summary` | Executive Summary | Yes | Board-level summary of the most important observations, risks, decisions and next actions. |
| `scope_and_method` | Scope And Method | Yes | What was analyzed, who was included, date range, templates, modes and context. |
| `material_quality` | Material Quality | Yes | Whether the material is strong enough and what limits apply. |
| `source_register` | Source Register | Yes | Sessions/respondents/templates/statuses included in the analysis. |
| `respondent_profile` | Respondent Profile | Yes | Who spoke, from what role/department/proximity, and how representative each slice is. |
| `topic_synthesis` | Topic Synthesis | Yes | Themes, issues, opportunities, gaps and signals by topic. |
| `person_topic_matrix` | Person x Topic Matrix | Yes | Who says what about each topic; convergence, divergence and strength of signal. |
| `findings_p10` | P10 Findings | Yes | Governed findings with evidence, confidence, status and review posture. |
| `evidence_register` | Evidence Register | Yes | Answer/source-level evidence table backing the report. |
| `contradictions_and_gaps` | Contradictions And Gaps | Yes | Contradictions, missing voices, unresolved assumptions and follow-up needs. |
| `opportunities` | Opportunities | Yes | Action potential, readiness, constraints and value hypotheses. |
| `recommendations_and_action_plan` | Recommendations And Action Plan | Yes | Labeled recommendation hypotheses and proposed next actions. |
| `initiative_candidates` | Initiative Candidates | Yes | Draft initiative candidates ready for `Interview > Initiatives`. |
| `open_questions` | Open Questions | Yes | Questions for clarification, re-interview or additional evidence. |
| `appendix_provenance` | Appendix: Provenance | Yes | Prompt/model/context/doc lineage, degraded flags, export/review metadata. |

No worksheet may pretend to be complete when required input is missing.

Allowed worksheet states:

- `generated` — complete enough for review.
- `partial` — useful but incomplete.
- `empty` — no relevant data exists for this worksheet.
- `degraded` — generated with missing context, weak sources or provider limitations.
- `failed` — generation failed and must be retried.

---

## 7. Worksheet Content Contracts

### 7.1 Executive Summary

Must include:

- top observations,
- most important risks,
- most important opportunities,
- recommended decisions,
- confidence posture,
- material quality warning if score is low,
- link/refs to underlying findings.

Must not include:

- unsupported facts,
- hidden recommendations without confidence,
- raw LLM prose without evidence posture.

### 7.2 Scope And Method

Must include:

- insight ID,
- report pack ID,
- organization/project,
- selected sessions,
- respondent filters,
- role filters,
- department filters,
- template filters,
- date range,
- topic focus,
- analysis modes,
- output/report type,
- context mode,
- consultant note summary,
- leading question if present.

Gate:

- This worksheet must exactly match `analysis_scope_json` and the actual fetched material.

### 7.3 Material Quality

Must include:

- session count,
- respondent count,
- role/department coverage,
- template coverage,
- answer depth,
- thin answer ratio,
- missing data,
- contradiction density,
- evidence sufficiency,
- follow-up needs,
- overall quality label.

Quality labels:

- `strong`
- `usable_with_limits`
- `thin`
- `insufficient_for_recommendations`

### 7.4 Source Register

Must include:

- session ID,
- session title/name,
- respondent ID/name,
- role,
- department,
- template ID/name,
- completed date,
- approved/completed status,
- included/excluded reason.

Gate:

- Only approved/completed source material may be included.

### 7.5 Respondent Profile

Must include:

- respondent,
- role,
- department,
- stakeholder class,
- decision proximity,
- process proximity,
- topics covered,
- representativeness note,
- evidence count.

### 7.6 Topic Synthesis

Must include rows for:

- theme,
- issue,
- opportunity,
- contradiction,
- gap,
- signal.

Each row must include:

- topic label,
- synthesis,
- evidence refs,
- affected roles/departments,
- confidence,
- limitation.

### 7.7 Person x Topic Matrix

Must include:

- respondent/role/department,
- topic,
- stance/signal,
- evidence refs,
- confidence,
- contradiction marker,
- urgency or business impact if inferable.

This worksheet is the core consulting view. It must reveal where perspectives converge or diverge.

### 7.8 P10 Findings

Must use existing P10 semantics.

Each finding must include:

- finding ID,
- title,
- statement,
- evidence class,
- confidence level,
- confidence reason,
- source count,
- contradiction present,
- review status,
- readback status,
- handoff eligibility.

Gate:

- A finding without evidence refs cannot be `ready_for_review`.
- A challenged finding cannot be treated as published.
- Handoff requires confirmed readback when required by P10 policy.

### 7.9 Evidence Register

Must include:

- answer ID or source ID,
- source type,
- respondent/session/template,
- evidence excerpt or safe summary,
- evidence class,
- linked finding/topic/opportunity,
- confidence contribution,
- source availability.

Gate:

- Every evidence ref used elsewhere must resolve to a real row here.

### 7.10 Contradictions And Gaps

Must include:

- contradiction statement,
- side A,
- side B,
- involved respondents/roles,
- evidence refs,
- confidence,
- business risk,
- required follow-up.

Gaps must include:

- missing respondent group,
- missing source type,
- missing timeframe,
- missing document/system evidence,
- suggested clarification question.

### 7.11 Opportunities

Must include:

- opportunity,
- business value hypothesis,
- evidence,
- affected process/team,
- readiness,
- dependencies,
- risks,
- possible initiative link.

### 7.12 Recommendations And Action Plan

Recommendations must be labeled, not hidden as facts.

Each row must include:

- recommendation,
- type: `hypothesis` | `evidence_backed` | `needs_validation`,
- supporting findings,
- confidence,
- risk,
- next action,
- owner placeholder,
- timing placeholder.

Gate:

- Low-confidence recommendations must not be presented as final decisions.

### 7.13 Initiative Candidates

Must include:

- draft initiative title,
- problem statement,
- expected outcome,
- supporting findings,
- evidence refs,
- confidence,
- dependencies,
- suggested first step,
- target module/status: `Interview > Initiatives`, `draft`.

Gate:

- Creating an initiative is a separate user-approved action.
- Report generation must not silently create application objects.

### 7.14 Open Questions

Must include:

- question,
- reason,
- related topic/finding,
- required respondent/source,
- priority,
- expected decision impact.

### 7.15 Appendix: Provenance

Must include:

- source insight,
- generation timestamp,
- model/provider if available,
- context mode,
- context documents used,
- org knowledge packs used,
- degraded flags,
- prompt/schema version,
- export ledger,
- review ledger.

---

## 8. Implementation Phases

No phase may be marked complete until its gate and DoD are satisfied.

### Phase 1 — Scope Enforcement And Material Pack

Goal:

Make the selected scope identical to the material actually analyzed.

Tasks:

- Inspect current `InsightCreatorModal` payload.
- Inspect `V8InterviewApi.createInsight`.
- Inspect `server/src/routes/v8/interview.routes.ts`.
- Inspect `InterviewInsightService.buildDefaultAnalysisScope`.
- Update `InterviewInsightService.fetchSessionData` so it applies:
  - selected session IDs,
  - respondent IDs,
  - role filters,
  - department filters,
  - template filters,
  - date range,
  - approved/completed status,
  - answered-only rule.
- Create a material pack structure before prompt formatting.
- Include both included and excluded source counts in generation context.
- Ensure `formatSessionDataForPrompt` receives only in-scope answers.

Suggested tests:

- Selected respondent excludes other respondents' answers.
- Date range excludes sessions outside range.
- Template filter excludes other templates.
- Approved-only rule still blocks unapproved/completed-invalid material.
- Scope summary equals actual fetched source IDs.

Gate:

- The material used in the prompt must exactly match the selected scope.

DoD:

- Server tests prove filters affect retrieved material.
- UI payload contains necessary filters.
- `analysis_scope_json` and generated source pack agree.
- No unapproved material can enter prompt.
- Manual/readback check confirms source register does not show out-of-scope data.

### Phase 2 — Analysis Modes And Output Types Contract

Goal:

Remove ambiguity between "how AI reads material" and "what deliverable the user wants".

Tasks:

- Define canonical UI labels:
  - analysis mode = how AI reads the material,
  - output type = what artifact/report result will be produced.
- Decide implementation:
  - Option A: single primary analysis mode and single primary output type.
  - Option B: real multi-select with multi-pass generation and merge.
- For first controlled delivery, prefer Option A unless multi-pass is explicitly implemented.
- Add backend support for all displayed analysis modes:
  - `general_consulting_synthesis`,
  - `focused_topic_synthesis`,
  - `contradiction_scan`,
  - `initiative_opportunity_scan`,
  - `material_quality_scan`,
  - `hypothesis_validation`,
  - `between_the_lines`.
- Ensure `between_the_lines` exists server-side if shown client-side.
- Ensure output/report type drives report-pack structure.

Gate:

- Every selectable UI option must have an implemented backend effect or be removed/disabled.

DoD:

- No cosmetic-only selection remains.
- Tests cover selected analysis mode reaching prompt/service.
- UI copy makes the distinction understandable.
- Generated insight records selected mode/type in `analysis_scope_json`.

### Phase 3 — Creator Steering Fields

Goal:

Let the consultant steer the analysis without forcing prompt-writing.

Tasks:

- Add or restore topic focus support.
- Add/restore leading question support.
- Add/restore consultant note support.
- Validate field lengths.
- Include these fields in:
  - frontend state,
  - API payload,
  - `analysis_scope_json`,
  - generation prompt,
  - report `scope_and_method` worksheet.

Gate:

- User-provided steering fields must be visible in the stored scope and reflected in output.

DoD:

- Tests prove fields survive UI -> API -> DB/service.
- Empty fields are valid.
- No raw prompt injection appears in client-facing report without safe framing.

### Phase 4 — Structured Insight Schema For Report Packs

Goal:

Generate structured data that can populate report worksheets reliably.

Tasks:

- Extend backend generation schema to include:
  - `executive_summary`,
  - `scope_summary`,
  - `material_quality`,
  - `respondent_profiles`,
  - `topic_synthesis`,
  - `person_topic_matrix`,
  - `findings`,
  - `evidence_register`,
  - `contradictions`,
  - `gaps`,
  - `opportunities`,
  - `recommendation_hypotheses`,
  - `initiative_candidates`,
  - `open_questions`,
  - `limitations`.
- Keep backward compatibility for existing insights.
- Persist structured sections in existing JSON fields where possible, or add migration for report-pack-specific storage.
- Add schema version to generation context.
- Add parse repair/retry for malformed JSON.

Gate:

- The generated insight must be machine-usable for report worksheets, not only readable markdown.

DoD:

- Unit tests for parser and schema normalization.
- Snapshot/contract test for generated structure with fixture data.
- Existing viewer still works for old insight rows.
- Failed JSON does not silently create fake success.

### Phase 5 — Evidence Ref Validator

Goal:

Prevent unsupported claims from entering the report as trusted content.

Tasks:

- Build an evidence-ref validator after LLM parse.
- Validate every evidence ref against actual prompt/source answer IDs.
- Mark invalid refs as degraded.
- Remove, quarantine or downgrade claims with invalid evidence.
- Add report-level warning if evidence integrity is partial.
- Feed validator result into `material_quality_json` and report degraded flags.

Gate:

- No claim can be treated as evidence-backed unless its evidence refs resolve.

DoD:

- Tests for valid refs, invalid refs and mixed refs.
- Findings without valid evidence cannot be promoted.
- Viewer/report shows honest degraded state.

### Phase 6 — Material Quality Upgrade

Goal:

Make material quality a real consulting audit.

Tasks:

- Expand material quality dimensions:
  - source coverage,
  - respondent diversity,
  - role/department coverage,
  - template coverage,
  - answer depth,
  - thin answers,
  - contradiction density,
  - missing voices,
  - evidence sufficiency,
  - context-document readiness,
  - follow-up needs.
- Add quality labels:
  - `strong`,
  - `usable_with_limits`,
  - `thin`,
  - `insufficient_for_recommendations`.
- Connect material quality to recommendations:
  - if quality is weak, recommendations must be hypotheses or blocked from "decision-ready" framing.

Gate:

- Weak material must be visible and must lower the certainty of report conclusions.

DoD:

- Material quality card and worksheet match.
- Tests cover weak/thin material.
- Report summary includes material warning when needed.

### Phase 7 — Report Pack Storage And Generator

Goal:

Create a durable report pack from an insight.

Tasks:

- Decide storage approach:
  - new `interview_report_packs` / `interview_report_worksheets` tables, or
  - artifact runtime projection using existing Canvas/Outputs storage.
- Prefer not to create a parallel artifact library if existing artifact runtime can represent the pack.
- Add backend route:
  - `POST /api/v8/interview/insights/:id/report-pack`
  - `GET /api/v8/interview/insights/:id/report-pack`
  - `POST /api/v8/interview/report-packs/:id/regenerate`
  - `POST /api/v8/interview/report-packs/:id/review`
  - `POST /api/v8/interview/report-packs/:id/export` if export is in scope.
- Generator maps structured insight data into required worksheets.
- Worksheets are generated with status and completeness.
- Persist source/evidence/degraded ledgers.

Gate:

- A report pack can be regenerated/reopened and survives refresh.

DoD:

- Migration or artifact storage exists.
- API tests cover create/get/regenerate.
- Report pack includes every required worksheet key.
- Empty/degraded worksheets are explicit.
- No silent downstream object creation occurs.

### Phase 8 — Report Pack UI

Goal:

Let the consultant see and operate the complete report pack from the insight viewer.

Tasks:

- Add `Report Pack` area to `InsightViewer`.
- Show:
  - report status,
  - worksheet list,
  - completeness,
  - warnings,
  - material quality,
  - evidence integrity,
  - last generated time,
  - review state.
- Add actions in Menu 3 / command row:
  - generate report pack,
  - regenerate,
  - review/approve,
  - open as report,
  - open as table/sheet,
  - open as presentation.
- Ensure actions follow:

`proposal -> approval -> execution -> audit`

Gate:

- User can understand whether the report is client-ready, partial or blocked.

DoD:

- Loading, empty, success, partial, degraded, failed and retry states exist.
- Main action is visible in the correct command row location.
- Refresh preserves report pack state.
- No raw JSON or provider errors are shown to business users.

### Phase 9 — Six Downstream Actions

Goal:

Connect report pack and insight to the six required actions.

Tasks:

- Ensure document actions open generators/builders with context:
  - report,
  - presentation,
  - table/sheet.
- Ensure application actions create drafts only after user approval:
  - idea,
  - note,
  - initiative.
- For initiative:
  - target is `Interview > Initiatives`,
  - status is `draft`,
  - provenance/confidence boundaries are preserved.
- Include selected finding/candidate context where applicable.

Gate:

- No action blindly creates final output without review/approval.

DoD:

- Tests or manual evidence for all six actions.
- Created objects include lineage to insight/report/finding.
- Initiative is draft, not auto-approved.
- Document generators receive source context and template options.

### Phase 10 — Organization Context And Attachments

Goal:

Ensure external documents improve reports honestly and safely.

Tasks:

- Align with `ORGANIZATION_CONTEXT_ENGINE` docs and `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- Route document ingestion through backend context pipeline.
- Support statuses:
  - `ready`,
  - `partial_ready`,
  - `processing`,
  - `ocr_required`,
  - `unreadable`,
  - `policy_blocked`,
  - `quota_blocked`.
- Support document families:
  - TXT/MD/CSV/JSON,
  - PDF,
  - DOC/DOCX,
  - XLS/XLSX,
  - PPT/PPTX.
- Do not claim AI used a document if only metadata was stored.
- Add lineage from report sections to document chunks when used.

Gate:

- External documents are either truly used as readable context with lineage or honestly labeled as references/unavailable.

DoD:

- UI shows document processing status.
- Backend enforces ACL/tenant scope.
- Report provenance shows context documents used/not used.
- No fake success on unreadable documents.

### Phase 11 — Review, Export And Client-Ready State

Goal:

Define when a report pack becomes safe to share.

Tasks:

- Add review state:
  - `not_reviewed`,
  - `in_review`,
  - `changes_requested`,
  - `approved`.
- Add client-ready checklist:
  - all required worksheets generated or explicitly empty/degraded,
  - material quality visible,
  - evidence refs valid,
  - P10 publish/handoff gates respected,
  - contradictions/gaps visible,
  - recommendations labeled,
  - no raw internals,
  - export ledger ready.
- Export only after explicit user action.

Gate:

- Export/share must not bypass review posture.

DoD:

- Review state persists.
- Export ledger records user/time/format.
- Degraded reports export with visible warning.
- Approved report can be reopened with provenance intact.

### Phase 12 — End-To-End Verification Fixture

Goal:

Verify the full flow on coherent data before declaring PASS.

Create or use a fixture with:

- 5-8 respondents,
- at least 2 roles,
- at least 2 departments,
- at least 2 templates/sheets,
- date range across at least 2 periods,
- strong answers,
- thin answers,
- at least 2 contradictions,
- at least 1 missing voice,
- at least 1 external document,
- at least 1 approved org knowledge source,
- candidate findings,
- one initiative candidate.

Test flow:

1. Create/select approved sessions.
2. Open insight creator.
3. Select scope by date, people and material.
4. Add topic focus and optional leading question.
5. Generate insight.
6. Confirm material quality.
7. Confirm evidence refs and P10 candidates.
8. Generate report pack.
9. Inspect every worksheet.
10. Create one initiative draft from report/insight.
11. Create/open report/table/presentation actions.
12. Refresh and verify persistence.

Gate:

- Full workflow must pass without hidden failures, fake success or lost data.

DoD:

- Test evidence includes UI readback, API/network result where applicable, persisted DB/API state and refresh resistance.
- No P0/P1 remains.
- Any P2 is documented and does not break core workflow.

---

## 9. Integrity Gates Summary

| Gate | Blocking Level | Requirement |
| --- | --- | --- |
| G1 Scope Integrity | P1 | Prompt material exactly matches selected scope. |
| G2 Approved-Only | P0 | No unapproved/incomplete material enters insight/report generation. |
| G3 Option Honesty | P1 | Every UI option has backend effect or is not shown as active. |
| G4 Evidence Integrity | P1 | Evidence refs resolve to real source rows. |
| G5 Material Quality Honesty | P1 | Weak material visibly lowers certainty. |
| G6 Report Completeness | P1 | Every required worksheet is generated, partial, empty or degraded with reason. |
| G7 No Silent Execution | P0 | Downstream app mutations require approval and audit. |
| G8 Context Honesty | P0/P1 | Documents are used only when readable/allowed; otherwise honest degraded state. |
| G9 Review/Export Separation | P1 | Generate/approve/export are not conflated. |
| G10 Refresh Resistance | P1 | Insight/report state survives reload. |

---

## 10. Definition Of Done

The work is complete only when all conditions below are true.

Product DoD:

- User can generate an insight from approved scoped material.
- User can generate a complete report pack from that insight.
- Report pack has all required worksheet keys.
- Material quality and limitations are visible.
- Contradictions and gaps are visible.
- Recommendations are labeled with confidence.
- Initiative candidates are drafts, not silent approved actions.
- Six downstream actions remain available and governed.

Engineering DoD:

- Backend enforces approved-only and scope filters.
- Structured generation schema is versioned.
- Evidence refs are validated.
- Report pack persists and reloads.
- API routes have focused tests.
- Frontend has loading/error/empty/degraded/success states.
- Existing P10 tests still pass.
- Existing insight viewer remains compatible with old insight rows.

UI/UX DoD:

- Main AI actions are in Menu 3 / command row right side.
- No fake success.
- No infinite spinner.
- No raw internals.
- Every mutation has proposal/approval/execution/audit posture.
- User can tell whether report is client-ready.

Verification DoD:

- Unit tests pass for changed services.
- Route/API tests pass for report pack creation and retrieval.
- Component tests pass for creator/viewer/report pack states.
- `git diff --check` passes.
- `ReadLints` is clean for changed files or known unrelated lint is documented.
- Manual E2E fixture run is documented with PASS/PASS_WITH_P2/BLOCKED_P1.

---

## 11. Suggested Test List

Backend:

- `InterviewInsightService` scope filtering by respondent.
- `InterviewInsightService` scope filtering by date.
- `InterviewInsightService` scope filtering by template.
- Approved-only rejection.
- Material pack source summary.
- Evidence-ref validator valid refs.
- Evidence-ref validator invalid refs.
- Report pack generator creates all worksheet keys.
- Report pack degraded worksheet handling.
- Regenerate preserves context selection.

Routes:

- `POST /api/v8/interview/insights`
- `POST /api/v8/interview/insights/:id/report-pack`
- `GET /api/v8/interview/insights/:id/report-pack`
- report-pack regenerate/review/export routes when implemented.

Frontend:

- creator sends selected scope fields.
- viewer displays report pack empty state.
- viewer displays generated report pack.
- viewer displays degraded report pack.
- actions are placed in command row/Menu 3.
- no raw backend error on failure.

E2E/manual:

- full fixture run from creator to report pack to initiative draft.
- hard refresh after each major write.
- verify created report/table/presentation/idea/note/initiative lineage.

---

## 12. PASS Classification

Use `DRD/UI_UX_SOURCE_OF_TRUTH.md` vocabulary.

### PASS

Allowed only when:

- no P0/P1 remains,
- report pack is complete or honestly degraded,
- scope/evidence/material quality are traceable,
- all core writes persist through refresh,
- downstream actions are governed.

### PASS_WITH_P2

Allowed when:

- core workflow works,
- some polish, export formatting or optional worksheet UX remains,
- no trust/governance breach exists.

### BLOCKED_P1

Use when:

- scope does not match analyzed material,
- evidence refs are fake/unvalidated,
- report claims client-ready while missing required worksheets,
- main action fails,
- generated data disappears after refresh,
- UI seriously misleads the user.

### P0

Use when:

- unapproved/cross-tenant data enters a report,
- AI silently creates app objects,
- hidden learning/storage happens outside policy,
- audit trail is missing for critical mutation.

---

## 13. Implementation Order

Recommended order:

1. Scope enforcement and material pack.
2. Analysis mode/output type contract.
3. Topic focus, leading question and consultant note wiring.
4. Structured insight schema upgrade.
5. Evidence-ref validator.
6. Material quality upgrade.
7. Report pack storage/generator.
8. Report pack UI.
9. Six downstream action verification.
10. Context engine/document honesty.
11. Review/export/client-ready state.
12. Full E2E fixture audit.

Do not start report-pack UI before scope integrity and structured data are stable.

---

## 14. Notes For Future Implementers

- Do not edit this plan during implementation unless the product owner explicitly asks for a plan revision.
- Do not overwrite unrelated canvas/artifact changes in the working tree.
- Prefer small commits by phase.
- If a phase reveals incompatible existing behavior, document it as implementation debt and resolve against the source-of-truth section.
- Do not downgrade governance to make the demo look better.
- A partial but honest report is acceptable during development. A fake complete report is not.
- The business meaning is more important than visual completion: every worksheet must answer a real consulting question.

---

## 15. Final Success Statement

This work is successful when a consultant can select approved interview/survey-like material, generate a governed insight, and produce a complete report pack whose worksheets explain:

- what was analyzed,
- who contributed,
- how reliable the material is,
- what patterns emerged,
- where people disagree,
- what evidence supports each finding,
- what remains unknown,
- what actions are reasonable,
- and what should be reviewed or executed next.

At that point `Interview Insight` becomes a real consulting workbench, not an AI summary modal.
