# Wave 3 — module source, fixture and evidence inventory

Captured: `2026-08-23`

Status: `ACTIVE / SINGLE CONTROL PLANE / RELEASE NOT AUTHORIZED`

This is the one integration index for locating the current implementation of
all sixteen modules. It prevents a module from being rebuilt merely because a
route, feature flag, fixture or retained proof was not found during a browser
session. It is navigation, not acceptance evidence, and does not replace any
atomic `MODULE_ACCEPTANCE.md` register.

## Binding rules

1. Work only on `codex/final-mvp-integration-20260823`; do not create a parallel
   integration branch or duplicate module shell.
2. Before editing a module, inspect the canonical route, component tree,
   deterministic fixture script, atomic register and retained evidence below.
3. A historical browser proof remains historical until replayed on the frozen
   final candidate. `READY_RETAINED_BROWSER_PROVEN` does not mean current-SHA
   or owner acceptance.
4. Seeded local/demo records are reconstructible. Preserve source, migrations,
   fixture scripts, marker/manifest contract and readback procedure; never infer
   authority to mutate Railway or production.
5. Each module is closed only through its existing 21 gates plus an explicit
   owner verdict. Screenshots and tests cannot manufacture that verdict.

## Sixteen-module map

| # | Module | Canonical route and mounted source | Deterministic owner fixture entrypoint | Atomic register | Current exact-candidate status / next proof |
|---:|---|---|---|---|---|
| 1 | Organization | `/organization/*` -> `src/views/OrganizationView` | `server/scripts/seed-wave3-organization-owner-review.ts` | `modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` | Retained browser proof exists; `NOT VERIFIED` on final exact candidate. Replay profile, strategy, claims, locale, role and cold readback. |
| 2 | Interview | `/interview` -> `src/components/Interview/InterviewHub` | `server/scripts/seed-wave3-interview-owner-review.ts` | `modules/02_INTERVIEW/MODULE_ACCEPTANCE.md` | Retained manager/public/revoked proof exists; final-candidate provider, owner and responsive gates remain open. |
| 3 | Tools | `/discovery-tools/*` -> `src/components/Discovery/DiscoveryToolsHub` and governed tool workspaces | `server/scripts/seed-wave3-tools-owner-review.ts` | `modules/03_TOOLS/MODULE_ACCEPTANCE.md` | 22 unique Dynamic SWOT product commits from retained source `1fce2f0631` are selectively integrated at baseline `6e9f116f82`; focused `34/34` and full type-check PASS. Final-candidate browser/persistence replay and owner quality decision remain open. |
| 4 | Assessment | `/assessment/*` -> `src/components/assessment/AssessmentHub` and `src/views/AssessmentSessionEditorView` | `server/scripts/seed-wave3-assessment-owner-review.ts` | `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` | Current runtime `a2b500caca36` proves only compact navigator. Interview, Matrix, Report, Settings, persistence, approvals and downstream lineage remain unaccepted. |
| 5 | Initiatives | `/initiatives` -> `src/components/Initiatives/InitiativesHub` | `server/scripts/seed-wave3-initiatives-owner-review.ts` | `modules/05_INITIATIVES/MODULE_ACCEPTANCE.md` | Retained register/card proof exists. Final candidate must prove non-empty Initiative, Plan and Capacity flows, standard preview/menu and AI-assisted creation. |
| 6 | Execution | `/execution` and `/execution/:executionCaseId` -> `src/components/Execution/ExecutionHub` | `scripts/dev/seed-wave3-execution-owner-review.mjs` | `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` | Retained five-tab/deep-link proof exists. Final candidate must prove initiatives-in-execution lineage plus Work, Resources, Control and Reports with non-empty data. |
| 7 | My Work / Agent | `/my-work/*` -> `src/views/MyWorkView` | `scripts/dev/seed-wave3-my-work-owner-review.mjs` (owned variant also retained) | `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` | Technical evidence and owner findings coexist. Remaining Ideas/Notebook/core design issues require implementation and final replay. |
| 8 | Meetings | `/meeting` -> `src/components/Meeting/MeetingHub` | `scripts/dev/seed-wave3-meetings-owner-review.mjs` | `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` | Retained notes lifecycle proof exists. Capture, transcription, media/provider, participant UX and final replay remain open. |
| 9 | Results | `/results`, `/results/kpi/*`, `/results/okr/*`, `/results/roi/*` -> `src/components/Results` and `src/components/ResultsVNext` | `server/scripts/seed-wave3-results-owner-review.ts` | `modules/09_RESULTS/MODULE_ACCEPTANCE.md` | KPI/OKR/ROI registries and full-tool routes exist. Current UX owner findings require regenerated cards, standard menus, creation flows and final-candidate persistence/readback proof. |
| 10 | Finance | `/finance` plus `/finance/{statements,baselines,predictions,analyses,valuations}/*` -> `src/views/EconomicsView` and Finance workspaces | `server/scripts/seed-wave3-finance-owner-review.ts` (`run-wave3-finance-owner-review.ts` runner retained) | `modules/10_FINANCE/MODULE_ACCEPTANCE.md` | Five-workspace signed DB proof exists outside the frozen final runtime. Full state/a11y matrix, correct aggregation UX and owner replay remain open. |
| 11 | Materials | `/presentations` -> `src/components/ReportsAndPresentations/ReportsAndPresentationsHub` plus studio redirects | `server/scripts/seed-wave3-materials-owner-review.ts` | `modules/11_MATERIALS/MODULE_ACCEPTANCE.md` | Retained DOC/PPT/XLSX proof exists. Policy, rights, export/share/provider and exact-candidate replay remain open. |
| 12 | Audits | `/audit-programs/*` -> `src/components/Audit/method/AuditsMethodHub` and criterion/report workspaces | `scripts/dev/seed-wave3-audits-owner-review.mjs` | `modules/12_AUDITS/MODULE_ACCEPTANCE.md` | Retained governed audit chain exists. Named-standard policy, external providers and final owner replay remain open. |
| 13 | Chat | `/chat` and `/chat/:conversationId` -> `src/components/AIChat/UnifiedChatPanel` with route sync | `scripts/dev/seed-wave3-chat-owner-review.mjs` | `modules/13_CHAT/MODULE_ACCEPTANCE.md` | Owner findings are registered; P0/P1 remediation, live provider, governed action APIs and final exact-SHA retest remain open. |
| 14 | Admin | `/admin/*` -> `src/views/AdminView` | `server/scripts/seed-wave3-admin-owner-review.ts` | `modules/14_ADMIN/MODULE_ACCEPTANCE.md` | Retained audit/roster/invitation proof exists. Role policy, mutations, backup boundary and final replay remain open. |
| 15 | Settings | `/settings/*` -> `src/views/SettingsView` | `scripts/dev/seed-wave3-settings-owner-review.mjs` | `modules/15_SETTINGS/MODULE_ACCEPTANCE.md` | Owner UI direction and retained technical proof exist; OAuth/MFA/destructive operations, full matrix and final replay remain open. |
| 16 | Partner | `/partner/*` -> `src/views/PartnerPortalViewNew` | `server/scripts/seed-wave3-partner-owner-review.ts` | `modules/16_PARTNER/MODULE_ACCEPTANCE.md` | Retained profile/certification/referral proof exists. Economics stays OFF; journey/IA, responsive/a11y and final owner replay remain open. |

## Shared fixture and runtime infrastructure

- `scripts/dev/start-wave3-owner-runtime.mjs` is the guarded local runtime
  entrypoint; its manifest and exact process identity must be captured for each
  replay.
- `scripts/dev/seed-wave3-owner-review-overlay.mjs` and
  `scripts/dev/seed-wave3-browser-review.mjs` are shared review helpers, not
  substitutes for a named module fixture.
- The retained fixture catalog and recovery state live in
  `OWNER_FIXTURE_INVENTORY.md` and `DATABASE_RECOVERY_INVENTORY_2026-08-23.md`.
- Runtime/source invalidation is governed by `SHA_RUNTIME_LEDGER.md`.

## Integration traversal

For each row, the same bounded sequence applies:

1. locate and compare all retained source candidates without merging blindly;
2. freeze one candidate SHA and one reconstructible local fixture;
3. open the canonical route and capture current Menu 1/2/3, table, preview,
   context menu, full workspace, empty/error/permission state and cold reload;
4. reconcile every mismatch into the existing atomic register;
5. implement P0/P1 against shared components and domain contracts;
6. verify focused tests, typecheck/build as proportionate, browser state,
   persistence/readback, role/tenant boundaries and lineage;
7. request owner verdict without changing it implicitly.

The cross-module integration is tested only after all sixteen rows point to the
same candidate SHA:

`Assessment -> Insights / Reports / Initiatives -> Execution -> Results -> Finance -> Materials`.

Until that replay exists, the program remains `INTEGRATION_IN_PROGRESS` and
`RELEASE_NOT_AUTHORIZED`.
