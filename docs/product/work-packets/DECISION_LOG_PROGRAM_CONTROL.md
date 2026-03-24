# V8 Program — Program Control Decision Log

> Status: Active
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: program-level control decisions (not wave-specific)

---

## Decision PC-1 — Wave 8 scope

- **Defer.** Wave 8 is formally frozen.
- Mobile, Edukacja, and new large branches are not part of the active V8 rollout.
- Wave 8 may reopen only through explicit later approval.
- Current Wave 8 analysis is closed but not permanently cancelled.

## Decision PC-2 — Implementation sequencing (first 3 code targets)

- Approved sequence:
  1. `WP-W1-AI-01` → ContextSnapshot (identity spine first)
  2. `WP-W1-AI-03` → Execution/Approval Spine (shared proposal/approval governance second)
  3. `WP-W1-MP-01` → CollaborationRoom (collaboration substrate third)
- PM sync must not move ahead of this trio.
- Execution visibility grows on top of the first two, not as an earlier target.

## Decision PC-3 — Implementation mode (Hybrid — Option C)

- Manager agent continues producing implementation specs and packet governance.
- Worker agents may implement core primitives, contracts, schemas, services, and tests.
- Broader UI/integration slices remain gated — no uncontrolled parallel implementation.
- Rule: `implement core platform/runtime primitives first; integrate outward in controlled later slices`.

## Decision PC-4 — Build phase conditional approval (2026-03-23)

- Implementation build phase accepted conditionally.
- Approved phase order:
  1. **Integration testing** — mandatory immediate next step.
  2. **Production deployment planning** — may run in parallel as planning-only.
  3. **UI surface wiring** — only as controlled, feature-flagged slices after integration gate passes.
- Rules:
  - No production rollout before integration verification.
  - No broad UI rewiring in one pass.
  - Every UI slice must be bounded, reversible and feature-flagged.
  - Deployment planning must include migrations, rollback, rollout strategy, feature flags and support readiness.
- Deliverables produced:
  - `V8_INTEGRATION_TEST_PROGRAM.md` — 3-tier test program (contracts, flows, migrations)
  - `V8_DEPLOYMENT_READINESS_PLAN.md` — migrations, rollback, feature flags, rollout phases, support readiness
  - `V8_UI_WIRING_QUEUE.md` — 23 bounded slices across 6 priority levels

## Decision PC-5 — 20-wave program authority (2026-03-23)

- **`V8_FINAL_20_WAVE_IMPLEMENTATION_CLOSURE_PROGRAM.md` is the primary operational authority** for all forward execution.
- The prior 7-wave structure from `V8_IMPLEMENTATION_MASTER_PROGRAM.md` is superseded for wave numbering and closure criteria.
- All work completed under the prior 7-wave cycle (108 V8 files, 103 DB tables, 1,911 tests, 74 integration tests, 3 build-phase deliverables) maps as **foundational input** to the 20-wave program.
- No prior wave is automatically considered "closed" under the 20-wave closure criteria — each must be assessed against the new 5-dimension closure scale (platform/core, integration, UI/product surface, operator/support, content/seed).
- Forward work packets use `WP-20WX-NN` numbering (20-wave program).
- Rule: `the 20-wave program defines what closure means; the prior 7-wave work defines what foundation exists`.

## Decision PC-6 — Final frozen package authority reconciliation (2026-03-24)

- `docs/product/V8_V81_FINAL_COMPLETION_PROGRAM.md` is the **highest closure authority** for the frozen combined package `V8.0 + V8.1`.
- `docs/product/V8_V81_MANAGER_4_AGENT_ORCHESTRATION_PROMPT.md` is the canonical operating brief for the manager-led 4-track closure model.
- `docs/product/work-packets/IMPLEMENTATION_CONTROL_BOARD.md` is the **operational execution ledger** for current implementation/runtime/evidence progress.
- `docs/product/V8_POST_20_WAVE_CLOSURE_PROGRAM.md` and `docs/product/work-packets/POST_20_WAVE_CLOSURE_AUDIT.md` remain historical baseline documents and must not be treated as current repo/runtime truth where later execution evidence or code contradicts them.
- PC-5 remains valid as historical execution framing for the 20-wave foundation, but does **not** override the final frozen-package closure doctrine.
