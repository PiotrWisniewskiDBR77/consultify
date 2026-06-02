# Final Global UI Gate - 2026-05-15

## Verdict

`UI_UX_GLOBAL_GATE_PLAN_APPROVED_FOR_EXECUTION`

This document defines a complete, staged control and standardization plan for UI/UX across the full presentation layer, with maximum automation and minimal manual visual review.

`GLOBAL_UI_UX_FULL_PASS` can be claimed only after:

- all MUST/MUST NOT conformance checks pass,
- all critical module cards reach `PASS` or `PASS_WITH_NONBLOCKING_P2`,
- visual owner sign-off is completed for the final short list of human-only quality checks.

## Scope

In scope:

- all Consultify presentation surfaces under `src/components`,
- all module hubs and command surfaces (`Menu 2`, `Menu 3` / command row),
- all table/list/detail presentation contracts,
- all shared visual and interaction contracts from canonical UI/UX sources.

Out of scope:

- backend business logic not affecting UI contract,
- infrastructure and deployment topics not affecting UI behavior,
- content-only copy tuning unless it affects visual hierarchy or UX trust.

## Canonical Standards (Source Of Truth)

All checks in this gate are derived from:

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
- `DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/00-foundation/visual-language.md`
- `DRD/consultify/docs/ui-standards/03-modules/app-table-standard.md`
- `DRD/consultify/docs/ui-standards/shared-nmode-sections-standard.md`

## Pre-Audit Gap Analysis (What Is Missing Before Full Control)

Purpose of this section: identify all missing standard definitions that prevent strict, repeatable, step-level UI/UX control for enterprise SaaS quality.

### Executive Gap Verdict

Current standards are strong on:

- command surface architecture (`Menu 2` / `Menu 3`),
- component and shell doctrine (`ModuleHub`, `App Table`, `NMode`),
- visual consistency direction (`DBR77`, chip and table contracts),
- trust/safety invariants (no silent execution, no fake success, tenant safety).

Current standards are still incomplete for deterministic full audit in:

- measurable thresholds (performance/accessibility/responsive),
- exact step registry for all modules,
- evidence format and pass/fail formulas per step,
- exception governance and expiry policy,
- ownership matrix for standard updates during audit.

### Gap Register (Must Be Closed Before Full Audit Execution)

| Gap ID | Missing Standard Element | Why It Blocks Reliable Control | Required Closure |
|---|---|---|---|
| `G-01` | Authoritative step registry per module (`step_1..step_n` with exact tab/workspace names) | Audit cannot be reproducible if step scope is ambiguous. | Freeze `STEP_REGISTRY` for all 9 blocks (44 steps total). |
| `G-02` | Unified pass formula per step (weights + hard blockers) | Different reviewers may score same screen differently. | Lock one scoring formula + one blocker rule (`any P1 => BLOCKED`). |
| `G-03` | Full empty/error/degraded state library | Cannot verify state quality if expected state set is not explicitly enumerated. | Define state catalog with canonical copy patterns and visual examples. |
| `G-04` | Performance UX thresholds per flow | "Fast enough" is subjective without concrete numbers. | Set threshold matrix (interaction, load, save/read-back, refresh). |
| `G-05` | Accessibility standard level and test method | No deterministic pass/fail for a11y without target level and toolchain. | Lock WCAG target and mandatory automated/manual checks. |
| `G-06` | Responsive contract per module type | Desktop-only assumptions can hide layout regressions. | Define breakpoint behavior for table, preview pane, NMode, topbars. |
| `G-07` | i18n/language policy per tenant/market | Copy quality and truncation cannot be validated consistently. | Freeze PL/EN policy, fallback strategy, and text-length constraints. |
| `G-08` | Icon/status semantics dictionary | Same status meaning may render differently between modules. | Publish one status/icon mapping dictionary used in all blocks. |
| `G-09` | Exception policy (`waiver`) with expiry | Temporary deviations can become permanent drift. | Add waiver template with owner, reason, expiry date, and rollback plan. |
| `G-10` | Evidence schema and file naming per step | Audit evidence may be incomplete or incomparable across modules. | Lock one evidence template for every step with mandatory artifacts. |
| `G-11` | Ownership matrix for standard changes during audit | New findings can stall execution without decision path. | Define approvers for visual, UX, architecture, and risk decisions. |
| `G-12` | Automation coverage map (rule -> source standard) | Hard to know which rules are automated vs manual-only. | Publish coverage matrix for all controls in this gate. |

### Source-Based Confirmation Of Open Gaps

The following open areas are already acknowledged in canonical docs and must be closed now for strict control:

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` identifies open decisions: component design system, full state library, performance thresholds, WCAG standard, language policy, icon/status standard.
- `CONSULTIFY_UI_UX_OPERATING_STANDARD.md` keeps migration decisions open: do-not-touch screens, preview-pane rollout scope, default table/card choices, view-local toolbar standard.
- Existing standards define quality direction well, but not yet full deterministic measurement for all 44 module steps.

## Mandatory Standard Closure Pack (Before Audit Start)

Create and approve these artifacts before step-by-step control begins:

1. `docs/ui-standards/automation/UI_UX_STEP_REGISTRY_2026-05-15.md`
   - exact list of all module steps (9 blocks, 44 steps).
2. `docs/ui-standards/automation/UI_UX_STEP_PASS_FORMULA_2026-05-15.md`
   - score, severity, blocker logic, acceptance thresholds.
3. `docs/ui-standards/automation/UI_UX_STATE_LIBRARY_2026-05-15.md`
   - loading/success/error/empty/degraded patterns and examples.
4. `docs/ui-standards/automation/UI_UX_A11Y_PERF_I18N_BASELINE_2026-05-15.md`
   - accessibility, performance, responsive, and language constraints.
5. `docs/ui-standards/automation/UI_UX_WAIVER_POLICY_2026-05-15.md`
   - controlled exceptions with expiry and owner approval.
6. `docs/testing/reports/templates/UI_UX_STEP_EVIDENCE_TEMPLATE.md`
   - mandatory evidence checklist for every audited step.

If any artifact above is missing, gate state remains `INCONCLUSIVE` for full module audit.

Current closure status:

- `G-01` (`authoritative step registry`) -> `CLOSED`
  - evidence: `docs/ui-standards/automation/UI_UX_STEP_REGISTRY_2026-05-15.md`

## Step Compliance Checklist (Use In Every Step)

Each module step must be checked against all controls below.  
No item may be skipped as "implicit".

### A. Shell And Navigation Compliance

- App topbar/module topbar hierarchy is correct.
- Exactly one command row exists (`Menu 3`), no parallel toolbar.
- View switch/filter controls follow canonical placement and order.
- Dynamic tabs preserve right-side actions and do not break command surface.

### B. Menu 3 And Action Governance Compliance

- Contextual AI actions are in Menu 3 right slot.
- No AI action duplication between Menu 3 and canvas.
- Lifecycle/governance actions are visible, explicit, and non-silent.
- Selection-based actions have honest disabled/active states.

### C. Component Contract Compliance

- Module uses approved shell/components (no local competing UI language).
- Table screens follow App Table contract.
- Preview pane screens follow table+preview contract.
- Detail screens use NMode contract where applicable.
- Repeated sections use shared components, not local clones.

### D. Visual Token And Semantics Compliance

- Status/priority/due/meta/tool chips follow canonical semantic mappings.
- No ad-hoc local color map for same meaning inside the module.
- Neutral metadata rules are respected.
- Dark/light readability remains consistent and enterprise-grade.

### E. Runtime State And Trust Compliance

- loading, success, error, empty, degraded states are all present and honest.
- toasts/banners reflect true backend outcome.
- mutation confirms read-back/refresh consistency.
- no fake success, infinite spinner, or hidden failure.

### F. Security/Tenant/ACL UI Compliance

- denied/forbidden states are explicit and safe.
- no raw internals in user-facing messaging.
- no tenant or ACL leakage through UI state/messages.

### G. Enterprise Premium Quality Compliance (Manual Final Layer)

- visual hierarchy readable in 3 seconds,
- spacing and rhythm are consistent with global SaaS standard,
- CTA emphasis is controlled (no visual noise),
- no off-brand local pattern in module step.

## Step Evidence Minimum (Per Step, Mandatory)

Every step evidence record must include:

- one screenshot with active command surface,
- one screenshot proving data state (table/list/detail),
- one screenshot of non-happy path (empty/error/degraded where relevant),
- short note confirming read-back behavior after mutation (if step mutates data),
- explicit decision (`PASS` / `PASS_WITH_NONBLOCKING_P2` / `BLOCKED_P1`),
- named `P2` items (if any) with owner acceptance.

## Pre-Start Gate Decision

Before executing module-by-module audit:

- Close `G-01 ... G-12`, or
- Explicitly defer named gaps as non-blocking with owner approval.

Without this closure, module results may look complete but will not be fully comparable or defensible as enterprise-grade global UI/UX certification.

## Gate Goals

1. Remove UI/UX drift between modules and screens.
2. Enforce one consistent command surface model (especially Menu 3 right slot behavior).
3. Enforce canonical component/token contracts in table and detail screens.
4. Catch regressions automatically in CI before they reach manual review.
5. Reduce manual visual review to a short premium-polish sign-off.

## Execution Procedure (Auto-Fix First)

This procedure is mandatory for every block audit execution.

### Core rule

Every block audit must end with automatic remediation of obvious standard deviations.

### Operational sequence per block

1. Run step-by-step audit for the full block scope.
2. Classify findings as:
   - `AUTO_FIX_NOW` (obvious, standard-defined, low ambiguity),
   - `OWNER_DECISION_REQUIRED` (business trade-off, conflicting standards, scope change),
   - `DEFERRED_P2` (non-blocking and explicitly accepted).
3. Apply all `AUTO_FIX_NOW` changes immediately in the same execution cycle.
4. Rerun validation for changed files and update block report.
5. Only then issue block verdict.

### What must be auto-fixed immediately

- clear Menu 3 placement violations,
- duplicated contextual actions between Menu 3 and canvas,
- obvious token/color drift from canonical mapping,
- local ad-hoc component styling that conflicts with approved shared contracts,
- straightforward shell/toolbar duplication violations.

### When owner decision is required

Use `OWNER_DECISION_REQUIRED` only when at least one is true:

- two approved standards conflict and require policy choice,
- fix changes intended product behavior beyond UI conformance,
- fix requires changing scope outside audited block/module,
- there is no canonical rule that resolves the case deterministically.

### Default policy

- If deviation is obvious and covered by standard, fix immediately.
- Do not wait for approval in obvious conformance cases.

## Automation-First Operating Model

### Layer A - Hard Conformance (Blockers)

Static checks produce `PASS/FAIL` on MUST/MUST NOT rules. Any violation is a gate blocker.

### Layer B - Module/Card Score

Each module card gets a measurable conformance score (0-100) with weighted checks. This layer drives prioritization and migration velocity.

### Layer C - Human Visual Sign-Off

Only residual, non-automatable quality checks remain for Business Owner / UI Owner sign-off.

## Standard Violation Severity

- `P0`: critical trust/safety break (hidden write, tenant leak, fake success, broken main action).
- `P1`: critical UX contract break (Menu 3 architecture break, duplicated action surfaces, major conformance failure).
- `P2`: non-blocking but visible quality issue (minor semantic drift, secondary readability issue).
- `P3`: polish opportunity.

Gate decisions:

- `PASS`
- `PASS_WITH_NONBLOCKING_P2`
- `BLOCKED_P1`
- `INCONCLUSIVE`

## Stage Plan (End-To-End)

## Stage 0 - Baseline And Freeze

Objective: lock target rules and current baseline before large sweep.

Actions:

- Define machine-readable rule registry:
  - `docs/ui-standards/automation/UI_UX_CONTRACT_RULES.json`
- Freeze module card inventory and ownership:
  - align with `UI_UX_AUDIT_EXECUTION_BOARD.md`
- Create first baseline report from current repo state.

Exit criteria:

- Ruleset version `v1` approved.
- Baseline report published.
- No ambiguity on which screens are in each wave.

## Stage 1 - Build Automated Conformance Engine

Objective: implement static analysis engine that checks canonical UI/UX contracts.

Tooling:

- AST-based analyzer for TS/TSX.
- Pattern and semantic checks for command surfaces/components/tokens.
- Report generator (`json` + `md`).

Recommended script entrypoints:

- `npm run uiux:conformance`
- `npm run uiux:conformance:changed`
- `npm run uiux:conformance:report`

Report output:

- `docs/testing/reports/UI_UX_CONFORMANCE_<date>.md`
- `docs/testing/reports/UI_UX_CONFORMANCE_<date>.json`

Exit criteria:

- Tool runs on full repo and changed-files mode.
- Severity and score model is stable.

## Stage 2 - Enforce Critical MUST Rules (Wave K0)

Objective: close architecture-level inconsistencies that create major UX drift.

Mandatory checks:

- Menu 3 contextual AI/actions are in right slot (`commandRowRightContent` / equivalent).
- No duplicate AI action in Menu 3 and canvas.
- No parallel/secondary command row under topbar.
- Dynamic tab states preserve right-side action continuity.
- Lifecycle/governance actions are not hidden in canvas.

Exit criteria:

- No open `P1` in command surface architecture.
- All affected cards moved to at least `IN_RETEST`.

## Stage 3 - Token And Color Contract Sweep (Wave K1)

Objective: remove non-canonical visual drift.

Mandatory checks:

- Canonical semantic maps only for status/priority/due-risk.
- Reserved use of primary/violet for focus/selection/CTA only.
- No ad-hoc local semantic maps in table hubs.
- Neutral metadata chip behavior preserved.

Exit criteria:

- No open `P1` token/color contract violations.
- Residual `P2` documented with owner acceptance.

## Stage 4 - Component Contract Standardization (Wave K2)

Objective: enforce reusable component contracts in presentation surfaces.

Mandatory checks:

- Table hubs comply with App Table Standard contracts.
- Detail views use `NModeLayout` family where applicable.
- Shared repeated sections use canonical shared components.
- No parallel local clones replacing approved shared building blocks.

Exit criteria:

- All high-traffic modules have contract-compliant component structure.
- Drift hotspots are either fixed or explicitly deferred as named `P2`.

## Stage 5 - Module Card Runtime Validation (Wave K3)

Objective: verify each module card under realistic UI state matrix.

Required per card:

- loading,
- success,
- error,
- empty,
- degraded,
- mutation with read-back,
- role/tenant denied state where relevant.

Evidence per card:

- one short markdown evidence section with links to conformance output and runtime checks.

Exit criteria:

- Card status is `PASS` or `PASS_WITH_NONBLOCKING_P2`.
- No hidden blockers in trust-critical flows.

## Stage 6 - Final Global Visual Sign-Off (Wave K4)

Objective: close human-only quality dimensions.

Input to manual review is reduced to a short risk list from automated output.

Human-only checks:

- premium feel and visual rhythm,
- whitespace balance and hierarchy clarity,
- final dark/light parity quality,
- micro-interaction coherence.

Exit criteria:

- UI Owner sign-off done on short list.
- Global gate recommendation issued.

## Automated Rule Catalog (Minimum Required)

### R1 - Command Surface Integrity

- exactly one command row under module topbar,
- right-side contextual actions not displaced to canvas,
- no duplicated action surface.

### R2 - Menu 3 AI Action Placement

- contextual AI actions must use canonical right-side slot,
- selection-based AI action must remain in same slot with honest disabled state.

### R3 - Dynamic Tabs Continuity

- action set remains visible and functional when dynamic tabs are open.

### R4 - Table Contract Compliance

- canonical chip types/semantics used,
- no module-local chip semantic redefinition.

### R5 - NMode Contract Compliance

- detail artifacts use approved NMode shell and section contracts.

### R6 - Token/Color Contract

- semantic color mapping follows canonical rules,
- no forbidden decorative semantic misuse.

### R7 - Trust-State Honesty

- no fake success,
- no infinite silent spinner,
- error/degraded states are explicit.

### R8 - Tenancy/Safety UI Contract

- denied states are explicit and non-leaky,
- no raw internal payload exposure.

## Scoring Model (Per Screen / Module)

Proposed weights:

- Command surface integrity: `25%`
- Menu 3 AI placement: `15%`
- Component contract compliance: `20%`
- Token/color compliance: `15%`
- Runtime state coverage: `15%`
- Safety/trust UI checks: `10%`

Thresholds:

- `>= 90`: `PASS`
- `80-89`: `PASS_WITH_NONBLOCKING_P2`
- `< 80` or any `P1`: `BLOCKED_P1`

## Execution Waves (Suggested Ownership)

- Wave A: `My Work`, `Interview`, `Discovery`, `Assessment`
- Wave B: `Execution`, `Results`, `Economics`, `Meeting`, `Reports & Presentations`
- Wave C: `Benefits`, `Report Builder`, `Decisions standalone`, `Megatrends`, residual legacy surfaces
- Wave D: `Admin`, `SuperAdmin`, governance-sensitive control planes

Each wave follows the same loop:

1. run conformance,
2. fix criticals,
3. rerun conformance,
4. run targeted runtime checks,
5. publish wave report,
6. move cards to next gate state.

## CI / PR Gate Integration

Required checks on every PR:

- `uiux:conformance:changed` (must pass for changed scope),
- targeted lint/tests for touched components,
- no new `P1` in changed module cards.

Required checks on merge-to-main:

- full `uiux:conformance`,
- report artifact publication,
- gate decision update in global report thread.

## Final Visual Verification Plan (Business Owner)

Manual review is intentionally short and targeted.

### Input Package You Receive

For each flagged screen only:

- light screenshot,
- dark screenshot,
- active Menu 3 screenshot,
- selected-row/selection-state screenshot (if applicable),
- settings/degraded screenshot (if applicable),
- short list of unresolved `P2/P3`.

### Your Verification Checklist (Per Screen)

- Can hierarchy be understood in 3 seconds?
- Is command surface clear and consistent with other modules?
- Is there one clear accent/CTA logic (no chaos)?
- Is dark mode equally premium and readable?
- Is there any local visual pattern that feels off-brand?

### Manual Decision

- `GO`
- `GO_WITH_P2`
- `NO_GO`

`NO_GO` must include a single-line reason mapped to a card and check item.

## Evidence And Reporting Standard

Final package for this gate cycle must include:

- conformance engine report (`md` + `json`),
- per-wave closeout notes,
- card status table with final severity,
- visual owner short sign-off list and decision log,
- final gate verdict with explicit residuals.

## Final Done Rule For GLOBAL_UI_UX_FULL_PASS

All must be true:

- no open `P1` conformance violations,
- every in-scope card is `PASS` or `PASS_WITH_NONBLOCKING_P2`,
- all `P2` items are named and owner-accepted,
- manual visual sign-off completed on residual list,
- final evidence package is published and cross-referenced.

If any condition fails:

- verdict remains `GLOBAL_UI_UX_GO_WITH_RESIDUALS`, not full pass.

## Next Immediate Actions (Execution Kickoff)

1. Approve rule registry schema and severity model.
2. Implement `uiux:conformance` script with first 8 critical rules.
3. Run baseline scan on full `src/components`.
4. Open Wave A fix queue from generated blockers.
5. Publish first `UI_UX_CONFORMANCE_<date>.md`.
6. Start weekly visual sign-off only for residual short list.

## Block-Based Execution Plan (No Weekly Split)

This execution model replaces calendar planning with sequential delivery blocks.  
Each block has a strict entry gate and exit gate.

### Authoritative Audit Structure (Block = Module, Step = Tab)

This is the primary structure for this gate cycle.  
From this point, every audit, evidence note, and closeout decision must be tracked in this model:

- `block` = one product module,
- `step` = one tab/workspace mode inside that module.

Chat is intentionally excluded from this cycle.

### Module Blocks And Step Counts (Locked)

| Block ID | Module (Block) | Step Count | Status |
|---|---|---:|---|
| `B1` | `My Work` | `8` | `PLANNED` |
| `B2` | `Interview` | `6` | `PLANNED` |
| `B3` | `Tools` | `4` | `PLANNED` |
| `B4` | `Assessment` | `3` | `PLANNED` |
| `B5` | `Initiatives` | `2` | `PLANNED` |
| `B6` | `Execution` | `3` | `PLANNED` |
| `B7` | `Results` | `5` | `PLANNED` |
| `B8` | `Finance` | `6` | `PLANNED` |
| `B9` | `Outputs` | `7` | `PLANNED` |

Total scope in this cycle: `9 modules`, `44 steps`.

### Step-Level Audit Contract (Applied In Every Module Block)

Each step (tab/workspace mode) must pass all controls below:

1. `Command Surface Control`
   - one canonical command row,
   - Menu 3 right-slot action consistency,
   - no duplicated AI/context action in canvas.
2. `Visual Token Control`
   - canonical semantic tokens/colors,
   - no local drift from global contract.
3. `Component Contract Control`
   - app-table/n-mode/shared component compliance where applicable.
4. `Runtime State Control`
   - loading, success, error, empty, degraded.
5. `Trust And Safety Control`
   - honest status feedback, no hidden behavior, no tenant leakage in UI.
6. `Enterprise Premium Control`
   - clarity, hierarchy, dark/light parity, global SaaS consistency.

A step can be closed only as:

- `PASS`
- `PASS_WITH_NONBLOCKING_P2`
- `BLOCKED_P1`

### Block Execution Sequence (Module-First)

Run blocks sequentially in this exact order unless explicitly reprioritized:

1. `B1 My Work` (`8` steps)
2. `B2 Interview` (`6` steps)
3. `B3 Tools` (`4` steps)
4. `B4 Assessment` (`3` steps)
5. `B5 Initiatives` (`2` steps)
6. `B6 Execution` (`3` steps)
7. `B7 Results` (`5` steps)
8. `B8 Finance` (`6` steps)
9. `B9 Outputs` (`7` steps)

### Block Done Rule (Per Module)

A module block is `DONE` only when:

- all its steps are closed as `PASS` or `PASS_WITH_NONBLOCKING_P2`,
- no open `P1` remains in any step,
- all accepted `P2` are named and owner-approved,
- block evidence report exists and links to step-level checks.

### Global Done Rule (All Module Blocks)

`GLOBAL_UI_UX_FULL_PASS` is allowed only when:

- all 9 module blocks are `DONE`,
- all 44 steps are closed with no open `P1`,
- final visual owner sign-off confirms enterprise-level consistency.

### Required Evidence File Pattern (Module/Step Model)

For consistency, use one closeout file per module block:

- `UI_UX_BLOCK_B1_MY_WORK_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B2_INTERVIEW_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B3_TOOLS_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B4_ASSESSMENT_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B5_INITIATIVES_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B6_EXECUTION_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B7_RESULTS_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B8_FINANCE_CLOSEOUT_<date>.md`
- `UI_UX_BLOCK_B9_OUTPUTS_CLOSEOUT_<date>.md`

Each file must contain:

- step inventory (`step_1 ... step_n`),
- per-step decision and severity,
- unresolved `P2` list,
- module-level gate decision.

### Block 0 - Program Setup And Baseline Lock

Goal:

- lock one conformance contract and baseline for the whole UI/UX gate.

Scope:

- finalize automation rule registry format,
- lock severity model (`P0/P1/P2/P3`),
- generate baseline report for all in-scope screens.

Owner roles:

- Delivery Owner,
- UI/UX Owner,
- Tech Lead (frontend architecture).

Entry gate:

- source-of-truth files confirmed and frozen for this cycle.

Exit gate:

- `UI_UX_CONTRACT_RULES.json` approved,
- baseline report published,
- all module cards assigned to execution blocks.

Primary evidence:

- `UI_UX_CONFORMANCE_BASELINE_<date>.md`

### Block 1 - Automation Engine And CI Gate Foundation

Goal:

- build and operationalize automated conformance checks.

Scope:

- implement analyzer (`full scan` + `changed files` mode),
- implement report output (`md` + `json`),
- wire checks to PR and main-branch CI.

Owner roles:

- Frontend Infra Engineer,
- QA Automation Engineer.

Entry gate:

- Block 0 completed with approved ruleset.

Exit gate:

- `npm run uiux:conformance` runs successfully,
- `npm run uiux:conformance:changed` runs in PR scope,
- CI blocks on new `P1`.

Primary evidence:

- first CI run with published conformance artifacts.

### Block 2 - Critical Command Surface Standardization (K0)

Goal:

- eliminate high-risk UX architecture drift.

Scope:

- Menu 3 right-slot enforcement,
- dynamic-tabs right-side continuity,
- no duplicated AI actions between Menu 3 and canvas,
- remove parallel/secondary command rows.

Owner roles:

- Module frontend owners,
- UI architecture owner.

Entry gate:

- Block 1 CI and analyzer operational.

Exit gate:

- no open `P1` for command surface checks,
- all affected module cards at least `IN_RETEST`.

Primary evidence:

- `UI_UX_BLOCK2_COMMAND_SURFACE_CLOSEOUT_<date>.md`

### Block 3 - Visual Token And Semantic Contract Cleanup (K1)

Goal:

- standardize semantic color/token usage across modules.

Scope:

- remove non-canonical status/priority semantic maps,
- enforce canonical chip semantics and neutral metadata behavior,
- eliminate ad-hoc token drift in shared high-traffic components.

Owner roles:

- Design System Maintainer,
- Module frontend owners.

Entry gate:

- Block 2 passed (`no P1` in command surface architecture).

Exit gate:

- token/color conformance has no open `P1`,
- all residuals are named as accepted `P2` or fixed.

Primary evidence:

- `UI_UX_BLOCK3_TOKEN_SEMANTICS_CLOSEOUT_<date>.md`

### Block 4 - Component Contract Unification (K2)

Goal:

- enforce reusable component standards at screen level.

Scope:

- App Table Standard conformance for table hubs,
- `NModeLayout` contract conformance for detail views,
- shared section/block reuse in repeated UI patterns.

Owner roles:

- Frontend Lead,
- Shared Components Owner,
- module maintainers.

Entry gate:

- Block 3 passed (`no open P1` in token semantics).

Exit gate:

- all targeted cards meet component contract requirements,
- deviations are either removed or documented as explicit `P2`.

Primary evidence:

- `UI_UX_BLOCK4_COMPONENT_CONTRACT_CLOSEOUT_<date>.md`

### Block 5 - Module Validation And Regression Closure (K3)

Goal:

- prove runtime state completeness and conformance stability.

Scope:

- per-card validation: loading/success/error/empty/degraded,
- save/read-back verification for mutating flows,
- denied/tenant-safe state verification where applicable,
- targeted regression reruns after fixes.

Owner roles:

- QA Lead,
- module QA owners,
- frontend module owners.

Entry gate:

- Blocks 2-4 completed with no active `P1`.

Exit gate:

- each in-scope card is `PASS` or `PASS_WITH_NONBLOCKING_P2`,
- no hidden trust/safety blocker remains.

Primary evidence:

- `UI_UX_BLOCK5_MODULE_VALIDATION_CLOSEOUT_<date>.md`

### Block 6 - Final Business Owner Visual Sign-Off (K4)

Goal:

- close residual human-only quality checks and issue final UI gate decision.

Scope:

- review only automation-flagged residual screens,
- confirm premium visual consistency (hierarchy, rhythm, dark/light parity),
- approve or reject residual `P2` acceptance.

Owner roles:

- Business Owner,
- UI/UX Owner.

Entry gate:

- Block 5 completed with full evidence package.

Exit gate:

- final visual decisions logged (`GO` / `GO_WITH_P2` / `NO_GO`),
- final verdict issued: `GLOBAL_UI_UX_FULL_PASS` or `GLOBAL_UI_UX_GO_WITH_RESIDUALS`.

Primary evidence:

- `UI_UX_BLOCK6_VISUAL_SIGNOFF_<date>.md`
- final update to `FINAL_GLOBAL_UI_GATE_2026-05-15.md`

## Block Transition Rules

- Do not start next block with open `P1` from current block.
- Every block must publish a closeout artifact before transition.
- Any reopened `P1` in a completed block forces return to that block state (`IN_RETEST`).

## Program Execution Snapshot (2026-05-16)

Current completion state after full block run:

- blocks audited: `9/9`,
- steps audited: `44/44`,
- blocks with `PASS`: `8`,
- blocks with `PASS_WITH_NONBLOCKING_P2`: `1` (`B1 My Work`),
- open `P1`: `0`,
- open `P2`: `1` (`P2-B1-001`, owner architecture decision).

Program summary artifact:

- `docs/testing/reports/FINAL_GLOBAL_UI_UX_BLOCK_AUDIT_SUMMARY_2026-05-16.md`

Decision required to finalize full pass:

- `P2-B1-001`: accept `MyWorkHub` local shell as explicit canonical exception OR migrate to full `ModuleHub` composition.

## Final Closure Update (2026-05-16)

Owner decisions recorded:

- `P2-B1-001` architecture decision: `A` (accept explicit canonical exception for `MyWorkHub` local shell),
- visual sign-off result: `GO_WITH_P2`.

Program closure status:

- blocks audited: `9/9`,
- steps audited: `44/44`,
- open `P1`: `0`,
- residual `P2`: `1` accepted exception (`P2-B1-001`).

Final verdict for this cycle:

- `GLOBAL_UI_UX_GO_WITH_RESIDUALS`

Closure interpretation:

- automation and static conformance program completed successfully,
- visual owner sign-off completed,
- one non-blocking architectural residual is explicitly accepted and moved to governance watchlist.

Final evidence pack:

- `docs/testing/reports/FINAL_GLOBAL_UI_UX_BLOCK_AUDIT_SUMMARY_2026-05-16.md`
- `docs/testing/reports/UI_UX_OWNER_DECISION_CARD_B1_2026-05-16.md`
- `docs/testing/reports/UI_UX_VISUAL_SIGNOFF_PACK_2026-05-16.md`

## Minimal Control Board (Block Mode)

Maintain one control board table for execution:

- `block_id`
- `state` (`NOT_STARTED`, `IN_PROGRESS`, `IN_RETEST`, `DONE`, `BLOCKED_P1`)
- `owner`
- `entry_gate_status`
- `exit_gate_status`
- `open_p1_count`
- `accepted_p2_count`
- `evidence_link`

---

Owner recommendation: execute this plan as a dedicated UI/UX gate program in parallel with feature delivery, with strict blocker policy for `P1` conformance regressions.
