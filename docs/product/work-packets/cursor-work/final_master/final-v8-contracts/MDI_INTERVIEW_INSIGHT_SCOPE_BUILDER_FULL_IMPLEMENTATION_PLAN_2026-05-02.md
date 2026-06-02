# MDI Implementation Plan — Interview Insight Scope Builder + Material Quality + Action Composer

Date: 2026-05-02  
Owner: Product + Engineering  
Status: READY FOR IMPLEMENTATION  
Scope: `Interview Insight` end-to-end rebuild from approved interview material to consulting insight, P10 truth, Material Quality, and six downstream actions.

---

## 0. MDI Meaning

For this work packet, `MDI` means:

- `M` — Mission: why the system exists and what user outcome it must deliver.
- `D` — Delivery: exact implementation phases, files, contracts, tasks and tests.
- `I` — Integrity: gates, DoD, anti-hallucination controls, verification and no-skip rules.

This document is the execution control plan. During implementation, no phase may be treated as complete until its gate is explicitly satisfied.

---

## 1. Mission

Build `Interview Insight` as the consultant-grade artifact produced from approved interview work.

The system must let a consultant:

1. Select approved interview material through a governed source basket.
2. Define the analysis scope and intent.
3. Generate a consulting-quality insight that preserves evidence, people, topics, contradictions and limits.
4. See the quality of the material after generation.
5. Work with AI to draft candidate/P10 findings.
6. Review, read back, publish and hand off findings safely.
7. Convert the insight into six downstream actions:
   - report,
   - presentation,
   - table,
   - idea,
   - note,
   - initiative draft.

The product goal is not "AI summary". The goal is a digital consultant's workbench for turning approved interview evidence into governed decisions, documents and action.

---

## 2. Non-Negotiable Decisions

These decisions are frozen for implementation:

- Insight generation uses only approved/completed interview material.
- The user filters by person, role, department, template/sheet, date and topic focus.
- The user does not select individual questions, answer snippets or arbitrary transcript fragments as the primary source-basket model.
- If no topic focus is selected, AI generates a general consulting synthesis and chooses the most valuable observations.
- A leading question is optional.
- `Material Quality` is generated after insight creation as a required card. It is not a blocking gate.
- Two context modes exist:
  - `selected_interview_material_only`
  - `selected_material_plus_approved_org_knowledge`
- AI may propose candidate findings and P10 wording, but publish still requires operator review.
- P10 findings remain the only publishable truth layer.
- Initiative from insight starts as draft in `Interview > Initiatives`.
- Report/presentation/table actions open their target generator with insight context and optional template selection.

---

## 3. Source Of Truth

Before coding, keep these documents open as the canonical source:

- `docs/product/INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
- `docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `docs/product/INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md`
- `docs/product/INTERVIEW_CONTRADICTION_AND_CLIENT_READBACK_RUNTIME_V8.md`
- `docs/ui-standards/01-shell-layout/n-mode-card-standard.md`
- `server/src/services/v8/interviewInsightCanon.ts`
- `server/src/services/v8/interviewInsightFindingsService.ts`
- `server/src/services/v8/interviewInsightCandidateService.ts`
- `server/src/services/v8/interviewInsightAnalysisService.ts`

If code and documentation disagree, do not guess. Treat the mismatch as implementation debt and resolve against the product docs above.

---

## 4. Current Runtime Baseline

Already present:

- `InsightCreatorModal` exists, but it is still a lightweight generator.
- `InterviewInsightService` generates structured V6 data:
  - `executive_summary`
  - `themes`
  - `issues`
  - `opportunities`
  - `signals`
  - `evidence_map`
  - `missing_data`
- P10 service exists:
  - findings,
  - evidence pointers,
  - readback,
  - lifecycle,
  - handoff,
  - source pack,
  - audit log.
- Candidate triage exists.
- N-mode `InsightViewer` exists with card rail.
- `ArtifactActionPanel` exists and already has six target types.
- `Interview > Initiatives` draft tab exists.

Main gaps:

- no full `Insight Scope Builder 2.0`,
- no persisted scope contract,
- no persisted/generated `Material Quality`,
- prompt does not yet use full scope/context mode,
- action panel creates some artifacts directly instead of opening generator/composer flows,
- document generator handoff contract is not fully wired,
- initiative draft does not yet consume full approved organization context.

---

## 5. Target Architecture

### 5.1 Data Flow

```text
Approved Interview sessions
  -> Insight Scope Builder
  -> InsightAnalysisScope persisted
  -> AI generation prompt
  -> Insight content + material_quality + candidate seeds
  -> N-mode Insight Viewer
  -> candidate triage / P10 findings / readback
  -> Action Composer
  -> report / presentation / table / idea / note / initiative draft
  -> lineage + activity log
```

### 5.2 Key Runtime Objects

`InsightAnalysisScope`:

```ts
type InsightAnalysisScope = {
  source_session_ids: string[];
  source_scope_status: 'approved_only';
  respondent_filters: string[];
  role_filters: string[];
  department_filters: string[];
  template_filters: string[];
  date_range?: { from?: string; to?: string };
  topic_focus: string[];
  analysis_mode:
    | 'general_consulting_synthesis'
    | 'focused_topic_synthesis'
    | 'contradiction_scan'
    | 'initiative_opportunity_scan'
    | 'material_quality_scan'
    | 'hypothesis_validation'
    | 'between_the_lines';
  context_mode:
    | 'selected_interview_material_only'
    | 'selected_material_plus_approved_org_knowledge';
  consultant_note?: string | null;
  leading_question?: string | null;
};
```

`InsightMaterialQuality`:

```ts
type InsightMaterialQuality = {
  overall_material_score: number;
  answer_quality_posture: 'strong' | 'usable' | 'thin' | 'poor';
  coverage_posture:
    | 'single_perspective'
    | 'partial_coverage'
    | 'good_coverage'
    | 'strong_cross_function_coverage';
  approved_session_count: number;
  respondent_count: number;
  role_coverage: string[];
  department_coverage: string[];
  thin_answer_count: number;
  missing_voices: string[];
  evidence_gap_count: number;
  contradiction_count: number;
  limitations: string[];
  recommended_followups: string[];
};
```

`ActionComposerContext`:

```ts
type ActionComposerContext = {
  sourceArtifactType: 'interview_insight';
  sourceArtifactId: string;
  sourceTitle: string;
  selectedFindingId?: string | null;
  selectedCandidateId?: string | null;
  target: 'report' | 'presentation' | 'table' | 'idea' | 'note' | 'initiative';
  contextMode: 'selected_interview_material_only' | 'selected_material_plus_approved_org_knowledge';
  confidenceLevel?: string | null;
  limits?: string | null;
  evidenceCount: number;
  sourcePack: Record<string, unknown>;
  materialQuality?: Record<string, unknown> | null;
  templateId?: string | null;
};
```

---

## 6. Implementation Phases

Each phase has an entry gate, tasks, DoD and exit gate.

### Phase 0 — Technical Recon And Guard Rails

Goal: confirm exact code locations and prevent blind edits.

Entry gate:

- Current branch and dirty files understood.
- Existing docs and services listed.
- No unrelated changes reverted.

Tasks:

- Inspect current `InsightCreatorModal`.
- Inspect `InterviewInsightService.create`, `generateInsight`, `buildV6Prompt`, `parseV6Response`.
- Inspect V8 routes for `/interview/insights`.
- Inspect P10 candidate/finding services.
- Inspect `InsightViewer` card sections and property strip.
- Inspect `ArtifactActionPanel`.
- Inspect report/presentation/table generator entrypoints.

DoD:

- Implementation file map is known.
- Existing tests that can be reused are identified.
- Risks are listed before code edits.

Exit gate:

- No coding starts until the phase map is clear.

---

### Phase 1 — Database And Type Contract

Goal: persist scope, context and material quality without breaking existing insights.

Likely files:

- `server/migrations/<new>_interview_insight_scope_material_quality.sql`
- `server/src/services/InterviewInsightService.ts`
- `src/services/api/v8/interview.ts`

Tasks:

- Add nullable columns to `interview_insights`:
  - `analysis_scope_json TEXT DEFAULT '{}'`
  - `material_quality_json TEXT DEFAULT '{}'`
  - `context_mode TEXT`
  - `analysis_mode TEXT`
  - `topic_focus_json TEXT DEFAULT '[]'`
  - `generation_context_json TEXT DEFAULT '{}'`
- Add backend TypeScript types:
  - `InsightAnalysisScope`
  - `InsightMaterialQuality`
  - `InsightContextMode`
  - `InsightAnalysisMode`
- Extend API DTOs in `src/services/api/v8/interview.ts`.
- Map legacy `filters` to scope fallback for old insights.
- Keep old insight rows readable.

DoD:

- Existing insight list/detail still works for old rows.
- New insight rows can store full scope.
- TypeScript API contract exposes new fields.
- No destructive migration.

Gate G1:

- Migration is additive.
- Backward compatibility is confirmed.
- Unit/integration test covers mapping old and new rows.

---

### Phase 2 — Approved-Only Source Basket

Goal: enforce approved/completed material as the only source of insight generation.

Likely files:

- `server/src/routes/v8/interview.routes.ts`
- `server/src/controllers/InterviewController.ts`
- `server/src/services/InterviewInsightService.ts`
- `src/components/Interview/InsightCreatorModal.tsx`

Tasks:

- Backend validates every `sessionId` before create.
- Allowed states:
  - session completed,
  - assignment approved/completed where assignment exists.
- Reject invalid sources with clear error:
  - `INTERVIEW_INSIGHT_SOURCE_NOT_APPROVED`
  - include blocked session ids and reason.
- Frontend only lists eligible source sessions.
- Frontend shows unavailable count or explanation if useful.
- Existing fallback legacy endpoint respects the same rule.

DoD:

- Cannot create insight from incomplete/unapproved sessions.
- Error is readable.
- Existing approved sessions still generate insights.

Gate G2:

- Test: create with approved session passes.
- Test: create with unapproved session fails.
- UI does not display unapproved sessions as selectable.

---

### Phase 3 — Insight Scope Builder 2.0

Goal: replace "prompt generator" UX with consultant-grade scope builder.

Likely files:

- `src/components/Interview/InsightCreatorModal.tsx`
- optionally extract:
  - `src/components/Interview/InsightScopeBuilder.tsx`
  - `src/components/Interview/InsightScopeSummary.tsx`

Sections:

1. `What are we creating?`
   - title,
   - analysis mode,
   - optional leading question.

2. `Source basket`
   - approved sessions,
   - select all / clear,
   - filters:
     - respondent,
     - role,
     - department,
     - template,
     - date range.

3. `Topic focus`
   - strategy and goals,
   - process and operations,
   - technology and systems,
   - data and reporting,
   - people and roles,
   - ownership and decision rights,
   - risks and blockers,
   - opportunities and improvements,
   - customer / user impact,
   - compliance / governance,
   - change readiness,
   - hidden signals and contradictions.

4. `Context mode`
   - selected material only,
   - selected material + approved org knowledge.

5. `Consultant note`
   - optional instruction.

6. `Review scope`
   - selected sessions count,
   - roles/departments,
   - topic focus,
   - context mode,
   - limitations warning.

DoD:

- User can create a general insight without topic or leading question.
- User can choose focused analysis.
- Payload includes full `InsightAnalysisScope`.
- UI labels make analysis modes understandable in PL.
- No individual answer/question selection is introduced.

Gate G3:

- Component test verifies payload.
- Manual smoke verifies modal can generate a general insight.
- Manual smoke verifies context mode and topic focus persist.

---

### Phase 4 — Prompt Contract And Context Assembly

Goal: make AI generate according to the scope, not generic session summary.

Likely files:

- `server/src/services/InterviewInsightService.ts`
- optionally new:
  - `server/src/services/v8/interviewInsightScopeService.ts`
  - `server/src/services/v8/interviewInsightMaterialQualityService.ts`
  - `server/src/services/v8/interviewInsightPromptBuilder.ts`

Tasks:

- Extend `CreateInsightInput` with scope fields.
- Store scope before generation starts.
- Build prompt from:
  - approved source data,
  - analysis mode,
  - topic focus,
  - context mode,
  - consultant note,
  - leading question.
- If context mode allows org knowledge:
  - gather approved org context through existing organization context/knowledge services,
  - keep it bounded,
  - label it as enrichment.
- Extend AI JSON response with:
  - `material_quality`,
  - `scope_summary`,
  - `candidate_findings_seed`,
  - `consultant_cautions`.
- Parse with safe defaults.
- On parse failure, fail honestly with readable error, not partial fake success.

DoD:

- Prompt includes scope and context mode.
- Output persists material quality.
- Old insight generation still works through fallback defaults.
- AI is explicitly instructed not to overclaim.

Gate G4:

- Unit test validates prompt includes scope.
- Unit test validates parser accepts new schema.
- Unit test validates missing optional fields do not crash mapping.

---

### Phase 5 — Material Quality Card

Goal: add required N-mode card showing how strong the input material is.

Likely files:

- `src/components/Interview/InsightViewer.tsx`
- `src/services/api/v8/interview.ts`
- optionally:
  - `src/components/Interview/InsightMaterialQualityCard.tsx`

Tasks:

- Add `material-quality` to `INSIGHT_SECTIONS` after `executive-summary`.
- Add display:
  - Material Fitness Score,
  - Coverage,
  - Answer Quality,
  - Evidence Sufficiency,
  - Consultant Caution,
  - Recommended Follow-ups.
- Add empty/degraded state for older insights.
- Add badge/score only when loaded.
- Ensure `0` does not mask load errors.

DoD:

- Card renders for new insights.
- Older insights show migration debt / not generated state.
- Weak material is visually clear but not blocking.
- Card affects user interpretation, not lifecycle state directly.

Gate G5:

- Component test renders strong/usable/thin/poor states.
- Component test renders old insight empty state.
- No lints in edited files.

---

### Phase 6 — AI Candidate/P10 Draft Flow

Goal: convert AI insight output into a working layer that a consultant can shape.

Likely files:

- `server/src/services/v8/interviewInsightCandidateService.ts`
- `server/src/routes/v8/interview-insights.routes.ts`
- `src/components/Interview/InsightViewer.tsx`
- `src/services/api/v8/interview.ts`

Tasks:

- Seed candidate findings from `candidate_findings_seed` when available.
- Keep existing backfill from topics as fallback.
- Candidate card must show:
  - statement,
  - rationale,
  - confidence hint,
  - material quality warnings,
  - follow-up type,
  - linked source section.
- Promote to P10 still requires:
  - statement,
  - confidence,
  - limits,
  - next action,
  - evidence pointers or fallback source pointers.
- AI may draft P10 wording but does not publish.

DoD:

- Candidates are pre-truth.
- Promoted P10 findings remain auditable.
- Material Quality limitations are visible during promotion.

Gate G6:

- Test candidate seed -> list candidates.
- Test promote candidate -> P10 finding.
- Test insufficient evidence blocks publish later.

---

### Phase 7 — Action Composer And Six Actions

Goal: make downstream actions controlled, contextual and traceable.

Likely files:

- `src/components/shared/artifact-actions/ArtifactActionPanel.tsx`
- `src/components/Interview/InsightViewer.tsx`
- report/presentation/table builder entrypoints
- `server/src/routes/artifact-conversions.routes.ts`
- `server/src/services/artifacts/ArtifactConversionService.ts`

Tasks:

- Introduce Action Composer state:
  - source insight,
  - selected finding/candidate if applicable,
  - target type,
  - context mode,
  - source pack,
  - material quality,
  - confidence/limits,
  - template if applicable.
- For report:
  - navigate/open report builder with source context and template picker.
- For presentation:
  - navigate/open presentation builder with source context and template picker.
- For table:
  - navigate/open workbook generator with source context.
- For idea:
  - create My Work idea with lineage.
- For note:
  - create Notebook page with lineage.
- For initiative:
  - create draft in `Interview > Initiatives`,
  - use approved org knowledge where allowed,
  - preserve provenance.
- Record conversion after confirmed target creation.
- Failed conversion must not create success state.

DoD:

- All six buttons exist.
- Document buttons do not bypass target generators.
- App actions create objects with source lineage.
- Initiative opens in `Interview > Initiatives`.
- Failed creation shows retryable error.

Gate G7:

- Component/API tests for each target.
- Manual smoke for each action.
- Lineage row recorded for success.
- No ghost target after failure.

---

### Phase 8 — Initiative Draft Hardening

Goal: ensure initiative draft is useful, not a thin copy of the insight.

Likely files:

- `src/components/Interview/InterviewHub.tsx`
- initiative routes/services
- `src/components/Initiatives/*SourceLink*`
- organization context services

Tasks:

- Draft includes:
  - problem/opportunity statement,
  - evidence-backed rationale,
  - suggested scope,
  - expected value hypothesis,
  - risks/limits,
  - owner suggestion,
  - source links,
  - related approved org knowledge.
- Show status:
  - `DRAFT`
  - `PENDING_REVIEW`
  - `PROMOTED`
- Source link returns to insight/finding.
- Keep global initiatives as later promotion stage.

DoD:

- Draft is reviewable inside `Interview > Initiatives`.
- It does not become global execution truth too early.
- It has backlink to insight and source context.

Gate G8:

- Test insight -> initiative draft.
- Test open draft from URL.
- Test source link back to insight.

---

### Phase 9 — Lifecycle, Readback And Publish Hardening

Goal: keep consulting truth governed.

Likely files:

- `server/src/routes/v8/interview-insights.routes.ts`
- `server/src/services/v8/interviewInsightFindingsService.ts`
- `src/components/Interview/InsightViewer.tsx`

Tasks:

- Confirm publish requires:
  - at least one P10 finding,
  - confidence,
  - limits,
  - next action,
  - active evidence,
  - acceptable readback state.
- Ensure challenged/needs_more_evidence reduce readiness.
- Activity log records:
  - scope creation,
  - generation,
  - material quality,
  - candidate triage,
  - finding promotion,
  - readback,
  - handoff/conversion.
- UI shows disabled reasons on blocked actions.

DoD:

- No weak/contradicted insight can look fully published without warnings.
- Publish blockers are readable.
- Activity log is complete enough for audit.

Gate G9:

- Backend tests publish blockers.
- UI test blocked action reason.
- Activity entries exist after mutations.

---

### Phase 10 — Tests, Regression And Release Readiness

Goal: verify the whole system end to end.

Required tests:

- Backend:
  - approved-only source validation,
  - scope persistence,
  - prompt builder with scope/context mode,
  - parser with material quality,
  - candidate seed and promotion,
  - publish blockers,
  - handoff/conversion lineage.
- Frontend:
  - Scope Builder payload,
  - Material Quality card,
  - Candidate triage,
  - Action Composer states,
  - initiative draft tab selection.
- Smoke:
  - create insight from approved sessions,
  - open insight,
  - review material quality,
  - promote candidate,
  - send to review,
  - create initiative draft,
  - create report/presentation/table context handoff where builders are available.

DoD:

- No lints introduced in touched files.
- Targeted tests pass or failures are documented as pre-existing.
- Full flow works locally against available dev data.
- Any unavailable external dependency is marked explicitly.

Gate G10:

- Final status report lists:
  - implemented phases,
  - tests run,
  - known risks,
  - deferred items,
  - exact files changed.

---

## 7. Anti-Hallucination Protocol

During implementation:

1. Before editing a file, read the exact current file section.
2. Do not invent endpoint names. Search for existing routes first.
3. Do not invent database columns. Add migration or map to existing columns.
4. Do not assume generator routes exist. Inspect report/deck/workbook builders before wiring.
5. Do not silently fallback to old behavior if a new field is required. Use explicit defaults.
6. Do not treat demo data as production contract.
7. Do not mark a phase complete without satisfying its gate.
8. If a test cannot be run, state why and what remains unverified.
9. Keep old insights readable.
10. Never remove user changes or unrelated work.

---

## 8. Phase Gate Board

| Gate | Name | Pass condition |
| --- | --- | --- |
| G0 | Recon complete | File map, risks and reusable tests identified |
| G1 | Data contract | Additive migration, legacy rows still readable |
| G2 | Approved-only | Backend blocks unapproved sessions; UI lists eligible sources |
| G3 | Scope Builder | Full scope payload submitted and persisted |
| G4 | Prompt contract | AI prompt/parser handles scope, context and material quality |
| G5 | Material Quality | Required card renders new/legacy states honestly |
| G6 | Candidate/P10 | AI candidates can become governed P10 findings |
| G7 | Six Actions | All targets route/create with lineage and no ghost success |
| G8 | Initiative Draft | Draft created in `Interview > Initiatives` with rich context |
| G9 | Lifecycle | Publish/readback/handoff blockers enforced and visible |
| G10 | Release readiness | Tests/smoke/status report complete |

---

## 9. Global Definition Of Done

The implementation is complete only when:

- `Insight Scope Builder 2.0` exists and replaces the old lightweight generator UX.
- Insights can be created only from approved/completed material.
- Scope is persisted and visible in the generated artifact.
- Prompt uses analysis mode, topic focus, context mode, consultant note and optional question.
- `Material Quality` is generated and rendered as a required card.
- Candidates and P10 findings remain separate.
- P10 findings are the only publishable truth.
- Six downstream actions work according to the integration contract.
- Document actions open generator/composer flows with context and optional templates.
- Initiative action creates draft in `Interview > Initiatives`.
- Lineage is recorded for every successful downstream action.
- Failed downstream actions do not show false success.
- Readback/publish blockers are enforced.
- Activity log shows meaningful audit history.
- Targeted tests pass or any failures are explicitly classified.
- No undocumented product shortcuts remain.

---

## 10. Implementation Order Summary

1. Recon and file map.
2. Migration and shared types.
3. Approved-only source validation.
4. Scope Builder 2.0 UI.
5. Scope persistence and prompt contract.
6. Material Quality backend.
7. Material Quality N-mode card.
8. Candidate seed/P10 promotion hardening.
9. Action Composer and six actions.
10. Initiative draft hardening.
11. Lifecycle/readback/publish hardening.
12. Tests and release readiness.

This order is mandatory because it preserves the consulting logic:

`scope -> material -> interpretation -> truth -> action`

not:

`button -> AI summary -> accidental action`.

