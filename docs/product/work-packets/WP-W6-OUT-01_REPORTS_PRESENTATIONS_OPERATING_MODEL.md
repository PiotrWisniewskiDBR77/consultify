# WP-W6-OUT-01 — Reports and Presentations Operating Model Analysis

> Status: Completed
> Packet: WP-W6-OUT-01
> Wave: 6 — Outputs, finance and realization
> Priority: P1
> Date: 2026-03-23
> Canonical inputs read:
> - `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
> - `REPORTS_V8_SSOT.md`
> - `REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md`
> - `REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md`
> - `REPORTS_V8_DELIVERY_AND_EXPORT_RUNTIME.md`
> - `REPORTS_V8_RECURRING_AUTOMATION_AND_DISTRIBUTION_RUNTIME_V8.md`
> Supporting anchors:
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` — §8.7 Wave 6
> - `WP-W2-AI-03_PROMPT_OS_RUNTIME_DISCIPLINE.md` — release-aware AI runtime
> - `DECISION_LOG_WAVE_2.md` — Decisions W2-8 to W2-12 (eval gates, prompt OS)

---

## 1. Report/presentation lifecycle

### 1.1 Canonical lifecycle states

Both reports and presentations share a unified delivery-state vocabulary (`REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9, `REPORTS_V8_SSOT.md` §9):

```
draft → generated → editing → in_review → ready → shared → archived
```

| State | Meaning |
|---|---|
| `draft` | Initial shell or early structure |
| `generated` | First AI draft exists |
| `editing` | Artifact is being refined by user or AI co-author |
| `in_review` | Feedback or approval cycle is active |
| `ready` | Approved for delivery |
| `shared` | Distributed or externally available |
| `archived` | No longer actively maintained |

### 1.2 Canonical flow

The end-to-end flow for reports (`REPORTS_V8_SSOT.md` §7):

```
library → define → sources → outline → generate → builder → review → ready → share/export → follow-through
```

Supported entry paths:

- **Template-first:** choose template → inspect fit → adapt source context → review outline → generate artifact
- **Source-first / free-intelligence mode:** choose source pack → AI recommends template → user accepts/refines → review outline → generate artifact
- **Upload-chaos mode:** uploaded external material drives initial context
- **Cross-module entrypoint:** creation triggered from Finance, Results, Initiatives, Execution, Tools, Interview, Notes, or Idea

### 1.3 Output choice doctrine

The operating model (`REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §4) defines three primary output choices:

| Choice | When to use | Examples |
|---|---|---|
| `report-first` | Main artifact is a management or evidence document; presentation may be derived later | Steering committee report, portfolio review, due-diligence report, finance review pack |
| `presentation-first` | Main artifact is meant for meeting delivery; report is optional | Workshop deck, board presentation, initiative pitch, sales briefing |
| `paired-output` | Both reading pack and deck are expected; one supports the other | Board pack + board deck, initiative review report + steering deck |

The system should eventually recommend the output mode based on audience, goal, communication register, density needs, delivery mode, and whether live presenting is expected. AI may propose; the user remains the decider.

### 1.4 Promotion doctrine

The output family supports bidirectional promotion (`REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §12):

- Report promoted into presentation
- Presentation promoted into report
- Paired-output generated from the same source pack

Promotion must preserve: title/objective continuity, source refs, context-pack lineage, audience and register intent, brand and confidentiality defaults. Promotion must adapt: density, narrative shape, section vs. slide structure, delivery expectations.

Canonical rule: `promotion or conversion between outputs must not discard source lineage`.

### 1.5 Canonical surfaces

`REPORTS_V8_SSOT.md` §6 defines seven canonical surfaces:

1. **Reports Hub** — library of artifacts, templates, schedules
2. **Report Wizard** — define intent, choose source context, choose template or free mode, review AI outline, create first draft
3. **Report Builder** — refine sections/blocks, review AI suggestions, manage comments, validate quality gates, prepare delivery
4. **Online Report View** — render the canonical online artifact with structure, sections, citations, refresh states
5. **Review and Approval** — comments, change requests, approval blockers, reviewer acknowledgment
6. **Share and Export** — controlled distribution, export projections, export history
7. **Schedules and Automation** — recurring reports, scheduled generation, recurring delivery and alerts

---

## 2. AI operating model for outputs

### 2.1 Core governance rule

Both output systems follow the same AI governance pattern (`REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §7):

```
AI propose → user review → accept/reject/refine → execution
```

Shared AI rules:

- No silent edits
- No fake evidence
- No hidden traceability loss
- No delivery-state mutation without explicit user action

### 2.2 AI operation classes

`REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` §3 defines three operation classes:

| Class | Characteristics | Examples |
|---|---|---|
| `AI suggest` | Advisory only; no direct report mutation; auditable when consequential | "This section is too short", "Evidence is weak here", "This recommendation is not grounded enough" |
| `AI draft` | Creates proposal content; does not mutate approved state; must be reviewable before application | Draft outline, draft full report, draft section rewrite, draft executive summary, draft refresh proposal |
| `AI apply after acceptance` | Mutates content only after approval; must reference the accepted proposal; must preserve mutation trace | Apply accepted section rewrite, apply accepted executive summary, apply accepted evidence-backed refresh |

### 2.3 Scope levels

AI operations operate at three scope levels (`REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` §4):

- **Report scope:** full artifact operations (generate full draft, tighten density, rewrite executive narrative, convert to board-ready style)
- **Section scope:** single section operations (regenerate, deepen, shorten, refresh from sources)
- **Block scope:** single block operations (rewrite paragraph, restructure bullet list, refresh chart explanation)

### 2.4 Canonical AI operation kinds

The report system must support at least (`REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` §5):

- `outline_proposal`
- `report_generation`
- `section_generation`
- `section_rewrite`
- `section_refresh_proposal`
- `summary_rewrite`
- `recommendation_rewrite`
- `compliance_rewrite`
- `quality_suggestion`
- `coverage_suggestion`

### 2.5 Proposal doctrine

Every `AI draft` must expose (`REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` §6):

- What will change
- Where it will change
- Why AI proposes it
- What evidence it used
- What risk or uncertainty remains

### 2.6 Review and acceptance state flow

```
drafted → pending_review → accepted → applied
```

Alternative endings: `pending_review → rejected`, `drafted → failed`, `accepted → failed`.

Only accepted proposals may mutate canonical report content. Rejected proposals must leave the report unchanged. Failed proposals must preserve audit context.

### 2.7 Mutation bridge

Every applied mutation must preserve (`REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` §8): source operation ID, report scope, affected section/block, before state reference, after state reference, mutation summary, actor and timestamp.

### 2.8 Source grounding and refresh

AI must remain source-aware: cite section-level or block-level grounding, identify weak evidence, distinguish between source fact and generated interpretation.

Refresh flow (`REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` §10):

```
source change → refresh proposal → review → accept/reject → apply → review state update
```

Forbidden: silently overwriting reviewed sections after a source refresh.

### 2.9 AI and quality gates

AI supports quality gates by suggesting fixes, improving traceability coverage, proposing more compliant language, flagging logic gaps before export. AI does not bypass quality gates — the quality engine remains authoritative.

### 2.10 AI and delivery governance

AI may prepare executive summaries, board-ready narrative variants, and distribution-specific wording adjustments. AI may not mark a report as approved, share it externally, or remove review blockers.

---

## 3. Template system

### 3.1 Current state assessment

`REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md` §2 provides the executive verdict:

| Area | State |
|---|---|
| Presentations template library | `PARTIAL-STRONG` |
| Reports template library | `PARTIAL-WEAK` |
| Shared template generator runtime | `MISSING` |

Reports already define first-class `ReportTemplate` objects and canonical report families `R1-R4`. Presentations already have a visible gallery and clone semantics. What is missing is the unified template generator runtime that connects both.

### 3.2 Canonical template object model

The output family should converge on a shared `OutputTemplate` vocabulary (`REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md` §6.1):

- `templateId`, `outputType`, `templateFamily`, `name`, `description`, `scope`
- `audienceDefaults`, `goalDefaults`, `communicationRegisterDefaults`, `brandDefaults`
- `sourceExpectations`, `structureBlueprint`, `qualityRules`, `generationHints`
- `sampleContentPolicy`, `status`, `isSystem`, `clonedFromTemplateId`

Report-specific extensions: `reportType`, `sectionBlueprint`, `sectionRequiredness`, `ragLogicHints`, `defaultExportModes`, `refreshPolicy`.

Presentation-specific extensions: `deckType`, `outlineBlueprint`, `mustHaveIntents`, `visualHints`, `slideCountRange`, `speakerNotesPolicy`.

### 3.3 Paired-output template family

The system should support a `PairedOutputTemplateFamily` object for scenarios like board pack + board deck, finance report + executive summary deck, initiative review report + steering deck. Fields: `familyId`, `familyName`, `reportTemplateId`, `presentationTemplateId`, `sharedSourceExpectations`, `sharedAudienceIntent`, `promotionHints`.

### 3.4 Template scopes and ownership

| Scope | Owner | Purpose |
|---|---|---|
| System templates | Platform / SuperAdmin | Canonical best-practice starter templates, benchmark-grade starting points |
| Organization templates | Org admin / authorized domain leads | Org-specific branding, local board pack conventions, local patterns |
| Personal drafts | Individual user | Working template drafts, not yet globally reusable |

Rule: `personal drafts should not masquerade as trusted organizational templates`.

### 3.5 Canonical template flows

1. **Template-first generation:** choose template → inspect fit → adapt source context → review outline → generate artifact
2. **Source-first recommendation:** choose source pack → AI recommends template → user accepts/refines → review outline → generate artifact
3. **Save as template:** existing report or deck → extract reusable blueprint → review template payload → save as org or personal template
4. **Clone and adapt:** system template → clone → adapt → save as org template
5. **Paired-output generation:** choose family template → create report and presentation from one source pack → preserve shared lineage

### 3.6 Template recommendation engine

The generator should recommend templates based on: source module, source artifact type, audience, goal, communication mode, confidentiality, delivery mode. Template recommendation may be AI-assisted, but the user remains the decider.

### 3.7 Template quality and trust

Templates are first-class quality objects. Each serious template must declare: required source classes, intended audience, communication register, required sections/slide intents, quality constraints, brand constraints. Template QA must validate: structural completeness, source compatibility, output-family compatibility, brand completeness, duplicated or stale guidance.

Rule: `a weak template can degrade many outputs, so template quality must be governed more strictly than one-off drafts`.

### 3.8 P0 gaps to close

- Shared output-template runtime
- Report template runtime closure
- Save-as-template doctrine
- Source-aware template recommendation
- Paired-output template family concept

---

## 4. Delivery and export runtime

### 4.1 Core delivery principle

The canonical report is the online artifact. PDF/DOCX/PPTX and similar outputs are governed delivery projections of that artifact (`REPORTS_V8_DELIVERY_AND_EXPORT_RUNTIME.md` §2).

Rule: `every report delivery action must preserve review state, confidentiality, source freshness awareness and distribution audit`.

### 4.2 Canonical delivery modes

| Mode | When to use |
|---|---|
| `internal_review` | Report is under comment and approval; reviewers need online access |
| `internal_ready_read` | Report is approved internally; meant for internal consumption |
| `executive_delivery` | Artifact is ready for leadership/sponsor consumption; final quality gates matter |
| `external_controlled_share` | Report may be shared outside controlled internal audience; confidentiality and audit controls explicit |
| `export_projection` | User needs PDF, DOCX, PPTX or another delivery representation |

### 4.3 Delivery state model

Delivery state is separate from report status:

- `not_deliverable`
- `review_only`
- `ready_for_internal_delivery`
- `ready_for_executive_delivery`
- `ready_for_external_delivery`
- `delivery_revoked`

A report may be `editing` and therefore only `review_only`. A report may be `ready` but still not `ready_for_external_delivery`.

### 4.4 Readiness gates

| Delivery level | Required | Not required |
|---|---|---|
| Internal review share | Report exists, structure is readable, reviewers can see current state | Final approval, full quality closure |
| Executive delivery | No blocking review comments, quality gates pass at required severity, acceptable traceability coverage, no material freshness ambiguity | — |
| External delivery | Explicit user action, confidentiality check, export/share policy compliance, no unresolved material quality blocker, no hidden stale-source risk | — |

Rule: `external delivery is never implied by report generation alone`.

### 4.5 Export doctrine

Supported export classes: `pdf`, `docx`, `pptx` (where relevant as projection), other controlled formats if added later.

The system preserves: which report version was exported, who exported it, under which freshness and review state, whether a newer online truth now exists.

Rule: `exports are frozen delivery projections of a report version, not the primary report object`.

### 4.6 Freshness and export invalidation

Reports may be: `current`, `stale_vs_source`, `refresh_available`, `refresh_requires_review`, `manually_detached`.

If report truth changes after export, previous exports remain historical records but the system must show that the export may no longer represent latest truth. Users must be warned before re-sharing stale exports.

### 4.7 Canonical delivery objects

- **`ReportDeliveryContext`:** `reportId`, `deliveryMode`, `audience`, `confidentiality`, `reviewState`, `qualityState`, `freshnessState`, `distributionPolicy`
- **`ReportExportRecord`:** `exportId`, `reportId`, `exportType`, `sourceVersionRef`, `reviewStateAtExport`, `qualityStateAtExport`, `freshnessStateAtExport`, `generatedAt`, `generatedBy`
- **`ReportDistributionRecord`:** `distributionId`, `reportId`, `deliveryMode`, `recipientScope`, `sharedAt`, `sharedBy`, `revokedAt`, `distributionNotes`

---

## 5. Recurring automation

### 5.1 Core principle

Recurring reports remain part of the canonical report runtime, not a separate automation product (`REPORTS_V8_RECURRING_AUTOMATION_AND_DISTRIBUTION_RUNTIME_V8.md` §2).

Rule: `scheduled generation and recurring distribution must preserve the same source, review, freshness and delivery governance as one-off reports`.

### 5.2 Recurring runtime capabilities

The runtime must support:

- Schedule creation
- Source refresh before run
- Stale detection
- Conditional regeneration
- Re-review when material changes occur
- Controlled distribution after run

### 5.3 Schedule classes

| Class | Description |
|---|---|
| `time_based` | Calendar-driven (weekly, monthly, quarterly) |
| `event_triggered` | Triggered by source-data change events |
| `review_cadence` | Aligned with review or governance cycles |
| `distribution_cadence` | Aligned with audience distribution expectations |

### 5.4 Material-change doctrine

Not every refresh should auto-regenerate and redistribute. The runtime must distinguish:

| Change level | Behavior |
|---|---|
| No significant change | No action required |
| Minor update | May auto-regenerate; distribution optional |
| Material update | Must reopen review path before executive/external redistribution |
| Critical review-required update | Must reopen full review before any redistribution |

Rule: `material or critical change must reopen the right review path before external or executive redistribution`.

### 5.5 Recurring distribution

The runtime supports: internal routine send, executive cadence send, external controlled send where explicitly allowed. It must preserve: distribution audit, freshness state at send time, review state at send time.

### 5.6 AI role in recurring automation

AI may: summarize what changed since last run, draft updated executive summary, propose whether re-review is needed. AI may not: auto-approve redistributed report, suppress material freshness warnings.

---

## 6. Prompt OS integration

### 6.1 Relevant Prompt OS runtime contracts

`WP-W2-AI-03_PROMPT_OS_RUNTIME_DISCIPLINE.md` §5.1 defines the `report_builder` preset as one of seven canonical runtime presets. This preset defines: intended task family (report generation), response shape defaults, evidence expectations, allowed tools, preferred memory profile, routing expectations, and degraded-mode semantics.

The report/presentation AI operating model must consume Prompt OS infrastructure through:

| Prompt OS layer | Report/presentation consumption |
|---|---|
| Composition model (8 canonical layers) | Report AI operations compose prompts through the governed assembler; report-specific blocks (e.g., evidence-density, section-refresh) are injected as composable modifiers within the block doctrine |
| Release bundles | Every prompt change affecting report generation must ship as an atomic release bundle (prompt version + model + fallback + policy). Per Decision W2-12, coordinated multi-key releases must support bundle-level rollback |
| Eval gates | Report-specific golden sets must exist per `WP-W2-AI-03` §3.5 ("Report and presentation support" is a canonical golden-set family). Per Decision W2-8, thresholds are per purpose family; per Decision W2-9, `report_builder` preset should use hard gates given the high business consequence of report outputs |
| Runtime presets | The `report_builder` preset governs report generation; presentation generation may require a dedicated `presentation_builder` preset or a shared `output_builder` family |
| Output contracts | Report AI operations should produce structured outputs (`ArtifactDraft`, `ProposalList`, `StructuredJson`) that feed the mutation bridge, not only free-text responses |
| Memory profiles | Report generation should use `session` memory for working context and `persistent` memory for organization-level learned instructions (e.g., preferred report style, brand voice) |
| Degraded-state handling | If retrieval is unavailable, report generation must fail-closed (not generate evidence-backed sections without evidence). Per Decision W2-10, deeper changes to report prompts require deeper eval |

### 6.2 Eval gate integration

Per Decisions W2-8 and W2-9:

- Report/presentation AI is a high-consequence output surface. Eval gates for the `report_builder` preset should be hard gates.
- Eval must cover: quality (evidence density, reasoning coherence, recommendation grounding), trust (source-fact vs. generated-interpretation ratio), cost/latency, and schema compliance (structured output validation).
- Golden sets for report and presentation support must include: outline generation scenarios, section draft scenarios, refresh-after-source-change scenarios, executive summary rewrite scenarios.

### 6.3 Rollback implications

If a prompt release degrades report generation quality:

- The `report_builder` preset must be rollback-targetable independently of other presets (per `WP-W2-AI-03` §4.4).
- If the release was a coordinated multi-key change (e.g., report_builder + finance_analyst), per Decision W2-12, the entire bundle must be rollback-aware.

### 6.4 Observability

Every report AI operation must produce a `PromptTraceRecord` (`WP-W2-AI-03` §6.1) that captures: `prompt_key`, `prompt_version`, `release_bundle_id`, `preset_id`, `runtime_parameters`, `memory_profile`, `evidence_and_tool_policy`, `model_and_fallback_chain`, `output_contract`, `degraded_mode_state`.

This trace record feeds into the unified `SupportTrace` and enables operators to answer: "For this report section, which prompt version generated it, which model executed it, and what trust class was assigned?"

---

## 7. Downstream dependency map

### 7.1 What this analysis provides to later work

| Downstream capability | Dependency on this analysis | Consequence if missing |
|---|---|---|
| **WP-W6-OUT-04 (Publish/review semantics)** | This analysis defines the lifecycle states, review model, and delivery governance that publish/review semantics must build upon. | Publish/review semantics would need to re-derive the report lifecycle and approval model. |
| **Report/presentation engineering implementation** | This analysis maps the full operating model: lifecycle, AI governance, template system, delivery, recurring automation, and Prompt OS integration. Engineering can implement against a validated architecture. | Engineering implements against fragmented docs; risk of inconsistent AI governance and delivery paths. |
| **Template system implementation** | This analysis identifies the P0 gaps (shared template runtime, save-as-template, paired-output families) and the canonical object model. | Template implementation proceeds without a unified vocabulary or paired-output concept. |
| **Recurring automation implementation** | This analysis defines schedule classes, material-change doctrine, and re-review governance. | Recurring reports may bypass review governance or auto-distribute stale content. |
| **Prompt OS — report_builder preset tuning** | This analysis specifies that report AI should use hard eval gates, fail-closed degraded mode for evidence-backed sections, and structured output contracts. | Report prompts ship without appropriate eval rigor or degraded-state handling. |
| **Wave 6 closure** | This is one of four Wave 6 packets. It must be complete before Wave 6 can close. | Wave 6 cannot close; downstream waves are blocked. |

### 7.2 What this analysis depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W2-AI-03 — Prompt OS Runtime Discipline** | Composition model, release bundles, eval gates, rollback path, runtime presets, observability model, degraded-state handling | Completed |
| **DECISION_LOG_WAVE_2** — Decisions W2-8 to W2-12 | Eval gate thresholds per purpose family, hard/soft gate policy per preset, eval depth tiering, canary population architecture, multi-key coordinated rollback | Ratified |
| **Canonical output docs** (6 docs listed in header) | Product truth for report/presentation lifecycle, AI governance, templates, delivery, recurring automation | Draft v8 (stable) |

---

## 8. Open questions and conflicts

### 8.1 Report template runtime is PARTIAL-WEAK

The template generator doc (`REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md` §2) explicitly rates the reports template library as `PARTIAL-WEAK` and the shared template generator runtime as `MISSING`. This is the largest functional gap in the output operating model. Without the shared template runtime, report and presentation template systems will continue to diverge.

**Recommendation:** Prioritize the shared `OutputTemplate` vocabulary and the report template runtime closure as P0 deliverables within Wave 6.

### 8.2 Presentation-specific AI governance is not yet documented at the same depth as reports

`REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` provides deep AI governance for reports (operation classes, scope levels, mutation bridge, refresh semantics). The operating model doc states that both outputs should share the same AI governance pattern, but no equivalent `PRESENTATIONS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` exists. The shared doctrine is stated at principle level but not closed at runtime level for presentations.

**Recommendation:** Either extend the existing AI governance doc to cover presentation-specific operations (slide-level mutations, visual-hint proposals, speaker-note generation) or produce a dedicated presentation AI governance runtime doc.

**Escalation required:** Product must decide whether presentation AI governance is a separate doc or an extension of the report AI governance doc.

### 8.3 `report_builder` vs. `presentation_builder` preset boundary

`WP-W2-AI-03` §5.1 defines a `report_builder` preset but does not define a `presentation_builder` preset. The operating model requires both outputs to share AI governance but acknowledges that report AI requires deeper evidence continuity than presentation AI. It is unclear whether one preset serves both or whether a dedicated presentation preset is needed.

**Recommendation:** Define a `presentation_builder` preset (or a shared `output_builder` family with report/presentation variants) so that eval gates, memory profiles, and degraded-state handling can be tuned independently for each output type.

**Escalation required:** Product/engineering must decide the preset boundary.

### 8.4 Paired-output template family is conceptual only

The `PairedOutputTemplateFamily` object is defined in the template doc (§6.4) but no canonical paired-output families are instantiated. Without concrete family definitions (e.g., "board pack + board deck"), the paired-output flow cannot be tested or validated.

**Recommendation:** Define at least three canonical paired-output families (board pack, finance review, initiative steering) as system templates before Wave 6 closure.

### 8.5 Recurring automation for presentations is not addressed

`REPORTS_V8_RECURRING_AUTOMATION_AND_DISTRIBUTION_RUNTIME_V8.md` covers recurring reports but does not mention recurring presentations. The operating model treats both as one output family, so recurring automation should logically extend to presentations (e.g., recurring executive briefing decks).

**Recommendation:** Extend the recurring automation runtime to cover presentation outputs, or explicitly scope it as report-only with a rationale.

### 8.6 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §7 (shared AI doctrine) ↔ `REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md` §2 (core rule): Both require propose → review → accept/reject for consequential AI actions. The governance doc adds operational depth (three operation classes, scope levels, mutation bridge) that is compatible with the operating model's principle-level statement.
- `REPORTS_V8_SSOT.md` §9 (lifecycle states) ↔ `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9 (shared delivery vocabulary): Identical seven-state lifecycle. No contradiction.
- `REPORTS_V8_DELIVERY_AND_EXPORT_RUNTIME.md` §6 (delivery state model) ↔ `REPORTS_V8_SSOT.md` §9 (report status lifecycle): The delivery doc explicitly states that report status and delivery state are related but not identical. This is a complementary distinction, not a conflict.
- `REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md` §6 (template object model) ↔ `REPORTS_V8_SSOT.md` §8.4 (ReportTemplate): The template doc's `OutputTemplate` is a superset that includes the SSOT's `ReportTemplate` fields. Compatible extension.
- `REPORTS_V8_RECURRING_AUTOMATION_AND_DISTRIBUTION_RUNTIME_V8.md` §2 (recurring = canonical runtime) ↔ `REPORTS_V8_DELIVERY_AND_EXPORT_RUNTIME.md` §2 (delivery = downstream runtime): Both position their concerns as layers of the canonical report spine. No contradiction.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Report/presentation lifecycle with seven canonical states, four entry paths, three output choices (report-first, presentation-first, paired-output), bidirectional promotion doctrine, and seven canonical surfaces
  - AI operating model with three operation classes (suggest, draft, apply after acceptance), three scope levels, ten canonical operation kinds, proposal doctrine, review/acceptance state flow, mutation bridge, source grounding, refresh semantics, quality gate support, and delivery governance boundaries
  - Template system with shared `OutputTemplate` vocabulary, report/presentation-specific extensions, `PairedOutputTemplateFamily` concept, three ownership scopes, five canonical template flows, recommendation engine requirements, quality/trust governance, and P0 gap identification
  - Delivery and export runtime with five delivery modes, six delivery states (separate from report status), three-tier readiness gates, export doctrine with version/freshness tracking, freshness invalidation model, and three canonical delivery objects
  - Recurring automation with four schedule classes, four-level material-change doctrine, re-review governance, recurring distribution with audit preservation, and AI role boundaries
  - Prompt OS integration mapping `report_builder` preset to composition model, release bundles, eval gates (hard gates per Decision W2-9), output contracts, memory profiles, degraded-state handling (fail-closed for evidence-backed sections), and observability via `PromptTraceRecord`
  - Downstream dependency map (six downstream consumers, three upstream dependencies)
  - Open questions and conflict analysis (5 open questions, 0 conflicts between canonical docs)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Shared template generator runtime is `MISSING` (§8.1) — largest functional gap; must be closed in Wave 6
  - Presentation AI governance is not documented at report-level depth (§8.2) — risk of divergent AI behavior between outputs
  - `report_builder` vs. `presentation_builder` preset boundary is undefined (§8.3) — blocks independent eval tuning
- **Questions requiring escalation:**
  1. Should presentation AI governance be a separate doc or an extension of the report AI governance doc? (§8.2)
  2. Should report and presentation generation use one shared preset or separate presets with independent eval gates? (§8.3)
  3. Which three canonical paired-output template families should be defined as system templates for Wave 6? (§8.4)
  4. Should recurring automation extend to presentations, or is it explicitly report-only? (§8.5)
