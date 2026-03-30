# Final V8 — Packet Tasks & DoD Library (A/B/C)

Purpose: give **repeatable, precise** task checklists and DoD gates so every packet is executed the same way, without losing context.

Authority: `PROGRAM_EXECUTION_PLAYBOOK.md` (this doc operationalizes it).

---

## Packet PNN-A — Scope approval (contract hardening)

### Tasks (must do)
- Confirm `Context pack` is correct (max 5 links, correct order).
- Freeze **bounded scope**: in-scope, non-goals, assumptions.
- Declare **dependencies** and the handoff contract (producer→consumer).
- Convert Softs parity + gaps into **approval-grade acceptance checklist** (5–15 bullets).
- Define **degraded modes** for missing inputs / partial availability (no overclaim).
- Define **evidence requirements** for PNN-B/PNN-C (tests + staging proof artifacts).
- Define rollout posture (flags, gradual exposure) and rollback posture (safe revert).

### DoD (exit criteria)
- Scope is approved as **explicit boundaries** (no silent scope creep).
- Missing-input gate passed (references linked; “no guessing” satisfied where applicable).
- Acceptance checklist is concrete and testable (not adjectives).
- Evidence checklist is concrete (what proof, where it lands).

---

## Packet PNN-B — Core runtime closure (build what was approved)

### Tasks (must do)
- Implement the bounded functionality (only what PNN-A approved).
- Add/extend automated tests required by the contract (integration + regression + contract tests).
- Ensure cross-surface coherence (no split-truth; state/permissions consistent).
- Implement degraded states and error taxonomy (user can see “what next”).
- Update telemetry/audit events if required by the module’s DoD.

### DoD (exit criteria)
- All acceptance items for PNN-B pass in runtime.
- Tests run and pass; failures have clear states and recovery paths.
- No silent writes / no hidden side effects beyond declared scope.

---

## Packet PNN-C — Verification, rollout, evidence

### Tasks (must do)
- Run required test suite; capture outputs (command + summary).
- Execute staging proof checklist; capture evidence (video/screens + what it proves).
- Fill `Evidence ledger` row(s) for PNN-A/B/C with links and notes.
- Confirm rollout plan + rollback plan are operational (flags, kill-switches, safe fallback).

### DoD (exit criteria)
- Packet marked `verified(evidence)` per playbook.
- Evidence ledger complete (commit/PR, tests, staging proof, known limits).
- Rollout/rollback posture is validated (not aspirational).

