# Canonical 16-module source control map — 2026-08-24

## Purpose and freeze

This document is the single navigation and control map for recovering Consultify. It does not replace module acceptance registers, owner-feedback registers, screenshots, specifications, or tests.

- Candidate worktree: `/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823`
- Candidate branch: `codex/final-mvp-integration-20260823`
- Frozen baseline: `2b6c8c360812f55d860eac5b99dcedfabc3cae04`
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
| Final MVP integration | `2b6c8c3608` | `CANONICAL_CANDIDATE` | Only place where the recovery map may be updated. Product code remains frozen. |
| Main developer worktree | `43730f86f8` plus 22 dirty entries | `PRESERVED_WIP` | Preserve exactly; inventory only. Never clean/reset/stash. |
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
| 09 | Results | `/results/kpi` | KPI; OKR; ROI | registries `src/components/ResultsVNext/*`; `/results` entry `ResultsOwnerReviewEntry` | `modules/09_RESULTS/MODULE_ACCEPTANCE.md` | `DUPLICATE_OWNER`: `Results/*` and `ResultsVNext/*`; freeze until lineage matrix resolves owner |
| 10 | Finance | `/finance?tab=statements` | Statements; Analysis; Baseline; Prediction; Valuation | `src/views/EconomicsView.tsx` → `src/components/Economics/FinanceHub.tsx` | `modules/10_FINANCE/MODULE_ACCEPTANCE.md` | `PRESERVED_WIP`: compare 37-file Finance branch patch before selection |
| 11 | Materials | `/presentations?tab=all` | All; Documents; Presentations; Sheets; Template Library | `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` | `modules/11_MATERIALS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; detached live source comparison pending |
| 12 | Audits | `/audit-programs` | Library; Programs/Processes; Evidence; Findings; Reports; Initiatives | `src/components/Audit/method/AuditsMethodHub.tsx` | `modules/12_AUDITS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; route/API proof pending |
| 13 | Chat | `/chat` | Conversations; Sourced context/Snapshots; Proposals; Decisions | `src/components/AIChat/UnifiedChatPanel.tsx` | `modules/13_CHAT/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; Chat-to-Tools WIP comparison pending |
| 14 | Admin | `/admin` | Overview; Users; Organizations; Access; AI/Models; Operations/Audit | `src/views/admin/AdminView.tsx` | `modules/14_ADMIN/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; unresolved policies remain gated |
| 15 | Settings | `/settings` | Profile; Workspace; Notifications; Integrations; Security/Privacy | `src/views/SettingsView.tsx` | `modules/15_SETTINGS/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; cross-module standard is binding input |
| 16 | Partner | `/partner` | Overview; Opportunities; Connections; Collaboration; Materials; Settings | `src/views/partner/PartnerPortalView.tsx` | `modules/16_PARTNER/MODULE_ACCEPTANCE.md` | `CANONICAL_CANDIDATE`; content/source audit pending reconciliation |

All acceptance paths above are relative to `docs/program/waves/WAVE_03_ACCEPTANCE/`.

## Known architecture conflicts requiring resolution

1. **Results has two product generations.** `src/components/Results/*` and `src/components/ResultsVNext/*` coexist. `/results` and `/results/kpi|okr|roi` do not currently have one obvious source owner. Do not reconnect screens until a route-to-component-to-contract matrix proves the intended owner for list, preview and full tool.
2. **Finance has a unique preserved patch.** The `e7574b340e` branch is not patch-equivalent to the candidate. It contains UI, runtime, server, seed and test changes. It must be decomposed into intended requirements and compared against current blobs; a wholesale cherry-pick is prohibited.
3. **Chat-to-Tools preservation is contaminated.** The branch contains valuable documents/screenshots and cache material under `false/_cacache`. The commit is not a merge unit.
4. **Dirty main contains owner-authored evidence.** Its 22 entries are not disposable dirt. They are an overlay requiring a manifest and destination decision.
5. **Screenshots are acceptance evidence, not route authority.** A visually better historical image does not by itself prove the correct backend, persistence, tenant, permissions or source lineage.

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
2. Manifest the dirty main overlay without editing it.
3. Compare unique preservation branches at file/blob level; never cherry-pick them wholesale.
4. Complete the 16 route → component → API → data → test → evidence records.
5. Produce a conflict register with a proposed canonical owner and rollback source for each conflict.
6. Owner reviews the map and explicitly freezes canonical choices.
7. Only then resume bounded integration, one module at a time, preserving the frozen baseline.
8. Run the 21/22 acceptance gates only on a frozen candidate SHA: source, build, focused tests, authenticated browser, API, persistence/readback, visual evidence, expert review and owner acceptance remain separate facts.

## Current conclusion

The recovery problem is not lack of code. It is unresolved source ownership and wiring across several generations. The immediate deliverable is therefore a complete connection and lineage map, not another implementation. Until that map is accepted, no screen that merely renders may be called canonical, fixed or complete.
