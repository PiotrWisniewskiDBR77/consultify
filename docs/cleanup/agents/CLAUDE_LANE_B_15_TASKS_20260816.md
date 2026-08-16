# Claude B — transformation core closure plan (15 tasks)

Branch: `codex/closure-claude-b-transformation`

Worktree: `/Users/piotrwisniewski/Developer/consultify-closure-claude-b`

Product/code baseline: `0f5652690b59f5ebe3f465131bd591a2c4340d2e`

Authority packet commit: `aca1b7a126`

Read the canonical 82-task plan and
`FOUR_BRANCH_EXECUTION_CONTRACT_20260816.md` in full before work.

## Mission

Pracuj do skutku nad all 15 tasks. Establish one Decisions/Tasks/Agent
projection and one Initiative→Execution ownership spine. Ideas workspace code
is owned by Claude C; consume its stable Idea handoff contract without editing
`Idea*` surfaces/services. Do not implement Results/Finance or modify shared
route/flag/migration registries. Emit versioned downstream contracts for Codex.

## Owned tasks — exact denominator 15

### My Work + Agent (4)

1. `MYW-REALDB-FIXTURE-AUTH-001` — create/verify governed positive fixture,
   owner/capability and fresh-PG assertion; materially close every pending.
2. `MYW-AGT-BVP-001` — event→inbox→decision/task/notebook and conversation→
   same transformation case/plan; consume the Claude-C Idea receipt but do not
   edit Idea workspace code. Prove stable IDs, tenant, stale CAS, retry,
   concurrency, projection retire/reopen and cold restart.
3. `AGT-OPS-001` — outbox/restart/long-run, failed-provider recovery, no
   duplicate plan/materialization, telemetry and runbook.
4. `MYW-AGT-UI-CANON-001` — complete role/state/viewport visual/a11y packet;
   keep Radar literally OFF unless a new owner decision changes scope.

### Initiatives (6)

5. `INI-BVP-001` — approved candidate → exactly one Initiative → governed gate
   → exactly one Execution handoff → reopen; tenant project, capability,
   stale, payload collision and concurrent acceptance negatives.
6. `INI-MVP-PROFILE-001` — one project/team/capability/approval policy and
   canonical writer.
7. `INI-MVP-PORTFOLIO-001` — idempotent Portfolio/Resource/Roadmap/Timeline/
   Capacity read models with restart/readback.
8. `INI-MVP-GATE-001` — immutable/auditable GO/NO-GO and same-ID
   scheduled→executing transition receipt.
9. `INI-MVP-CARDS-001` — deterministic persisted cards and reopen; retire or
   make old Full/Roadmap/Portfolio variants read-only after proof.
10. `INI-UI-CANON-001` — hub, management/control/rollout, cards/gates,
    empty/error/conflict, roles, all viewports/themes and accessibility.

### Execution (5)

11. `EXE-BVP-001` — Initiative→case→work/resources/control/report→approved
    delivery evidence→exactly one Results signal→reload; tenant/role/replay/
    concurrency and evidence independent of task status.
12. `EXE-MVP-SPINE-001` — one plan/tasks/milestones/RACI/resources/budget/
    capacity/RAID/issues/changes/decisions spine and one health model.
13. `EXE-MVP-ACTIONS-001` — implement or hide every exposed edit/archive/
    delete action; destructive policy, capability, audit and negative controls.
14. `EXE-FLOW-ADAPTER-001` — versioned Initiative→Execution and
    Execution→Results adapters with stable source ID, idempotency key,
    exactly-once receipt/outbox, retry/restart and cold readback.
15. `EXE-UI-CANON-001` — owner-backed runtime, preview-scoped actions,
    management/control states, responsive/a11y and visual evidence.

## Domain allowlist

Allowed after inventory: My Work decision/task/notebook surfaces excluding
`Idea*`, Agent/transformation-case, Initiatives and Execution components/
controllers/services/routes/domain tests; domain-owned tables/adapters; lane-B
fixtures/evidence and reserved migrations. Candidate producer and Idea inputs
are consumed through contracts; Results receives a versioned signal only.
Shared infrastructure and other lanes are forbidden.

## Required order

1. Close My Work fixture authority and projection invariants.
2. Freeze canonical Initiative owner/profile/gate contracts.
3. Close Initiative cards/read models.
4. Establish Execution spine and action policy.
5. Produce Initiative→Execution→Results adapter contracts and consumer-test
   packet for Claude C; do not edit Results code.
6. UI canon packets, then full lane realDB/browser/regression handoff.

## Lane acceptance

- exactly 15 task verdicts with commits/evidence;
- one writer per My Work projection, transformation case, Initiative lifecycle
  and Execution case/work/evidence;
- no write to retired `case_core`, `ai_agent_plans` or downstream Results;
- fresh+upgrade PG, concurrency/idempotency/restart and tenant/RBAC evidence;
- lifecycle browser flow from governed candidate fixture through emitted
  Results signal, plus responsive/a11y evidence;
- clean worktree and ordered cherry-pickable commits.
