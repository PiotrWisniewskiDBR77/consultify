# Case Workspace — W1 packet registry (draft, EPIC E0 deliverable)

> Status: `DRAFT — first pass from W1 requirement extraction + codebase mapping`
> Base SHA: `9d17cac11484a82f729a51044e30453e39fbcb02` (origin/demo)
> Corpus commit: `80d75f24ce01751639e572226f4e52b30503cd22`
> Generated: 2026-08-09

Source data: `FUNCTIONAL_REQUIREMENT_COVERAGE.csv` (833 rows) and
`CODEBASE_CONVERGENCE_MAP.csv` (49 findings), both produced by two verified
background-workflow passes (see manifest 15 §11/§11.1 for the integrity
incident and fix on the first pass).

## Key convergence finding

This is **not a blank-slate build**. The V8 execution runtime, capability
plumbing and UI primitives already carry most of what E3/E4/E7's shell needs;
the real work is a **Case domain layer that binds them together**, plus
retiring three duplicate mechanisms this program would otherwise be tempted
to reinvent a fourth time:

- `ai_agent_plans`/`ai_agent_plan_steps` (migration 672) — legacy planner,
  `DEPRECATE` target once E4 supersedes it, not a base to build on.
- Three independent migration runners (`migrate.postgres.ts`,
  `migrate.ts`, plus an archived variant) — E13 packets must use
  `migrate.postgres.ts` only, per repo convention, and must not add a fourth.
- Three independent places that already implement "create a task" / "create
  a decision" (`my-work.routes.ts`, `taskExecutor.ts`, plus a third) — E3's
  Capability Registry packet must consolidate onto one owning command, not
  add a fourth caller.
- Two independent feature-flag mechanisms (`FeatureFlags.ts` boot-time,
  `featureFlagService.ts` DB-backed per-org) — E13 packets pick one
  deliberately per flag, not both by default.

## Packets per epic

Each row is a proposed W1-onward work packet: one branch/worktree, one
explicit file allowlist (per document 13 §4.3), assigned only once a Piotr/
Codex-reviewed scope exists — this registry proposes scope, it does not
authorize packets to start.

| Packet | Epic | Depends on | Reuse basis (KEEP/EXTEND) | New work (CREATE/ADAPT) | Requirement rows |
| --- | --- | --- | --- | --- | --- |
| CW-P00 | E0 | — | this registry + convergence map | dependency graph, evidence ledgers | (this document) |
| CW-P01 | E1 | E0 | `projects` table + CRUD router (EXTEND, read-only reference); `currentProjectId` global store threading (KEEP) | `case_core` table (new, 1:1 keyed to `projects.id`) + `caseCoreService.ts`, 9 methods — **IMPLEMENTED, migration+esbuild verified**, commit `81e65dc2ab` | 155 (canon-modes-ux) |
| CW-P02 | E2 | E1 | migration 672 plan/step shape as a reference (EXTEND, not reused as-is); `outputsTransactionalRegistry.ts` idempotent-registration pattern (ADAPT) | CasePlanVersion immutability, digest, diff/replan, branching | 119 (domain-graph-capabilities) |
| CW-P03 | E3 | E0 | `toolGovernanceService.ts`/`toolGovernance.ts` (EXTEND, strongest foundation); `CommandBus.ts` (EXTEND); `toolChainExecutor.ts` DAG executor (KEEP) | Consolidate the 3 duplicate command-creation paths onto one Capability Registry; resolve the 4-way "capability" naming collision before scoping | subset of 119 |
| CW-P04 | E4 | E2, E3 | `v8_execution_runs` (KEEP, already the Run entity); `v8_agent_work_graphs`/`v8_agent_branch_tasks` (KEEP, already NodeRun); `agentOperatorConsoleService.ts` (KEEP, recovery already exists) | CasePlanVersion binding (CREATE — does not exist); pre-E4 hand-port of `v8-full-done`'s 3 commits (session task #8) | 29 (authority-v8-runtime) |
| CW-P05 | E5 | E4 | `operationClaimService.ts` + `artifactLineageService.ts` (EXTEND, lineage/claim patterns) | durable wait claims, human task queue, callback auth/dedupe, outbox/inbox | subset of 70 (security-legacy) |
| CW-P06 | E6 | E1, E2 | autonomy policy concepts already documented in canon (00/08) | server-enforced A0-A4 ceilings, explicit A2/A3/A4 controls, revalidation | 109 (governance-history-decisions) |
| CW-P07 | E7 | E1, E2, E4, E6 | `StandardModuleBar`/`StandardTable`/`StandardPreview`/`ArtifactRightPanel`/`StandardArtifactShell` all confirmed present (KEEP, all 5 primitives exist); `MyTasksListContent`/`DecisionsPanelContent` (ADAPT) | Case Workspace shell itself (CREATE — none exists); retire `MyWorkHub.tsx` (4727 lines) as the target, component-donor only | 235 (authority-ui-standards + canon UI rows) — **UI packets pause at W2-V0 (task #9)** |
| CW-P08 | E8 | E1, E2, E4, E6, E7 | `useOpenChatWithContext`, `WorkspaceContext`, `chatNavigator.ts`, `CHAT_ACTION_DEFINITIONS`, `myWorkIntent`/`myWorkEvent` bus, `useConversationStore` pmoContext — all KEEP/EXTEND, unusually complete | ephemeral proposal → exact confirmation receipt binding to Case | subset of 155 |
| CW-P09 | E9 | E4 | — | branch/join/timeout/compensation graph semantics (CREATE) | subset of 119 |
| CW-P10 | E10 | E3, E4 | native artifact modules (Documents/Presentations/Excel per memory) | evidence/provenance/rights linking, facts digest, DOCX/PPTX/XLS readback | 76 (golden_case rows) |
| CW-P11 | E11 | E10 | — | append-only history, honest closure types, Monitoring Case split | subset of 70 |
| CW-P12 | E12 | E2 | — | Play draft/publish/instantiate via CasePlanVersion | subset of 109 |
| CW-P13 | E13 | E4, E9 | `migrate.postgres.ts` convention (EXTEND); two flag mechanisms (EXTEND, pick deliberately) | legacy read adapter, quarantine, cohort rollout, kill switch | 30 (LEGACY_MIGRATION_PARITY) |
| CW-P14 | E14 | all above | — | correlation chain, Golden Cases A-F, candidate manifest | 110 (EPIC_DOD_COVERAGE) |

## Naming collisions to resolve before scoping (found during mapping, not yet owner-reviewed)

1. **"Capability"** is already used for at least four unrelated things in the
   codebase (`capabilityService.ts`, `capability.routes.ts`, and two more per
   the `capability-commands` finding) — E3 needs an explicit disambiguated
   name before packets start, or packets will collide on the same identifier
   for different concepts.
2. **Three overlapping project/case-related `AppView`s** already exist in
   `src/types/core.ts` — E1/E7 packets must map onto or explicitly retire
   these, not add a fourth parallel concept silently.

Both are flagged here as scope questions for whoever reviews packet CW-P01/
CW-P03 before they start — not resolved unilaterally in this registry.

## CW-P01 (E1 Case Core) — design decisions accepted 2026-08-09

The implementing agent flagged six open questions rather than silently
deciding them (full text in commit `81e65dc2ab` and the workflow journal).
Coordinator resolutions, per the autonomous-decision policy (ordinary
reversible engineering judgment, not owner-escalation-worthy):

1. **caseId vs projectId at the API boundary** — accepted as designed
   (`case_id` is the real PK, decoupled from `project_id`). Deferred: how the
   future API/frontend exposes this is an E7/API-layer decision, moot while
   UI is paused at W2-V0.
2. **`contracted_closure_type` NOT NULL at creation** — accepted; matches
   canon section 7's confirmation-contract timing literally.
3. **Loose TEXT pointer columns pending E6/CasePlanVersion** — accepted,
   correctly deferred; tracked here so a later packet adds the FK instead of
   silently leaving it loose forever.
4. **`governance_tier_history` as JSON column vs. dedicated table** —
   accepted for now (single-table constraint was explicit in the packet
   brief); revisit if query volume ever needs it.
5. **`recordClosure` cross-check as service-layer-only, no DB CHECK** —
   accepted; defense-in-depth CHECK constraint can be added later without a
   breaking migration.
6. **Autonomy-ceiling enforcement blocked on E6** — accepted as a known,
   tracked gap, not this packet's job.

## Status of this registry

First pass only. Each packet's file allowlist, acceptance criteria and exact
requirement-row assignment (currently only cluster-level, not per-row) is
completed when that packet is actually opened, per document 13 §4.3.
