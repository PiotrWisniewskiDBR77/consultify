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
