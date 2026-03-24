# WP-W6-OUT-03 — Finance Integration and Promotion Runtime Analysis

> Status: Completed
> Packet: WP-W6-OUT-03
> Wave: 6 — Outputs, finance and realization
> Priority: P1
> Date: 2026-03-23
> Canonical inputs read:
> - `FINANCE_V8_SSOT.md`
> - `FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md`
> - `FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md`
> - `FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
> - `FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md`
> - `FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md`
> Supporting anchors read:
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.7
> - `work-packets/WP-W3-LIFECYCLE-01_SOURCE_TRUTH_PRESERVATION.md` — source governance
> - `work-packets/DECISION_LOG_WAVE_3.md` — Decision W3-1 (source materialization UX)

---

## 1. Finance data ingestion

### 1.1 Core ingestion doctrine

Finance ingestion is the first gate in the entire Finance v8 pipeline. The canonical target flow is:

```
document → recognition → confidence → readiness → first defensible model → review
```

(`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §2)

The governing rule is that first-model quality is a product responsibility, not a user rescue task. The system must support the real documents finance teams already use: PDF, Excel, and governed cloud-linked sources.

### 1.2 Three input families

| # | Input family | Supported formats | Key capabilities |
|---|---|---|---|
| 1 | **PDF documents** | Statutory statements, management reports, lender packs, investor attachments, scanned PDFs | Page/section detection, table extraction, statement-family classification, period detection, quality warnings |
| 2 | **Excel and spreadsheet** | `xlsx`, `xls`, `csv`, multi-sheet models, budget workbooks, forecast files | Sheet selection, table-range detection, header/period inference, formula-awareness, imported-value vs workbook-logic split |
| 3 | **Cloud-linked external sources** | Google Drive, OneDrive, SharePoint, connector-linked cloud files | Link/picker-based selection, source identity and freshness tracking, re-import/refresh behavior, one-time vs linked distinction, permission-aware access |

(`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §3)

### 1.3 Import-mode doctrine

The product must distinguish three import modes explicitly:

| Mode | Behavior | Governance requirement |
|---|---|---|
| **Direct upload** | Local PDF, Excel, CSV uploaded to platform | Declare: values only, no live link |
| **Cloud import** | User selects file from connected cloud storage, creates local finance snapshot | Declare: snapshot, manual refresh |
| **Linked source** | Finance workbook in Drive/SharePoint remains linked for governed refresh | Declare: live link, governed refresh, formula handling, source-disappearance behavior |

Every mode must declare whether the system imports values only or keeps a live link, whether refresh is manual or governed, whether formulas are imported as values or as inspectable workbook structure, and what happens if the external source changes or disappears (`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §5).

### 1.4 Three recognition levels

| Level | Purpose | Output |
|---|---|---|
| **Level 1 — Document recognition** | Identify whether file is financial, likely statement family, periods, reporting standard, language, layout class, source type | Classification metadata |
| **Level 2 — Line recognition and mapping** | Identify candidate financial rows, canonical line mapping, exclusions, ambiguity hotspots, per-row/per-section confidence | Mapping confidence matrix |
| **Level 3 — Modeling readiness** | Determine whether recognized pack can seed a professional first model, what assumptions/fields are missing, whether result is `ready`, `recoverable`, or `blocked` | Readiness verdict |

(`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §4)

### 1.5 Recognition confidence doctrine

Every recognition run must expose: document confidence, statement-type confidence, row mapping confidence, period confidence, model-seeding confidence, and extraction/table-structure confidence. Low-confidence areas must produce explicit warnings, recovery suggestions, and no silent promotion into trusted downstream analysis (`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §6).

### 1.6 Canonical states

```
pending → recognized → recoverable or ready → first_model_draft → reviewed
```

Failure states: `unsupported`, `ambiguous`, `insufficient_for_model`, `linked_but_stale`.

### 1.7 First model output contract

The generated first model must always include: recognized source pack references, source type and import mode, modeled periods, gap list, inserted assumptions, validation results, balance and tie-out status, and a first-model health score covering data completeness, mapping completeness, statement consistency, driver confidence, and model usability for analysis/budget/valuation (`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §10).

### 1.8 Linked-source and freshness governance

For cloud-linked files, the product must preserve: source provider, source object ID, last import/refresh time, freshness state, credential/ownership context, and whether the local statement pack reflects the latest remote version. Forbidden behavior: silently refreshing a linked source and mutating approved finance outputs without review (`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §7).

---

## 2. Financial model linkage

### 2.1 Two-layer doctrine

The canonical docs define two related but distinct layers for initiative-finance connection:

| Layer | Location | Purpose |
|---|---|---|
| **Initiative economics layer** | Inside the initiative | Fast business impact framing: CAPEX, OPEX, benefit, timing assumptions. Optional before a full finance model exists. |
| **Finance model layer** | Inside Finance module | Governed financial modeling: scenarios, budget logic, valuation, liquidity, review. Richer assumptions and downstream finance truth. |

Canonical rule: `initiative economics is not a competitor to finance modeling; it is an upstream and linked view of it` (`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §3).

### 2.2 Linkage states

An initiative with financial impact must explicitly expose one of these states:

- `not_started`
- `local_only`
- `linked_to_finance_model`
- `linked_to_finance_scenario`
- `linked_to_roi_tracking`
- `stale_vs_finance_model`

(`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §4)

### 2.3 Canonical linkage objects

| Object | Role |
|---|---|
| `InitiativeEconomicImpact` | Initiative-level finance data (capex, opex, benefit, timing, confidence, assumptions, linked finance ref) |
| `InitiativeFinanceLink` | Durable bridge from initiative economics to Finance (artifact type/id, link mode, sync status, last reconciled) |
| `InitiativeEconomicDriverRef` | Mapping between initiative inputs and model drivers (economic field → finance driver code, mapping type, allocation rule, confidence) |

(`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §5)

### 2.4 Four smart linkage patterns

| Pattern | Direction | Behavior |
|---|---|---|
| **Seed** | Initiative → Finance | Initiative financial impact tab seeds first finance scenario, budget case, or ROI draft. E.g., annual savings → benefit drivers; implementation cost → capex schedule. |
| **Pullback** | Finance → Initiative | Finance sends structured truth back: modeled payback, capex/opex range, scenario status become visible in initiative tab. |
| **Reconciliation** | Bidirectional | If initiative-local and finance-modeled values diverge, system shows delta, explains which side changed, lets user reconcile or accept divergence. No silent overwrite. |
| **Promotion** | Initiative → Finance (escalation) | When initiative economics becomes material, system proposes: create finance scenario, create full economic analysis, create ROI tracking object, open finance review pack. |

(`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §6)

### 2.5 What flows in each direction

**Initiative → Finance** (eligible seed fields): implementation cost, recurring cost impact, expected benefit, timing and ramp, confidence level, benefit class, linked assumptions, owner and sponsor context. These become seeded assumptions, scenario inputs, and finance review candidates — never directly final finance truth (`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §7).

**Finance → Initiative** (eligible pullback fields): modeled total cost, modeled benefit range, modeled payback, modeled ROI range, scenario name and status, finance review state, stale/unreconciled warning. Displayed as linked values and source-backed summaries, not detached copied text (`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §8).

### 2.6 Mapping rules

Supported mapping types: `direct_driver_mapping`, `distribution_over_time`, `one_to_many_allocation`, `benefit_to_revenue_driver`, `cost_to_capex_or_opex_driver`, `initiative_to_roi_seed`. All mappings must be explicit, reviewable, and explainable (`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §9).

### 2.7 Connection to source governance (Wave 3)

Per WP-W3-LIFECYCLE-01 §2 and Decision W3-1, source materialization is invisible by default at UX level but explicit in lineage, audit, and source-trace views. The initiative economics linkage must respect this doctrine: when initiative economics seeds a finance scenario, the source chain (initiative → source artifact → upstream entrypoint) must remain traceable through the finance layer.

Per Decision W3-3, `synced_source_refs` are part of the initiative source governance model. When initiative economics links to Finance, any synced external source references from the initiative's origin must carry into the finance linkage metadata.

---

## 3. Workspace integration

### 3.1 Integration directions

Finance workspace integration operates in three directions (`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §4):

**Inbound into Finance:**
- Local PDF and Excel files
- Cloud-linked finance files
- Notes and notebook pages
- Ideas and initiative contexts
- Interview evidence and assumptions
- Results and ROI context
- Tasks, decisions, and execution questions

**Lateral inside Finance:**
- Recognition and repair ↔ First model
- First model ↔ Analysis packs
- Analysis packs ↔ Budgeting and forecasting
- Budgeting ↔ Valuation and investment cases
- All surfaces ↔ CFO review packs

**Outbound from Finance:**
- Notebook note
- Idea workspace
- Initiative
- Report
- Presentation
- Decision
- Result / ROI / KPI-supporting object

### 3.2 Canonical workspace objects

| Object | Role |
|---|---|
| `FinanceWorkspaceRef` | Finance working context: workspace ID, active surface, active artifact refs, source pack refs, linked artifact refs |
| `FinanceSourcePack` | Governed set of source material: statement packs, models, analysis runs, budgets, valuations, notes, external sources, initiative refs |

(`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §5)

### 3.3 AI-driven orchestration

AI should keep finance grounded in: source documents, linked notes, initiative and ROI context, budget and valuation assumptions, and downstream outputs already created from the same source. This grounding should remain mostly invisible to the user (`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §4.4).

### 3.4 Cross-surface doctrine from SSOT

The FINANCE_V8_SSOT establishes three cross-surface integration rules:
1. Integration and promotion into notes, ideas, initiatives, reports, and presentations
2. Initiative economics may seed and link into governed finance modeling
3. Financially meaningful KPI may link into finance analysis and models without collapsing Results truth

(`FINANCE_V8_SSOT.md` §3)

### 3.5 Professional analysis as workspace surface

The analysis layer supports first-class packs (operating performance, margin/profitability, liquidity/cash quality, leverage/debt capacity, working capital, credit/covenant risk, growth quality, management efficiency). Every pack supports deterministic metrics, threshold state, period trend, peer context, and AI narrative grounded in computed numbers (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §3).

The budgeting layer supports annual budget creation, rolling forecast, best/base/downside scenarios, monthly resolution, owner/reviewer roles, submission/review/approve/lock states, variance explanation, and import of budget inputs from structured Excel workbooks (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §4).

The valuation layer supports DCF, comps, blended valuation, sensitivity matrices, football-field range view, and EV-to-equity bridge (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §5).

---

## 4. Promotion runtime

### 4.1 Core promotion doctrine

Finance work may mature into many downstream artifacts, but every promoted artifact must remain traceable to one or more finance source objects. The canonical promotion pattern is:

```
finance context → AI proposal → user review → promoted artifact → durable traceability link
```

(`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §2, §8)

### 4.2 Promotion objects

| Object | Role |
|---|---|
| `FinancePromotionProposal` | AI or user-initiated conversion of finance work into downstream artifact. Contains: target artifact type, source artifact refs, source snapshot refs, proposed payload, rationale, traceability plan, resolution. |
| `PromotedFinanceArtifactLink` | Persistent link between finance work and downstream artifact. Contains: source finance ref, source artifacts, target artifact, promotion type, source snapshot ref. |

(`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §5)

### 4.3 Promotion doctrine by target artifact type

| Target | When to use | Governing rule |
|---|---|---|
| **Notebook note** | Capture interpretation, assumption explanation, review commentary, CFO commentary | Finance notes must preserve exact source references, not paraphrase numbers into detached text |
| **Idea** | Financial findings suggest strategic exploration (margin improvement, working-capital redesign, refinancing options, pricing scenarios) | Finance to idea is upstream exploration, not yet execution commitment |
| **Initiative** | Finance outputs justify a concrete action program (cost program, refinancing, turnaround) | Initiative creation from finance must stay propose → accept, never silent materialization |
| **Report** | Document-first output with readable narrative and source traceability (lender report, investor memo, monthly review, valuation memo) | Report generation from finance must always resolve through saved source snapshots, not unstable live values |
| **Presentation** | Communication-first output for board, sponsor, investor, management (board pack, investment committee deck, valuation presentation) | Presentation promotion must preserve source-backed slide generation and exact finance context used |

(`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §6)

### 4.4 Promotion triggers

The system should support both user-initiated and AI-proposed triggers:

- `analysis finding → create note`
- `blocked model → create recovery note`
- `valuation complete → create report`
- `budget variance review → create presentation`
- `finance recommendation → create initiative proposal`
- `capital allocation finding → open as idea workspace`

(`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §7)

### 4.5 AI role in promotion

AI should: detect maturity for promotion, recommend target artifact type, prepare first draft payloads, preserve source and snapshot refs automatically, explain why a given promotion path is appropriate.

AI must not: silently create durable artifacts, hide when promotion is based on weak or stale source data, promote finance findings into initiative truth without explicit review (`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §8).

### 4.6 Traceability doctrine

Every promoted finance artifact must preserve: source finance artifact refs, source snapshot refs, creation actor, creation time, promotion rationale, downstream linkback. This is especially important for reports, presentations, initiatives with finance justification, and notes carrying assumption or risk logic (`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §9).

### 4.7 Alignment with Wave 3 source materialization

Per Decision W3-1, source materialization is frictionless by default, explicit when truth risk increases. The finance promotion runtime must follow the same principle: promotion proposals that create durable downstream artifacts (initiatives, reports) should require explicit user review, while lightweight promotions (notes, idea explorations) may be more streamlined. The `FinancePromotionProposal` object's `resolution` field must track whether the user accepted, modified, or rejected the proposal.

---

## 5. CFO operating system and governance

### 5.1 CFO surfaces

The CFO governance layer provides six canonical surfaces:

| Surface | Purpose |
|---|---|
| **CFO cockpit** | Summarize current performance, forecast drift, cash/liquidity position, debt/covenant pressure, valuation-critical assumption changes, initiative economics impact |
| **Liquidity and cash watch** | Cash runway, upcoming debt obligations, covenant thresholds, liquidity stress scenarios, warning and escalation logic |
| **Covenant and credit watch** | Covenant checks, refinancing pressure, cash stress indicators, rating-proxy narrative |
| **Capital allocation and investment review** | Initiative funding review, prioritization by capital efficiency, expected vs realized financial impact, post-approval finance checkpoints, links to ROI and Results |
| **Budget review cadence** | Month-end, quarter-close, annual budget, investment committee, board pack preparation |
| **Board and management finance pack** | Source snapshots, commentary, owner assignment, open questions, next actions |

(`FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md` §3–§7)

### 5.2 CFO cockpit as action surface

The cockpit is not a static dashboard. It must produce: review tasks, alerts, narrative packs, and allocation decisions that can flow into initiatives or Results (`FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md` §4).

### 5.3 Capital allocation and initiative economics

The CFO layer connects finance to the broader platform by supporting: initiative funding review, prioritization by capital efficiency, expected vs realized financial impact, post-approval finance checkpoints, and links to ROI and Results layers. This is one of the strongest differentiation opportunities because most finance tools and PM tools do not share one truth here (`FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md` §6).

### 5.4 Review cadence governance

Every review pack must support: source snapshots, commentary, owner assignment, open questions, and next actions. Supported cadences: month-end finance review, quarter-close review, annual budget review, investment committee review, board pack preparation (`FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md` §7).

### 5.5 Governance connection to promotion runtime

The CFO governance layer is both a consumer and a producer in the promotion runtime:

- **Consumer:** CFO cockpit consumes analysis packs, budget variance, valuation outputs, and initiative economics to produce governance views.
- **Producer:** CFO review findings can trigger promotion into initiatives (capital allocation decisions), reports (board finance packs), presentations (investment committee decks), and notes (review commentary).

---

## 6. Professional analysis capabilities

### 6.1 Analysis packs

The professional analysis layer supports eight canonical packs: operating performance, margin and profitability, liquidity and cash quality, leverage and debt capacity, working capital, credit and covenant risk, growth quality, and management efficiency. Each pack supports deterministic metrics, threshold state, period trend, peer context, and AI narrative grounded in computed numbers (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §3).

### 6.2 Budgeting and forecast

Budgeting is a real workflow, not only a scenario tab. The package supports: annual budget creation, rolling forecast, best/base/downside scenarios, monthly resolution, owner/reviewer roles, submission/review/approve/lock states, variance explanation versus actuals, and import of budget/forecast inputs from structured Excel workbooks. Rule: budgeting must be governable and reviewable, not just editable (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §4).

### 6.3 Valuation

The valuation layer supports: DCF, comps, blended valuation, sensitivity matrices, football-field range view, EV-to-equity bridge. Required assumption areas: WACC inputs, beta and ERP provenance, terminal growth, capex and working-capital assumptions, peer selection logic, external market or cloud-linked assumption provenance. Rule: valuation should produce defensible ranges and assumptions, not only one point estimate (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §5).

### 6.4 Peer and comps

Comparable analysis is a first-class workbench supporting: saved peer sets, rationale for inclusion/exclusion, multiple views by size/geography/sector/business model, median/mean/percentile statistics, and implied valuation ranges (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §6).

### 6.5 Credit and lender lens

The finance layer supports a lender-grade lens: debt service capacity, leverage comfort zones, covenant checks, refinancing pressure, cash stress indicators, and rating-proxy narrative (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §7).

### 6.6 AI role in professional analysis

AI acts as analysis copilot, budgeting reviewer, valuation assistant, and challenge layer for unrealistic assumptions. AI may suggest analysis packs, explain anomalies, propose scenarios, prepare valuation setup, and draft narratives. AI may not invent missing market assumptions silently, hide weak peer selection, or skip assumption review for valuation-critical parameters (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §8).

### 6.7 Shared model reuse rule

The same trusted model and assumptions should be reusable across analysis, budget, and valuation — not rebuilt separately. External cloud-linked finance sources may feed the module, but downstream trust must always resolve through local governed snapshots and readiness. Initiative-level financial impact may seed finance scenarios and budgets, but serious modeled truth must remain governed inside Finance. KPI may inform or interpret finance analysis, but metric truth remains governed in Results (`FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §2).

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream packets

| Downstream packet/capability | What this analysis establishes |
|---|---|
| **WP-W6-OUT-01** (Reports and Presentations) | Finance promotion doctrine for reports and presentations is defined: source-snapshot-based generation, traceability links, AI-prepared first drafts. Reports/presentations packets can assume the finance→output promotion contract is closed. |
| **WP-W6-OUT-02** (Results and ROI) | Initiative economics linkage to ROI tracking is defined. The seed, pullback, reconciliation, and promotion patterns establish how finance truth feeds Results. Results packet can assume the finance→ROI handoff contract is closed. |
| **WP-W6-OUT-04** (Publish and Review) | Finance review packs, CFO governance cadences, and board-pack preparation are defined. The publish/review packet can assume finance produces governed review artifacts with source snapshots and commentary. |
| **Wave 3 — Initiative lifecycle** | The initiative economics layer and its linkage states are defined. Wave 3 initiative lifecycle can assume the finance linkage contract for initiative economic impact tabs. |
| **Wave 5 — External sync** | Cloud-linked source governance (freshness, refresh, stale detection) is defined. External sync hardening can build on the linked-source doctrine. |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | Snapshot object model, identity chain for finance source traceability | Completed |
| **WP-W3-LIFECYCLE-01 — Source truth preservation** | Source materialization doctrine, evidence chain model | Completed |
| **DECISION_LOG_WAVE_3 — Decision W3-1** | Source materialization UX: frictionless by default, explicit when truth risk increases | Ratified |
| **DECISION_LOG_WAVE_3 — Decision W3-3** | `synced_source_refs` added to initiative source governance model | Ratified |
| **Wave 5 — External sync hardening** | Connector auth, reauth, degraded states for cloud-linked finance sources | In progress (Wave 5) |

### 7.3 Canonical objects registry

The full set of first-class objects across the Finance v8 package:

| Object | Source doc |
|---|---|
| `StatementDocument`, `StatementPack`, `RecognitionRun`, `RecognitionRecoveryTask` | FINANCE_V8_SSOT §5 |
| `FinancialModel`, `ModelVersion` | FINANCE_V8_SSOT §5 |
| `AnalysisRun`, `BudgetCycle`, `ForecastScenario` | FINANCE_V8_SSOT §5 |
| `ValuationCase`, `CompsSet`, `AssumptionPack` | FINANCE_V8_SSOT §5 |
| `FinanceReviewPack`, `LiquidityAlert`, `CovenantCheck` | FINANCE_V8_SSOT §5 |
| `InitiativeEconomicImpact`, `InitiativeFinanceLink`, `InitiativeEconomicDriverRef` | FINANCE_INITIATIVE_ECONOMICS §5 |
| `FinanceWorkspaceRef`, `FinanceSourcePack` | FINANCE_WORKSPACE_INTEGRATION §5 |
| `FinancePromotionProposal`, `PromotedFinanceArtifactLink` | FINANCE_WORKSPACE_INTEGRATION §5 |

---

## 8. Open questions and conflicts

### 8.1 Gap: Promotion permission model for finance → initiative

`FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §6.3 states that initiative creation from finance must stay propose → accept, never silent materialization. `FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §6.4 describes the promotion pattern where the system proposes creating finance scenarios, economic analyses, ROI tracking objects, and finance review packs.

Neither doc defines:
- What role or permission is required to promote finance findings into an initiative
- Whether the finance artifact's confidence or review state gates the promotion
- Whether the initiative owner, the finance analyst, or both must approve

**Recommendation:** Align with Decision W3-2 (interview promotion permission model): promotion requires both allowed actor and sufficient artifact quality. For finance → initiative promotion, the minimum policy should be: user must have initiative-creation permission in the target project, and the finance artifact must be in a reviewed or approved state (not draft or stale). Weaker states should produce a warning but not hard-block the promotion.

### 8.2 Gap: Reconciliation conflict resolution when initiative economics and finance model diverge

`FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §6.3 defines the reconciliation pattern: show delta, explain which side changed, let user reconcile or accept divergence. However, the doc does not define:
- What happens if the user ignores the divergence indefinitely
- Whether stale linkage triggers escalation or alert
- Whether the CFO governance layer has visibility into unreconciled initiative-finance deltas

**Recommendation:** Unreconciled deltas older than a configurable threshold should surface in the CFO cockpit as a governance alert. The `stale_vs_finance_model` linkage state should trigger a review task. This connects the reconciliation pattern to the CFO governance cadence without inventing new doctrine.

### 8.3 Gap: Cloud-linked source refresh impact on downstream promoted artifacts

`FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §7 forbids silently refreshing a linked source and mutating approved finance outputs without review. `FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §6.4 requires that report generation resolves through saved source snapshots, not unstable live values.

The gap: neither doc defines what happens when a cloud-linked source refreshes and the finance model changes, but a report or presentation has already been promoted from the pre-refresh state.

**Recommendation:** Promoted artifacts should be snapshot-locked at promotion time. If the underlying finance model changes due to a cloud-linked source refresh, the promoted artifact retains its original snapshot. The system should surface a "source has changed since promotion" indicator on the promoted artifact, but must not silently mutate it. Re-promotion from the updated model should be a new explicit action.

### 8.4 Gap: KPI-to-finance linkage boundary

`FINANCE_V8_SSOT.md` §3 states that financially meaningful KPI may link into finance analysis and models without collapsing Results truth. `FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §2 states that KPI may inform or interpret finance analysis, but metric truth remains governed in Results.

The gap: the exact mechanism for KPI-to-finance linkage is not defined within the Finance docs. The SSOT references `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` and `RESULTS_KPI_FINANCE_RECONCILIATION_UX_AND_WORKFLOW_V8.md`, which are outside this packet's scope (WP-W6-OUT-02 territory).

**Note:** This is not a conflict — both docs agree on the principle. The implementation detail lives in the Results/KPI docs and should be resolved by WP-W6-OUT-02.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `FINANCE_V8_SSOT.md` §3 (cross-surface doctrine) ↔ `FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §4 (integration directions): Both agree on the same integration surfaces. No contradiction.
- `FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §6 (linkage patterns) ↔ `FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §6.3 (finance to initiative promotion): Both agree that initiative creation from finance must be propose → accept. The initiative economics doc adds the seed/pullback/reconciliation patterns. No contradiction — they are complementary.
- `FINANCE_DOCUMENT_RECOGNITION_AND_FIRST_MODEL_RUNTIME_V8.md` §7 (linked-source freshness) ↔ `FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md` §2 (downstream trust through local snapshots): Both agree that cloud-linked sources must resolve through local governed snapshots. No contradiction.
- `FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md` §6 (capital allocation) ↔ `FINANCE_INITIATIVE_ECONOMICS_AND_MODEL_LINKAGE_RUNTIME_V8.md` §6.4 (promotion pattern): Both agree that initiative economics should connect to finance governance. The CFO doc adds the capital-efficiency prioritization lens. No contradiction.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Finance data ingestion mapping: three input families, three import modes, three recognition levels, confidence doctrine, canonical states, first-model output contract, linked-source freshness governance (§1)
  - Financial model linkage: two-layer doctrine, six linkage states, three canonical objects, four smart linkage patterns, bidirectional flow definitions, six mapping types, Wave 3 source governance alignment (§2)
  - Workspace integration: three integration directions, two workspace objects, AI-driven orchestration, cross-surface doctrine, professional analysis/budgeting/valuation surface mapping (§3)
  - Promotion runtime: core promotion doctrine, two promotion objects, five target artifact types with governing rules, six promotion triggers, AI role constraints, traceability doctrine, Wave 3 alignment (§4)
  - CFO operating system and governance: six canonical surfaces, cockpit as action surface, capital allocation linkage, review cadence governance, governance connection to promotion runtime (§5)
  - Professional analysis capabilities: eight analysis packs, budgeting workflow, valuation layer, peer/comps workbench, credit/lender lens, AI role, shared model reuse rule (§6)
  - Downstream dependency map: five downstream consumers, five upstream dependencies, 20 canonical objects registered (§7)
  - Open questions: 4 gaps identified, 0 conflicts detected (§8)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Cloud-linked source refresh impact on promoted artifacts (§8.3) needs implementation-level design before finance→report and finance→presentation promotion can be fully safe
  - KPI-to-finance linkage mechanism (§8.4) depends on WP-W6-OUT-02 (Results/ROI) closing the Results-side contract
- **Questions requiring escalation:**
  1. What permission and artifact-quality gates govern finance → initiative promotion? (§8.1)
  2. Should unreconciled initiative-finance deltas escalate to CFO governance after a configurable threshold? (§8.2)
  3. When a cloud-linked source refreshes after a report/presentation has been promoted, should the system auto-flag the promoted artifact or only flag the underlying model? (§8.3)
