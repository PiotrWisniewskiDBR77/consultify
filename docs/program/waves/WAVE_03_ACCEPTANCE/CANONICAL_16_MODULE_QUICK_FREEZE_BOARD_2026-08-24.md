# Consultify — canonical 16-module quick-freeze board — 2026-08-24

Status: `OWNER_FREEZE_PENDING`  
Candidate branch: `codex/final-mvp-integration-20260823`  
Protected runtime: `http://127.0.0.1:3987` — do not mutate  
Production/Railway release: `NOT_AUTHORIZED`

Measured control checkpoint: `dc9efec8e0e29feee89c35cbbaa3b974c6d9cce4`
Frozen product baseline: `2b6c8c360812f55d860eac5b99dcedfabc3cae04`

## Purpose

This is the short owner-facing control board for the final 16-module review.
It does not replace the 21-gate module registers, owner evidence, route audit,
data qualification or architecture document. It binds them into one fixed
review order so that no comment, screenshot or selected implementation is lost.

For every module the owner gives exactly one verdict:

- `ACCEPT` — the described target is the canonical implementation contract;
- `CHANGE` — retain the module but reconcile the captured owner observations;
- `BLOCKED` — the owner cannot choose because evidence or a required design is
  missing.

An image classified as `TARGET_REFERENCE_CANDIDATE` is still only a candidate.
It never proves the current runtime, persistence, authorization or acceptance.

## Current gate reality

The acceptance corpus is structurally complete but the product is not accepted:

| Measure | Current evidence |
|---|---:|
| Modules represented | 16 |
| Gate rows present | 336 / 336 |
| Missing gate rows | 0 |
| Terminally closed gates | 31 |
| Qualified technical passes | 71 |
| Owner-gated | 28 |
| Policy-gated | 4 |
| Open | 202 |
| Total unresolved | 305 |
| Fully closed modules | 0 / 16 |

This is a documentation-control result, not runtime acceptance. The parser was
run read-only at the measured checkpoint. No app, API, browser, database,
persistence, Railway or production test was run to produce this snapshot.

## Quick review board

| # | Module | Entry route | Selected component | Menu / canonical surfaces | Visual qualification | Known integration boundary | Owner verdict |
|---:|---|---|---|---|---|---|---|
| 01 | Organization | `/organization` | `OrganizationView` | Profile; Goals; Challenges; Strategic Synthesis; Sources & Knowledge; Readiness & Governance | `USEFUL_FRAGMENT` | [freeze card](modules/01_ORGANIZATION/CANONICAL_OWNER_FREEZE_CARD_2026-08-24.md): remove Megatrends/Admin duplication; keep Knowledge Graph secondary; confirm three owner IA decisions | `PENDING` |
| 02 | Interview | `/interview` | `InterviewHub` | Inbox; Sessions; Assigned; Templates; Insights; Initiatives | `TARGET_REFERENCE_CANDIDATE` | direct route/sidebar reconciliation; authoring and governed V8 authority remain split | `PENDING` |
| 03 | Tools | `/discovery-tools` | `DiscoveryToolsHub` | Library; Sessions; Insights; Reports; Initiatives | `USEFUL_FRAGMENT` | captured image still says Outputs; Dynamic SWOT is the canonical working MVP | `PENDING` |
| 04 | Assessment | `/assessment/overview?tab=library` | `AssessmentHub` + `AssessmentSessionEditorView` | Library; Processes; Insights; Reports; Initiatives; full card Interview–Matrix–Report–Settings | `USEFUL_FRAGMENT` | freeze one DRD implementation; captured Library still says Outputs | `PENDING` |
| 05 | Initiatives | `/initiatives` | `InitiativesHub` | Initiatives; Plan; Capacity | `TARGET_REFERENCE_CANDIDATE` | Plan and Capacity must share one initiative identity and support versioned analyses | `PENDING` |
| 06 | Execution | `/execution` | `ExecutionHub` | Realizations; Work; Resources; Steering; Reports | `TARGET_REFERENCE_CANDIDATE` | remove the runtime-capability path that replaces the usable module with an unavailable banner | `PENDING` |
| 07 | My Work / Agent | `/my-work` | `MyWorkView` | Inbox/Triage; Tasks; Decisions; Ideas; Notebook; Agent activity | `USEFUL_FRAGMENT` | current capture is empty and overflowing; same-tenant source identities and governed writeback required | `PENDING` |
| 08 | Meetings | `/meeting` | `MeetingHub` | Meetings; Agenda/Templates; Minutes; Decisions/Actions | `HISTORICAL_ORIENTATION_ONLY` | stable deep route and final meeting card not frozen | `PENDING` |
| 09 | Results | `/results` | `ResultsOwnerReviewEntry`; KPI/OKR/ROI registries | KPI; OKR; ROI | `REJECTED_REFERENCE` | old centered Results cockpit and `ResultsHub` are forbidden canonical targets | `PENDING` |
| 10 | Finance | `/finance` | `EconomicsView` | Statements; Analysis; Baseline; Prediction; Valuation | `REJECTED_REFERENCE` | dual V8/legacy stack needs explicit cutover to one governed artifact lineage | `PENDING` |
| 11 | Materials | `/presentations` | `ReportsAndPresentationsHub` | Documents; Presentations; Sheets; Templates | `HISTORICAL_ORIENTATION_ONLY` | freeze one sheet engine and native full cards for all artifact types | `PENDING` |
| 12 | Audits | `/audit-programs` | `AuditsMethodHub` + `CriterionWorkspace` | Library; Programs; Evidence; Findings; Reports; Initiatives | `HISTORICAL_ORIENTATION_ONLY` | method-pack rights and criterion-to-remediation contract must remain explicit | `PENDING` |
| 13 | Chat | `/chat` | `UnifiedChatPanel` | conversation workspace; sourced context; proposals; decisions; receipts | `TARGET_REFERENCE_CANDIDATE` | start image is not proof of provider, decision, materialization or cold readback | `PENDING` |
| 14 | Admin | `/admin` | `AdminView` | Overview; Users; Organizations; Access; AI/Models; Operations/Audit | `HISTORICAL_ORIENTATION_ONLY` | tenant-admin and superadmin boundaries must remain separate | `PENDING` |
| 15 | Settings | `/settings` | `SettingsView` | Profile; Workspace; Notifications; Integrations; Security/Privacy | `HISTORICAL_ORIENTATION_ONLY` | freeze ownership split between user, organization and administration settings | `PENDING` |
| 16 | Partner | `/partner` | `PartnerPortalViewNew` | Overview; Opportunities; Connections; Collaboration; Materials; Settings | `HISTORICAL_ORIENTATION_ONLY` | operational landing for an already connected partner is not frozen | `PENDING` |

## Decisions that must be frozen before any wiring

These choices are intentionally unresolved. A developer or agent must not infer
an answer from whichever historical component happens to compile:

1. **Interview route identity:** whether `/interview` is the sole canonical URL
   and `/discovery` plus `/project-intelligence` become redirects, or whether
   aliases remain supported.
2. **Assessment full tool:** freeze one DRD implementation and the current
   `Interview → Matrix → Report` flow with separate `Settings`; `Split` and
   `Workspace` are historical provenance, not parallel target tabs.
3. **Execution capability behavior:** distinguish a legitimate unavailable
   state from the regression where `V8UnavailableBanner` hides a usable module.
4. **Results source generation:** `ResultsVNext` KPI/OKR/ROI registries and full
   tools are the routed candidate; the centered legacy `ResultsHub` cockpit must
   not return as fallback.
5. **Finance cutover:** select one governed artifact and API lineage from the
   routed stack and the preserved Finance branch; no wholesale branch merge.
6. **Materials sheet engine:** choose `ExceleView` or `TabeleView`, and record
   the disposition of the non-selected engine.
7. **Meeting object URL:** define the stable deep-link grammar before cards are
   integrated.
8. **Partner landing:** distinguish the valid first-run connection surface from
   the operational landing for an already connected partner.
9. **Menu vocabulary:** reconcile the detailed owner labels with summary labels
   for Organization, Interview and Materials; do not silently rename or omit a
   surface.
10. **Ownership boundaries:** freeze user Settings versus Organization versus
    Admin responsibilities before any settings consolidation.

## Atomic owner-feedback protocol

1. Review exactly one module at a time in the order above.
2. Every owner comment is stored verbatim with module, route, category,
   screenshot hash when supplied, timestamp and `CAPTURED_UNRECONCILED` state.
3. A comment is not a verdict and never silently changes the canonical target.
4. A verdict is recorded only after the owner explicitly says `ACCEPT`,
   `CHANGE` or `BLOCKED` for that module.
5. Integration build is permitted only after 16 verdicts exist and none is
   `BLOCKED`.
6. Implementation then reconciles requirement → route/component → data/API →
   code → focused test → browser/readback evidence. Owner acceptance and release
   remain separate gates.

Durable capture tools:

- `scripts/dev/record-canonical-owner-observation.mjs`
- `scripts/dev/record-canonical-owner-verdict.mjs`
- `scripts/dev/verify-canonical-16-module-bindings.mjs`
- `scripts/dev/verify-canonical-visual-candidates.mjs`
- `scripts/dev/prepare-canonical-owner-review.mjs`

## Freeze exit criteria

The documentation freeze is complete only when:

- all 16 owner verdicts are recorded;
- every `CHANGE` has an atomic observation denominator and disposition;
- no module remains `BLOCKED`;
- the route/component/data/image selections agree;
- forbidden legacy components and regression images are named explicitly;
- one integrated deterministic local dataset and runtime can then be built
  without borrowing records from another tenant or treating isolated module
  fixtures as an integrated application.
