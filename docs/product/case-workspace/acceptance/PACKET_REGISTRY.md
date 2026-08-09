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
| CW-P02 | E2 | E1 | migration 672 plan/step shape as a reference (EXTEND, not reused as-is); `outputsTransactionalRegistry.ts` idempotent-registration pattern (ADAPT) | `case_plan_versions` + `case_plan_view_state` tables, `casePlanVersionService.ts`, 13 methods — **IMPLEMENTED, migration+idempotent-rerun+esbuild verified**, commit `1fe58aaef5` | 119 (domain-graph-capabilities) |

## CW-P02 (E2 CasePlanVersion) — design decisions accepted 2026-08-09

Eight open questions flagged by the implementing agent; coordinator
resolutions:

1. **`IN_REVIEW->DRAFT` / `PUBLISHED->WITHDRAWN` command/route names absent
   from canon** — accepted the agent's by-analogy implementation
   (`requestChangesOnPlanVersion`, `withdrawPlanVersion`); exact public
   command/route names are an E2-HTTP-layer decision, not yet built, deferred.
2. **`plan_number` vs `version` naming** — accepted as designed; correct
   resolution of a real naming collision with CW-P01's OCC counter.
3. **GR-036 `DEFERRED_EXTERNAL` scope** — accepted; correctly blocked on a
   Capability Registry (E3) this packet does not own.
4. **`case_core.current_plan_version_id` sync ownership** — decided: stays
   unsynced (NULL) for now; callers query
   `case_plan_versions WHERE case_id=? AND status='PUBLISHED'` directly.
   Whichever packet builds the read model/orchestration layer for E4 owns
   deciding whether to denormalize it later.
5. **Any-cycle-rejected in `validatePlanVersion`** — accepted as a
   deliberately conservative default; revisit only if/when CW-GR-008 grows an
   explicit loop-policy field.
6. **`diffPlanVersions` assumes ID-stable authoring** — accepted, flagged as
   a known limitation until the (not-yet-built) E7/E9 authoring flow confirms
   it preserves node/edge ids across a replan.
7. **`SECRET_REF` stored verbatim, not the structured envelope CW-GR-013
   describes (classification/checksum/redacted preview)** — accepted for now
   but flagged here explicitly as a **security-relevant tracked gap**: no
   secret value should reach `semantic_graph` in practice until a real
   `SECRET_REF` envelope exists; this is a prerequisite for E2's HTTP layer
   or any packet that lets a user paste a real credential into a plan.
8. **`putViewState` last-write-wins, no OCC** — accepted; layout-only,
   reasonable default, revisit only if concurrent multi-tab editing proves it
   matters.
| CW-P03 | E3 | E0 | `toolGovernanceService.ts`/`toolGovernance.ts` (EXTEND, strongest foundation); `CommandBus.ts` (EXTEND); `toolChainExecutor.ts` DAG executor (KEEP); `ApprovalClass` from `executionSpine.ts` (reused by reference) | `case_workspace_capabilities` + `case_workspace_capability_idempotency_keys`, `capabilityRegistryService.ts`, 7 methods — **IMPLEMENTED, migration+idempotent-rerun+esbuild+5-file-zero-diff verified**, commit `84535b61d6`. Naming collision resolved: namespaced under `case_workspace_*`, not renamed the canon term. | subset of 119 |

## CW-P03 (E3 Capability Registry) — design decisions accepted 2026-08-09

1. **Platform-global registry (no org_id/case_id column)** — accepted;
   matches CW-GR-015's schema, which lists no tenant field. An org-level
   enablement overlay, if needed, is an additive future table, not a rename.
2. **`capability_version` vs OCC `version`** — accepted; same split CW-P02
   established for `plan_number`/`version`.
3. **CW-GR-020 attributes (effective scope, error taxonomy) in open-ended
   `metadata` JSON only** — accepted; canon names these fields but never
   gives them a concrete shape, so guessing one would be worse than an
   explicit extension point.
4. **Locally-invented enums for `health`/`data_classification`/
   `idempotency_strategy`/`reversibility`** — accepted as placeholders;
   flagged here for product to confirm exact vocabularies before any UI
   renders them as fixed choices.
5. **Adapter-side "active" gate not enforceable yet** — accepted; adapters
   (InternalCommandAdapter/MCP/HTTP/Connector/Agent) are explicitly later E3
   work, out of this packet's scope.
6. **No idempotency-key completion/TTL** — accepted as a known gap; the
   packet that builds the real command dispatcher (an adapter packet) owns
   adding completion/expiry once it knows real execution outcomes.
7. **`owning_command_ref` not runtime-enforced** — accepted; enforcement
   ("human UI and Teresa call the same owning command") belongs to whichever
   packet wires routes/dispatcher through this registry, not to registry
   persistence itself.
| CW-P04 | E4 | E2, E3 | `v8_execution_runs` (KEEP, already the Run entity, read-only referenced); `v8_agent_work_graphs`/`v8_agent_branch_tasks` (KEEP, already NodeRun); `v8_agent_run_identities.canonical_run_id` (pattern reused: run_id as PK) | `case_workspace_run_bindings` (run_id itself is the PK — structurally at-most-one-binding-ever), `runBindingService.ts`, 4 methods — **IMPLEMENTED, migration+idempotent-rerun+esbuild+v8-files-untouched verified**, commit `2ede09b5b6` | 29 (authority-v8-runtime) |

## CW-P04 (E4 Run binding) — design decisions accepted 2026-08-09

1. **Call-site timing (when in the Run lifecycle bindRunToPlanVersion fires)**
   — deferred; belongs to whichever future packet actually drives
   `v8_execution_runs.state` transitions, out of this packet's scope.
2. **PUBLISHED-required at bind time, inferred not literally stated** —
   accepted as the correct reading of CW-01-011 ("immutable approved
   definition"); flagged for product to confirm no dry-run/preview Run needs
   to bind against a non-PUBLISHED version.
3. **Organization cross-check beyond literal packet scope** — accepted and
   kept; a defensive tenant-isolation guard is worth keeping even if an
   upstream invariant already guarantees it elsewhere.
4. **No `updated_at`, by design (row never mutated)** — accepted; revisit
   only if a future recovery/compensation packet needs to record a
   Run-was-superseded fact, which would likely be a NEW row/table, not a
   mutation of this one.
5. **`correlationId` belongs on `v8_execution_runs`, not this table** —
   accepted; out of scope (no ALTER TABLE permitted on `v8_execution_runs`
   by this program's collision-avoidance mandate).
| CW-P06 | E5 | E4 | `operationClaimService.ts` (EXTEND, lease/claim pattern reused by idiom, table never shared) + `artifactLineageService.ts` (reference) | `case_workspace_waits`, `waitSubscriptionService.ts`, 11 methods — **IMPLEMENTED, migration+idempotent-rerun+esbuild+operationClaimService-untouched verified**, commit `cbc65d7b42`. HUMAN/TIMER fully built; DOMAIN_EVENT/EXTERNAL_CALLBACK enum values + resolve() path only, real inbox/dedupe deferred (CW-CANON-12). | subset of 70 (security-legacy) |

## CW-P06 (E5 WaitSubscription) — design decisions accepted 2026-08-09

1. **`node_run_id` nullable despite CW-RT-020 listing it as required** —
   accepted; a NodeRun cannot exist before its owning Run, and `run_id` is
   already nullable per this packet's own scope, so `node_run_id` must
   follow.
2. **`action_proposal_id` FK added beyond CW-RT-020's literal schema** —
   accepted; this was an explicit instruction in the packet brief (a wait
   gating a specific ActionProposal), not an unrequested addition.
3. **Lease/claim columns added beyond CW-RT-020's literal schema** —
   accepted; necessary to satisfy CW-RT-021's "leases and atomic claiming"
   requirement, correctly mirrors the existing NodeRun lease-field pattern.
4. **No bounded-wait polling in `claimTimerWait` (unlike
   `operationClaimService`'s 8s default)** — accepted; this packet's caller
   is a scheduler sweep, not a concurrent request path, so blocking-wait
   semantics don't apply the same way.
5. **`correlation_key` double duty (domain correlation + idempotent-create
   key)** — accepted; WaitSubscription has no separate idempotencyKey field
   in canon, and reusing correlation_key is the natural, minimal choice.
6. **`wait_target_required` (at least one of run_id/action_proposal_id) as
   service-level check, not a DB CHECK** — accepted; not literally stated in
   canon, so enforcing it as guidance rather than a hard constraint is the
   right conservatism.
7. **Trigger points for `ExpireWait`/timer-claim sweep not built** —
   accepted; only the durable primitives are this packet's job, the actual
   cron/worker loop is orchestration, future work.
8. **DOMAIN_EVENT/EXTERNAL_CALLBACK satisfaction path not built** — accepted;
   correctly deferred per CW-CANON-12, needs an event bus/inbox this packet
   doesn't build.
9. **`provideHumanInput`'s actor not persisted (no decided_by-shaped
   column)** — accepted for now since CW-RT-020's literal schema has no such
   field; flagged as worth reconsidering once a real HUMAN-wait UI needs to
   display who provided input, which would need a small additive migration.
10. **Tenant/membership checks not enforced at this layer** — same
    cross-cutting gap as CW-P01-05, already tracked prominently in the
    CW-P05 section above; not repeated in full here.
| CW-P05 | E6 | E1, E2 | autonomy policy concepts already documented in canon (00/08) | `case_workspace_action_proposals` + `case_workspace_action_proposal_decisions`, `proposalApprovalService.ts`, 13 methods — **IMPLEMENTED, migration+idempotent-rerun+esbuild+tsc-strict verified**, commit `b3e5f4c524`. Renumbered from the original CW-P06 slot: packet IDs are assigned in actual execution order (E1→E2→E3→E4→E6), not strict epic-number order — E5 was deliberately skipped for now, see §"Execution order note" below. | 109 (governance-history-decisions) |

### Execution order note

Packets are numbered CW-P01, CW-P02, ... in the order they actually start,
not by epic number. E5 (durable waits/events) was skipped ahead of E6
(proposals/approvals) because E6 builds directly on E1's already-landed
`autonomy_policy` column and is a governance-critical prerequisite; E5 will
be picked up as a later packet (its own CW-P0N slot, assigned when it
starts). This note exists so the packet-ID sequence isn't mistaken for the
epic-number sequence when this registry is read later.

## CW-P05 (E6 ActionProposal/Approval) — design decisions accepted 2026-08-09

Twelve open questions; coordinator resolutions, grouped:

- **Version-naming collision (`proposal_version`/`target_expected_version`/
  OCC `version`)** — accepted, same precedent as CW-P02/CW-P03.
- **`node_run_id` NOT NULL with no canonical NodeRun table/FK** — accepted as
  an opaque unenforced TEXT column; this is a real gap (no referential
  integrity), tracked for whichever future packet defines a real NodeRun
  table.
- **`proposal_version` numbering scheme inferred** — accepted, consistent
  with the `plan_number` precedent.
- **`target_expected_version` cross-module staleness not verified** —
  accepted as correctly out of scope; would require every target module to
  expose its own OCC state to this service, too broad for this packet.
- **Expiry blocks APPROVE only, not REJECT/REQUEST_CHANGES/DEFER** —
  accepted; this is the safer reading (you can always kill or downgrade a
  stale proposal, you just can't approve one).
- **DEFER modeled as a non-status-changing audited fact** — accepted as the
  correct reading of CW-RT-041 never listing it as a state-machine trigger.
- **Self-approval prohibition scoped to APPROVE only** — accepted and
  confirmed correct: a proposer rejecting/deferring their own proposal is
  withdrawal, not a governance bypass. Restricting the hard ceiling to
  APPROVE is the right scope, not a loophole.
- **No idempotency-key ledger for execution-transition methods (OCC only)**
  — accepted; the real dispatcher (CW-RT-043, future work) will know actual
  outcomes and can add one then.
- **`revokeApprovedProposal` doesn't enforce "before execution where policy
  permits"** — accepted; the state machine itself already blocks revoking
  past APPROVED (mechanical guard), the deferred part is a policy nuance
  needing an engine that doesn't exist yet.
- **`authenticationAssurance`/`approvalChannelPolicy` free-text, no canon
  vocabulary** — accepted as placeholder, same pattern as CW-P03's
  `data_classification` gap.
- **LIGHT-Case single-click "Zatwierdź i rozpocznij" is not an
  ActionProposal** — accepted; that's an orchestration-layer composition of
  `createCase`+`publishPlanVersion`+start, not this packet's concern.
- **Tenant/membership authorization not enforced at this service layer** —
  accepted as a deliberate layering choice (service = business logic +
  invariants, authorization = route/middleware), **but flagged here
  prominently as a cross-cutting item**: this is now true of all five
  CW-P01-05 services, not unique to this packet. **Hard prerequisite before
  any HTTP route wires these services**: the future route layer must
  implement real tenant/membership/ACL checks before exposing any of
  `caseCoreService`, `casePlanVersionService`, `capabilityRegistryService`,
  `runBindingService`, or `proposalApprovalService` to a network boundary.
  Not a blocker for further backend-only packets, but must not be forgotten
  once E7/E8 (UI/Chat, both gated at W2-V0 anyway) or any HTTP layer starts.
| CW-P07 | E7 | E1, E2, E4, E6 | `StandardModuleBar`/`StandardTable`/`StandardPreview`/`ArtifactRightPanel`/`StandardArtifactShell` all confirmed present (KEEP, all 5 primitives exist); `MyTasksListContent`/`DecisionsPanelContent` (ADAPT) | Case Workspace shell itself (CREATE — none exists); retire `MyWorkHub.tsx` (4727 lines) as the target, component-donor only | 235 (authority-ui-standards + canon UI rows) — **UI packets pause at W2-V0 (task #9)** |
| CW-P08 | E8 | E1, E2, E4, E6, E7 | `useOpenChatWithContext`, `WorkspaceContext`, `chatNavigator.ts`, `CHAT_ACTION_DEFINITIONS`, `myWorkIntent`/`myWorkEvent` bus, `useConversationStore` pmoContext — all KEEP/EXTEND, unusually complete | ephemeral proposal → exact confirmation receipt binding to Case | subset of 155 |
| CW-P09 | E9 | E4 | — | branch/join/timeout/compensation graph semantics (CREATE) | subset of 119 |
| CW-P10 | E10 | E3, E4 | native artifact modules (Documents/Presentations/Excel per memory) | evidence/provenance/rights linking, facts digest, DOCX/PPTX/XLS readback | 76 (golden_case rows) |
| CW-P07 | E11 | E1 | — | `case_workspace_history_events` (FK-less, open event_type) + `case_workspace_value_measurements` (CW-02-032 field list, FK to case_core), `caseHistoryService.ts`, 5+ methods — **IMPLEMENTED, migration+idempotent-rerun+esbuild+case_core-untouched verified**, commit `1002af2a89`. Renumbered from the original CW-P11 slot per the execution-order note above; built directly on E1 (not E10, which this program hasn't reached yet), Monitoring-Case split explicitly deferred. | subset of 70 |

## CW-P07 (E11 history/value) — design decisions accepted 2026-08-09

1. **No retrofit of CW-P01-06 services to emit history events yet** —
   accepted; only `recordValueMeasurement` calls `appendCaseHistoryEvent` in
   this packet. Flagged as real follow-up work: `caseCoreService`,
   `casePlanVersionService`, `runBindingService`, `proposalApprovalService`,
   `waitSubscriptionService` should eventually call
   `appendCaseHistoryEvent` from their own mutating methods so the timeline
   is actually complete, not just measurement-triggered.
2. **`event_type` open TEXT, not a CHECK enum** — accepted; correct
   tradeoff so future emitters (item 1's follow-up) never need a migration
   just to add a new event kind.
3. **`confidence` as LOW/MEDIUM/HIGH, not numeric** — accepted as a
   reasonable default; canon doesn't specify a scale, flagged for product to
   confirm before any UI renders it.
4. **No `monitoring_case_id` column yet** — accepted; the Monitoring-Case
   split (CW-00-017/OD-06) needs a Case-to-Case relationship concept this
   packet correctly doesn't invent ahead of need.
5. **EVIDENCE_MISSING vs UNMEASURED reading** — accepted (attempted-but-
   unavailable vs never-attempted).
6. **`kpi_ref` opaque, no FK into Results** — accepted; Results is a
   read-only-owned domain per the collision map, out of this packet's reach
   entirely.
7. **Tenant/membership checks not enforced here** — same cross-cutting gap
   as all prior packets, already tracked.
8. **`dedupe_key` idempotency designed without a route layer to confirm
   caller discipline** — accepted; defensive design ahead of need is
   reasonable here since it costs nothing structurally.
| CW-P08 | E12 | E2 | `casePlanVersionService.createPlanDraft` reused by call, not duplicated | `process_definitions` + `process_versions`, `playService.ts`, 13 methods — **IMPLEMENTED, migration+idempotent-rerun+esbuild+casePlanVersionService-untouched verified**, commit `b8a644a4f8` + cross-tenant fix `44769e6bc9`. Renumbered from CW-P12 per the execution-order note. | subset of 109 |

## CW-P08 (E12 Plays) — design decisions accepted 2026-08-09

1. **Authorization vocabulary limited to org role OWNER/ADMIN, no dedicated
   process-owner/reviewer role** — accepted as a reasonable minimum viable
   gate; flagged for product to confirm the intended fuller vocabulary
   before any route ships.
2. **Only monotonic visibility widening (PRIVATE→TEAM/ORGANIZATION), no
   narrowing** — accepted; canon doesn't ask for narrowing and it's easy to
   add later without a breaking change.
3. **No self-review prohibition** — accepted for now; `shareProcessDefinition`'s
   role gate is the actual protection for shared visibility, review is an
   additional, not the only, checkpoint. Worth revisiting alongside E6's own
   self-approval precedent (CW-P05) if a stronger separation-of-duties
   requirement surfaces later.
4. **Multiple PUBLISHED process_versions may coexist (no auto-deprecate,
   no SUPERSEDED state)** — accepted; matches CW-RT-028's literal state
   machine, which has no SUPERSEDED value, unlike CasePlanVersion's.
5. **Cross-tenant instantiation gap — FIXED, not just tracked.** The
   implementing agent correctly identified the gap but hesitated on whether
   reading `case_core` was "reserved" to CW-P02. It wasn't — every sibling
   packet already does this. Coordinator added the read-only organization_id
   cross-check directly (commit `44769e6bc9`) rather than leaving a known
   tenant-isolation hole open.
6. **`capability_versions`/`policy_ref`/`required_bindings` free-form JSON**
   — accepted, same open posture as CW-P03's `metadata` column.
7. **≥1 PUBLISHED version required before widening visibility** — accepted
   as the literal, defensible reading; flagged for product to confirm
   pre-publish collaboration sharing isn't also wanted.
8. **`team_id` has no real team entity to resolve against** — accepted;
   column exists per canon's enum, real meaning deferred until a team
   concept lands elsewhere in the product.
9. **`version_number`/`version` naming split, mirroring CW-P02's
   `plan_number`/`version`** — accepted, consistent with established
   precedent, same confirm-before-public-API flag carried forward.
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
