# Canonical 16-module source control map — 2026-08-24

## Purpose and freeze

This document is the single navigation and control map for recovering Consultify. It does not replace module acceptance registers, owner-feedback registers, screenshots, specifications, or tests.

Document hierarchy — these are not competing SSOTs:

1. **This file** is the recovery and source-selection control ledger.
2. `CANONICAL_16_MODULE_ROUTE_COMPONENT_AUDIT_2026-08-24.md` is its read-only route/component evidence appendix.
3. `canonical-16-module-bindings.json` is the machine-readable binding guard consumed by verification tooling.
4. `CANONICAL_16_MODULE_QUICK_FREEZE_BOARD_2026-08-24.md` is the owner-facing verdict board.
5. Per-module `MODULE_ACCEPTANCE.md` files retain atomic observations, screenshots, gates and owner decisions.

No new parallel architecture register may be created for the same purpose. New findings must update this ledger or the appropriate evidence appendix/register.

- Candidate worktree: `/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823`
- Candidate branch: `codex/final-mvp-integration-20260823`
- Frozen baseline: `2b6c8c360812f55d860eac5b99dcedfabc3cae04`
- Last closed recovery-document checkpoint before this ledger update: `cf0cdb076855`.
- The frozen baseline names product code. Later documentation-only checkpoints do
  not authorize a product-code change or redefine the product baseline.
- Product-code development: **FROZEN** until this map is reconciled and owner-approved.
- Runtime on port `3987`: **PROTECTED / DO NOT TOUCH**.
- Dirty worktree `/Users/piotrwisniewski/Developer/Consultify`: **PRESERVE / DO NOT CLEAN, RESET, STASH OR MERGE**.
- Railway, staging and production: **NO WRITE / NO DEPLOY / NO RELEASE**.

Allowed during this phase: read-only inventory, file comparison, lineage analysis, documentation, classification, and path-existence checks. Nothing is deleted. Nothing is bulk-merged.

## Status vocabulary

- `CANONICAL_CANDIDATE` — current source owner in the frozen candidate, still requiring gates.
- `REPRESENTED` — another branch's patch is patch-equivalent in the candidate; no merge needed.
- `PRESERVED_WIP` — unique work exists elsewhere and must be reconciled file by file.
- `HISTORICAL` — retained source, not a permitted route owner.
- `DUPLICATE_OWNER` — more than one implementation can plausibly claim the same product surface.
- `OWNER_DECISION_REQUIRED` — owner intent is not unambiguous enough for a technical choice.
- `EVIDENCE_MISSING` — the connection is not yet proven end to end.
- `DO_NOT_MERGE_WHOLESALE` — branch/worktree contains mixed or unsafe content.

## Worktree and branch classification

| Source | SHA | Classification | Control decision |
|---|---:|---|---|
| Final MVP integration | product baseline `2b6c8c3608`; recovery documents through `cf0cdb076855` before this update | `CANONICAL_CANDIDATE` | Only place where the recovery map may be updated. Product code remains frozen. |
| Main developer worktree | `43730f86f8` plus 23 dirty entries | `PRESERVED_WIP` | Preserve exactly; inventory only. Never clean/reset/stash. |
| Recovery vault | `b21affa8cd` | `REPRESENTED` | Ancestor of candidate; no merge. |
| Wave 3 acceptance branch | `43730f86f8` | `REPRESENTED` | Ancestor of candidate; dirty overlay remains separate WIP. |
| Final demo preservation | `9f29cb00ff` | `REPRESENTED` | Patch-equivalent in candidate; no merge. |
| Four-modules preservation | `d48f4d7fc8` | `REPRESENTED` | Patch-equivalent in candidate; no merge. |
| Flow identity adapter | `9275...` | `REPRESENTED` | Patch-equivalent in candidate; no merge. |
| Chat-to-Tools preservation | `7c3b559ca8` | `PRESERVED_WIP`, `DO_NOT_MERGE_WHOLESALE` | Unique commit includes intended artifacts and `false/_cacache` junk. Reconcile intended paths only. |
| Finance preservation | `e7574b340e` | `PRESERVED_WIP` | 37-file unique patch; compare file by file before any selection. |
| Detached Finance live source | `d8561ed5c2` | `PRESERVED_WIP` | Reference snapshot only. |
| Detached Materials live source | `54987e405a` | `PRESERVED_WIP` | Reference snapshot only. |
| Other detached checkpoints | `19e6b0e3b0`, `e6ca206c00`, `1fce2f0631`, `72a590b0b6`, `9bb4a54901`, `b834519c5b` | `PRESERVED_WIP` | Establish scope/lineage before any reuse. |

## Canonical module map

The `Source owner` column records the owner currently wired in `src/routes/AppRoutes.tsx`; it is not owner acceptance. `Data/API proof` remains incomplete until route, authenticated request, response mapping and cold readback are all evidenced.

| # | Module | Canonical entry | Expected Menu 2 | Current source owner | Primary acceptance source | Current control status |
|---:|---|---|---|---|---|---|
| 01 | Organization | `/organization` | Profile; Goals; Challenges; Strategy; Context governance | `src/views/OrganizationView.tsx` | `modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; dirty owner notes must be reconciled |
| 02 | Interview | `/interview` | Inbox; Assigned/Managed; Templates; Results/Insights | `src/components/Interview/InterviewHub.tsx` | `modules/02_INTERVIEW/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; Chat-to-Tools WIP comparison pending |
| 03 | Tools | `/discovery-tools` | Library; Processes/Sessions; Insights; Reports; Initiatives | `src/components/Discovery/DiscoveryToolsHub.tsx` | `modules/03_TOOLS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; `7c3b...` intended-path reconciliation pending |
| 04 | Assessment | `/assessment/overview?tab=library` | Library; Processes; Insights; Reports; Initiatives | `src/components/assessment/AssessmentHub.tsx`; full tool `src/views/AssessmentSessionEditorView.tsx` | `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` and owner register | `CANONICAL_CANDIDATE`; owner workshop WIP preserved separately |
| 05 | Initiatives | `/initiatives` | Initiatives; Plan; Capacity | `src/components/Initiatives/InitiativesHub.tsx` | `modules/05_INITIATIVES/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; dirty implementation contract/expert notes pending |
| 06 | Execution | `/execution` | Realizations; Work; Resources; Steering; Reports | `src/components/Execution/ExecutionHub.tsx` | `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; visible runtime is protected; no further edits |
| 07 | My Work | `/my-work` | Inbox/Triage; Tasks; Decisions; Ideas; Notebook; Agent activity | `src/views/MyWorkView.tsx` | `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; Chat-to-Tools WIP comparison pending |
| 08 | Meetings | `/meeting` | Meetings; Agenda/Templates; Minutes; Decisions/Actions | `src/components/Meeting/MeetingHub.tsx` | `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; data/API proof pending |
| 09 | Results | `/results` → `/results/kpi`; sibling `/results/okr`, `/results/roi` | KPI; OKR; ROI | registries and full tools under `src/components/ResultsVNext/*`; `/results` entry `ResultsOwnerReviewEntry` | `modules/09_RESULTS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; `ResultsHub` is `UNREACHABLE_REFERENCE_ONLY`; data profile, feature flags and readback remain unproven |
| 10 | Finance | `/finance?tab=statements` | Statements; Analysis; Baseline; Prediction; Valuation | `src/views/EconomicsView.tsx` → `src/components/Economics/FinanceHub.tsx` | `modules/10_FINANCE/MODULE_ACCEPTANCE.md` | `PRESERVED_WIP`: compare 37-file Finance branch patch before selection |
| 11 | Materials | `/presentations?tab=all` | All; Documents; Presentations; Sheets; Template Library | `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` | `modules/11_MATERIALS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; detached live source comparison pending |
| 12 | Audits | `/audit-programs` | Library; Programs/Processes; Evidence; Findings; Reports; Initiatives | `src/components/Audit/method/AuditsMethodHub.tsx` | `modules/12_AUDITS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; route/API proof pending |
| 13 | Chat | `/chat` | Conversations; Sourced context/Snapshots; Proposals; Decisions | `src/components/AIChat/UnifiedChatPanel.tsx` | `modules/13_CHAT/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; Chat-to-Tools WIP comparison pending |
| 14 | Admin | `/admin` | Overview; Users; Organizations; Access; AI/Models; Operations/Audit | `src/views/admin/AdminView.tsx` | `modules/14_ADMIN/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; unresolved policies remain gated |
| 15 | Settings | `/settings` | Profile; Workspace; Notifications; Integrations; Security/Privacy | `src/views/SettingsView.tsx` | `modules/15_SETTINGS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; cross-module standard is binding input |
| 16 | Partner | `/partner` | Overview; Opportunities; Connections; Collaboration; Materials; Settings | `src/views/partner/PartnerPortalView.tsx` | `modules/16_PARTNER/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; content/source audit pending reconciliation |

All acceptance paths above are relative to `docs/program/waves/WAVE_03_ACCEPTANCE/`.

## Known architecture conflicts requiring resolution

1. **Results has two source generations but one routed owner.** `src/components/Results/*` and `src/components/ResultsVNext/*` coexist, but `/results` is forced by `ResultsOwnerReviewEntry` to `/results/kpi`, and the KPI/OKR/ROI list and full-tool routes mount `ResultsVNext/*`. `ResultsHub` is `UNREACHABLE_REFERENCE_ONLY`, not a canonical candidate. The remaining risk is runtime selection: data profile, feature flags, entitlements and fallback behavior must not reintroduce the retired cockpit.
2. **Finance has a unique preserved patch.** The `e7574b340e` branch is not patch-equivalent to the candidate. It contains UI, runtime, server, seed and test changes. It must be decomposed into intended requirements and compared against current blobs; a wholesale cherry-pick is prohibited.
3. **Chat-to-Tools preservation is contaminated.** The branch contains valuable documents/screenshots and cache material under `false/_cacache`. The commit is not a merge unit.
4. **Dirty main contains owner-authored evidence.** Its 23 entries are not disposable dirt. They are an overlay requiring a manifest and destination decision.
5. **Screenshots are acceptance evidence, not route authority.** A visually better historical image does not by itself prove the correct backend, persistence, tenant, permissions or source lineage.

### Conflict and competing-source register

This table records source ownership without resolving product decisions on the owner's behalf. `Proposed routed owner` means the component currently selected by source, not `OWNER_ACCEPTED`.

| Module | Proposed routed owner | Competing or conditional source | Classification now | Resolution gate | Rollback source |
|---|---|---|---|---|---|
| Interview | `/interview` → `src/components/Interview/InterviewHub.tsx` | `/discovery` and `/project-intelligence` mount the same hub under legacy identities | `OWNER_DECISION_REQUIRED` for URL normalization; component remains `CANONICAL_CANDIDATE` | Owner freezes `/interview` as sole identity or explicitly retains aliases | Candidate parent SHA before any future route-only change |
| Assessment | `AssessmentHub` plus `AssessmentSessionEditorView` | backward-compatible framework/session paths and historical DRD variants | `OWNER_DECISION_REQUIRED`; no legacy deletion | Owner freezes the accepted DRD full-tool card and route | Current candidate plus preserved Assessment owner workshop/evidence hashes |
| Execution | `ExecutionHub` | `V8UnavailableBanner` may replace the hub; built-in demo/report fallbacks also exist | `CONDITIONAL_RUNTIME`, not an alternate canonical UI | Capability/auth/data replay must distinguish valid unavailable state from regression | Current candidate and protected visible runtime remain untouched |
| Results | `ResultsOwnerReviewEntry` and `ResultsVNext/*` registries/tools | `src/components/Results/ResultsHub.tsx` and old three-pairs cockpit | `UNREACHABLE_REFERENCE_ONLY`; prohibited as route fallback | Route/source guard plus authenticated KPI/OKR/ROI data readback | Current candidate; legacy files remain retained until equivalence proof |
| Finance | `EconomicsView` / `FinanceHub` routed stack | V8 projections, legacy list/read models and preserved Finance branch `e7574b340e` | `SEMANTIC_REVIEW_REQUIRED`; wholesale branch merge prohibited | Five owner surfaces, API authority and cold readback frozen independently | Current candidate plus named preserved branch, path-by-path only |
| Materials | `ReportsAndPresentationsHub` and deep tools | `ExceleView` versus `TabeleView` selected by feature flag | `OWNER_DECISION_REQUIRED` | Owner chooses the canonical sheet engine and disposition of the other route | Current candidate before any flag/route change |
| Meetings | `MeetingHub` | no frozen stable object deep route | `OWNER_DECISION_REQUIRED`, not missing code | Owner freezes object URL grammar before card integration | Current collection route remains canonical candidate |
| Partner | `PartnerPortalViewNew` export from `PartnerPortalView.tsx` | connect-state surface, legacy-section redirects and operational dashboard state | `OWNER_DECISION_REQUIRED` for connected landing; valid first-run state retained | Owner distinguishes first-run connect state from connected operational landing | Current candidate before any landing/redirect change |

No competing source in this table is authorized for deletion. `DELETE_AFTER_EQUIVALENCE_PROOF` remains a later, separately evidenced action.

## Preserved-source reconciliation ledger

This ledger prevents a whole-branch merge from replacing newer candidate work. `EXACT_IN_CANDIDATE` means the preserved source blob is already byte-identical at the same path. `SEMANTIC_REVIEW_REQUIRED` means only a focused diff against the current contract is permitted. `PRESERVE_AS_DOCUMENTATION` means copy/merge decisions concern evidence and specifications, not product wiring.

### Finance preservation `e7574b340e`

Most of the Finance preservation work is already represented exactly in the candidate. The branch is therefore not a missing implementation and must not be cherry-picked wholesale.

`EXACT_IN_CANDIDATE` includes:

- canonical artifact version and KPI compute services;
- analysis, baseline, prediction and statement-pack workspaces;
- Finance owner-review feature-flag hooks and route synchronization;
- protected-route and deep-link coverage;
- Finance API types and the existing owner-review runner;
- relevant component and unit tests already present with identical blobs.

`SEMANTIC_REVIEW_REQUIRED` is limited to:

- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md`;
- `public/locales/en/translation.json` and `public/locales/pl/translation.json`;
- `scripts/dev/start-wave3-owner-runtime.mjs`;
- `server/scripts/seed-wave3-finance-owner-review.ts`;
- Finance cross-tenant and statement-owner PostgreSQL tests;
- the Finance artifacts server route;
- `src/components/Economics/FinanceHub.tsx`;
- `src/components/Economics/financeTypes.ts`;
- `src/components/Economics/hooks/useFinanceData.ts` and its focused test;
- `src/components/shared/ModuleHub/ModuleNavBar.tsx`;
- `src/services/api/financeV2.api.ts`;
- `tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts`.

Control decision: review these paths one by one against owner requirements and current route/data contracts. No product file is selected during the cleanup phase.

### Chat-to-Tools preservation `7c3b559ca8`

Most Chat, Interview, My Work, shared preview/N-mode, API, service and test product blobs from this preservation commit are already exact in the candidate. This source is not a safe merge unit because it also contains generated cache trees.

`EXACT_IN_CANDIDATE` includes the dominant product surface:

- Interview hub, workspace, templates, assignment modal and owner tests;
- most Chat components and focused tests;
- nearly all My Work and Notebook product code and tests;
- shared `ModuleMenu3`, `PreviewActionBar` and N-mode cards;
- relevant V8 API clients, conversation store and vault policy.

`SEMANTIC_REVIEW_REQUIRED` is limited to:

- Polish translations and the Chat project-context migration;
- the My Work Notebook route test;
- `CanvasViewModeControl.tsx` and its tests;
- `chatHistoryVisibility.ts`;
- `DiscoveryToolsHub.tsx` and `ToolDocumentView.tsx`;
- Dynamic SWOT build/input phases;
- selected Notebook block-menu, export and toolbar tests;
- Activity Log canvas, Module Menu 3 selection and audit transaction tests;
- selected Chat governance tests.

`PRESERVED_AS_DOCUMENTATION_EXACT` — restored into the candidate as byte-identical documentation-only blobs from `7c3b559ca8`:

- `CHAT_TO_TOOLS_BACKLOG_BELOW_9_2026-08-23.md`;
- `CHAT_TO_TOOLS_CONSULTING_ATOMIC_REVIEW_2026-08-23.md`;
- `CHAT_TO_TOOLS_FINAL_THREE_PERSON_PANEL_2026-08-23.md`;
- `CHAT_TO_TOOLS_INTEGRATION_HANDOFF_2026-08-23.md`;
- `CHAT_TO_TOOLS_UX_ATOMIC_REVIEW_2026-08-23.md`.

`PROHIBITED_JUNK` and never a recovery source:

- `false/_cacache/**`;
- `false/_npx/**`;
- `false/_update-notifier-last-checked`.

Control decision: the five documents are now preserved at their original canonical documentation paths; their blob hashes match `7c3b559ca8`. Review only the named divergent product paths; exclude the `false/**` cache material permanently from any selection.

### Dirty owner worktree overlay

The dirty `/Users/piotrwisniewski/Developer/Consultify` worktree is an evidence and owner-intent source, not a cleanup target. Its current 23-entry overlay includes:

- modified Railway ignore configuration;
- modified Initiatives and Results module acceptance registers;
- modified Assessment workshop/register material;
- modified cross-module row-menu audit material;
- modified release-verifier script and test;
- modified `src/components/Initiatives/InitiativesHub.tsx`;
- untracked live-runtime identity mapping;
- untracked Initiatives implementation contract and expert syntheses;
- untracked Results final implementation specification;
- untracked Finance recovery contract;
- untracked Assessment owner/expert documentation and evidence directory;
- untracked recovery scripts and acceptance-gate report scripts/tests.

Current read-only overlay manifest (refreshed 2026-08-24; no source file was edited):

| Class | Paths | Recovery handling |
|---|---|---|
| `CONFIGURATION_RISK` | `.railwayignore` | Preserve in place. Review independently against deployment scope; never fold into a documentation or product-code change. |
| `DOCUMENTATION_ONLY` | `modules/05_INITIATIVES/MODULE_ACCEPTANCE.md`; `modules/09_RESULTS/MODULE_ACCEPTANCE.md`; Assessment workshop/register files; cross-module row-menu register; live-runtime identity map; Initiatives contract and two expert syntheses; Results final implementation specification; Finance recovery contract; three Assessment expert/owner documents; Assessment technical evidence note | Preserve every file. Reconcile requirement IDs and destination paths into the existing module registers; do not replace atomic owner observations with summaries. |
| `TEST_OR_TOOLING` | `scripts/release/verify-release-candidate-bundle.mjs`; its unit test; `scripts/recovery/report-worktree-inventory.mjs` and test; `scripts/wave3/report-acceptance-gates.mjs` and test | Review as bounded tooling commits after the canonical map is frozen. Passing these tools cannot establish owner acceptance or release readiness by itself. |
| `PRODUCT_WIP` | `src/components/Initiatives/InitiativesHub.tsx` | Preserve in place. Compare requirement-to-code atoms against the frozen Initiatives contract; do not copy, cherry-pick or merge before owner freeze. |

Manifest denominator: `23` file paths (`git status --porcelain=v1 -uall`), shown
as `22` compact entries by the default status because one untracked directory
contains two files. Classification: `1 CONFIGURATION_RISK` +
`15 DOCUMENTATION_ONLY` + `6 TEST_OR_TOOLING` + `1 PRODUCT_WIP`. No path is
classified as disposable.

Exact content checkpoint (`git hash-object`, refreshed 2026-08-24):

```text
0eeb1fa7e3ae01cb7321667c33edaa718d87b8ed  .railwayignore
7b8ff4aeb5258dcf50c7b162deae40305b37a89c  docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md
79d5ce76ee551efda42aceef6cf53a391eb1a8ac  docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md
96bc25cbf2c9ec0cd917ad1f9d8592c09e9802a0  docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/ASSESSMENT_WORKSHOP_PACKET.md
cc34096048531cad2ecfe1885093001590c7fcc9  docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md
a7b7cf305488814cc92e760f97cadbb8d4384c4b  docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/CROSS_MODULE/ROW_MENU_AUDIT_REGISTER.md
c9bb984df9860e26b874536bbff3247499293dc5  scripts/release/verify-release-candidate-bundle.mjs
9f5f5bfcb4d6556b62f9ebc37de7848a3c72a4c1  src/components/Initiatives/InitiativesHub.tsx
f182e27865f9d82ed40a2753fe9ae6c136c1be80  tests/unit/release/verify-release-candidate-bundle.test.mjs
849180c8e3bf46a8f6a6f9c8e4a524ffefaf98c3  docs/program/waves/WAVE_03_ACCEPTANCE/LIVE_RUNTIME_IDENTITY_MAP_2026-08-23.md
8ba43eb6b3f5c15b3315a9d9d558dce429efa8fa  docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/INITIATIVES_IMPLEMENTATION_READY_CONTRACT_2026-08-23.md
6c1868991dfea2e2fd799a0c2fe5db18834e20af  docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/INITIATIVE_CAPACITY_ANALYSIS_EXPERT_SYNTHESIS_2026-08-23.md
ebc05862652f5a1fb06d267deee35df3d30cd859  docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/INITIATIVE_PLAN_WHAT_IF_EXPERT_SYNTHESIS_2026-08-23.md
bdbe59a5e567cb8827ee6d8d78fa223c2ed20f8f  docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/RESULTS_OWNER_FINAL_IMPLEMENTATION_SPEC_2026-08-23.md
fb9065e64a60a6a3e76ffb71ea0b18fc0f1b0219  docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/FINANCE_RECOVERY_AND_COMPLETION_CONTRACT_2026-08-23.md
02e931403d5d5ca37d988ac0ef61d2eb5e5e0e40  docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/ASSESSMENT_COMPLETE_EXPERT_AUDIT_2026-08-23.md
08f0e4dc8ca594df2ade001264c7299c315cbc89  docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/ASSESSMENT_LEVEL_CARD_SKEPTICAL_REVIEW_2026-08-23.md
bf185730a2d52d06f473a4906b4fd01f9f39a412  docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/ASSESSMENT_OWNER_REVIEW_SUMMARY_2026-08-23.md
ef85125f7fc26e10721da8b473043c2522b6a675  evidence/assessment/ASSESSMENT_EXPERT_TECH_REVIEW_2026-08-23.md
0d7d536d11b7e7c7329306a4d3752eaf5d8d0b61  scripts/recovery/__tests__/report-worktree-inventory.test.mjs
c35a6d7cb7fd02b145e29b6048cc1f9512f1d239  scripts/recovery/report-worktree-inventory.mjs
27c3ecfe6d8744d0e5ce321308ab410ef8077e1d  scripts/wave3/__tests__/report-acceptance-gates.test.mjs
3e763033289d1d3a83f78d04aaa22452b3637393  scripts/wave3/report-acceptance-gates.mjs
```

Control decision: retain the overlay exactly where it is. Before any reuse, each entry receives a destination, requirement linkage and classification of `DOCUMENTATION_ONLY`, `TEST_OR_TOOLING`, `PRODUCT_WIP`, `CONFIGURATION_RISK` or `OWNER_DECISION_REQUIRED`. No reset, stash, clean, bulk copy or merge is authorized.

### Documentation-only overlay reconciliation

Ten source-only documents have now been copied through the controlled candidate
as byte-identical preserved records. Their original paths and SHA-256 content
remain unchanged:

- `LIVE_RUNTIME_IDENTITY_MAP_2026-08-23.md`;
- the Initiatives implementation-ready contract and its Plan/Capacity expert syntheses;
- the Results final implementation specification;
- the Finance recovery and completion contract;
- the three Assessment owner/expert review documents;
- the Assessment technical evidence note.

Five existing candidate registers are divergent from the dirty overlay and are
therefore deliberately not overwritten:

- Initiatives `MODULE_ACCEPTANCE.md`;
- Results `MODULE_ACCEPTANCE.md`;
- Assessment workshop packet;
- Assessment owner-feedback register;
- cross-module row-menu audit register.

These five require atomic requirement reconciliation. Until then, both versions
remain preserved and neither difference is silently promoted to canonical truth.
Configuration, product WIP and test/tooling paths remain in the dirty overlay and
were not copied in this documentation-only step.

## Required connection record for every module

Each module receives one row per surface with these fields before coding resumes:

1. Canonical URL and accepted query parameters.
2. Route declaration and redirects/legacy aliases.
3. Page/hub owner and full-tool owner.
4. Menu 2, Menu 3, table, preview and full-card component owners.
5. API client/hook and server route.
6. Database tables/read model and tenant/auth boundary.
7. Deterministic seed/fixture or reconstructible sample-data source.
8. Focused contract/smoke tests.
9. Owner requirement IDs and evidence screenshots.
10. Classification of every competing implementation: canonical, historical, WIP, duplicate or blocked.

## Safe consolidation sequence

1. Freeze baseline and record all worktree identities — complete.
2. Manifest the dirty main overlay without editing it — complete for the current 23-path denominator; refresh before any later reuse.
3. Compare unique preservation branches at file/blob level; never cherry-pick them wholesale — complete for the named Chat-to-Tools and Finance sources; detached references remain read-only until their module gate.
4. Complete the 16 route → component → API → data → test → evidence records — complete as a source map; runtime proof remains explicitly pending where named.
5. Produce a conflict register with a proposed canonical owner and rollback source for each conflict — complete; unresolved choices remain `OWNER_DECISION_REQUIRED`.
6. Owner reviews the map and explicitly freezes canonical choices.
7. Only then resume bounded integration, one module at a time, preserving the frozen baseline.
8. Run the 21/22 acceptance gates only on a frozen candidate SHA: source, build, focused tests, authenticated browser, API, persistence/readback, visual evidence, expert review and owner acceptance remain separate facts.

## Proposed reversible module integration order

This is an execution dependency order, not authorization to start coding. Every
row is a separate future bounded change. A failed stop gate leaves the candidate
at the preceding exact SHA; it does not trigger a fallback to another historical
screen or a whole-branch merge.

| Order | Module | Why it enters here | Required freeze before integration | Stop gate |
|---:|---|---|---|---|
| 01 | Organization | Establishes tenant-owned context used by later modules. | Canonical organization profile/context owner. | Tenant isolation, authenticated read and cold readback are unproven. |
| 02 | Settings | Establishes user/workspace preferences and shared integration policy. | Canonical settings sections and persistence authority. | A preference renders but does not persist or leaks across tenants. |
| 03 | Admin | Establishes governed users, organizations, access and operational controls. | Role/permission policy and forbidden actions. | Any owner/admin boundary is ambiguous or bypassable. |
| 04 | Chat | Establishes conversation, proposal and governed-action provenance. | Canonical Canvas/action contract from the owner register. | Proposal is presented as execution or durable target readback is absent. |
| 05 | Interview | Produces governed source material for downstream insights. | Canonical URL aliases, question workspace and approval lifecycle. | Submitted material can bypass review or answers/history are lost. |
| 06 | Meetings | Adds meeting evidence, decisions and actions to the same provenance chain. | Stable object deep-link grammar. | Collection works but an object cannot be reopened by stable identity. |
| 07 | My Work | Consolidates assigned tasks, decisions, ideas and notebook work. | Canonical object-table primacy and Chat-to-Tools reconciliation. | Technical/legacy surfaces displace the accepted working lists. |
| 08 | Tools | Converts source material into governed insights, reports and initiatives. | Library/process/insight/report/initiative vocabulary and tool-card owner. | Output chain has no source linkage, persistence or reopen path. |
| 09 | Assessment | Adds the canonical assessment process and DRD full-tool workflow. | Accepted DRD route/card and Interview–Matrix–Report formula. | A historical summary/output card replaces the actual assessment tool. |
| 10 | Audits | Reuses the governed library/process/evidence/findings/report pattern. | Audit object lifecycle and evidence authority. | Findings or reports are generated without auditable source evidence. |
| 11 | Initiatives | Becomes the single planning registry fed by upstream modules. | Initiatives/Plan/Capacity contract and preserved dirty WIP disposition. | Candidate/portfolio legacy concepts reappear or source proposals lose lineage. |
| 12 | Execution | Consumes approved initiatives for realizations, work, resources and steering. | Capability gate behavior and initiative-to-execution identity. | Unavailable banner masks a valid runtime or execution cards diverge from initiatives. |
| 13 | Results | Measures outcomes through the routed KPI/OKR/ROI generation only. | `ResultsVNext` authority, fixture/data profile and no `ResultsHub` fallback. | Legacy cockpit becomes reachable or KPI/OKR/ROI cold readback fails. |
| 14 | Finance | Applies statement, analysis, baseline, prediction and valuation semantics. | Path-by-path Finance branch disposition and five-surface data authority. | Dual-stack responses disagree or preserved branch would require wholesale merge. |
| 15 | Materials | Publishes documents, presentations and sheets from governed sources. | Canonical sheet engine (`ExceleView` or `TabeleView`). | Two engines can own the same route or exported material loses provenance. |
| 16 | Partner | Exposes only approved connected-state information across the external boundary. | First-run versus connected landing and partner access policy. | Internal-only data/action becomes visible or connection state is misrepresented. |

Cross-module rule: a later module may not compensate for a failed earlier gate.
Integration advances only from a clean exact-SHA checkpoint with a recorded
requirement-to-source delta and rollback parent.

## Current conclusion

The recovery problem is not lack of code. It is unresolved source ownership and wiring across several generations. The immediate deliverable is therefore a complete connection and lineage map, not another implementation. Until that map is accepted, no screen that merely renders may be called canonical, fixed or complete.
