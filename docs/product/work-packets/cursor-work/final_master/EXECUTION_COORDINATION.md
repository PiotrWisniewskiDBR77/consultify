# Final V8 — Execution Coordination (anti-parallel + anti-duplicate)

This document prevents:

- parallel implementations of the same packet,
- accidental creation of parallel “product truths” (duplicate entities),
- unfinished packets that look “done” but lack evidence.

---

## 1. Single-writer lock (mandatory)

Before any packet enters `in progress`, create a lock file:

- `docs/product/work-packets/cursor-work/final_master/locks/P<NN>-<X>.md`

Rules:

- If the lock exists and is not released, **do not start**.
- If takeover is needed: update the lock with a takeover note (who/why/when), then proceed.

Template:

```markdown
# Lock: PNN-X

Status: active | released
Owner: <name/agent>
Branch: <branch>
Started: YYYY-MM-DD HH:MM

## Scope (bounded)
- ...

## Links
- Contract: docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_NN_...md
- Evidence ledger row: (link/anchor)

## Notes
- ...
```

Release:

- mark `Status: released` and/or delete the lock file when the packet reaches its **terminal state**:
  - `P<NN>-A` → `approved(scope)`
  - `P<NN>-B` → `delivered`
  - `P<NN>-C` → `verified(evidence)`

---

## 1.1 Manager gate (agents must not self-select packets)

Before starting any packet, every agent must:

- read `docs/product/work-packets/cursor-work/final_master/NEXT_PACKET.md`
- verify the packet they plan to run is explicitly listed as “Authorized”

If the packet is not listed, the agent must stop and ask the manager to update `NEXT_PACKET.md`.

This prevents “helpful” agents from starting consumers before foundations (e.g. starting P19-B before P18-A).

---

## 1.2 Preflight checklist (must pass before any work)

Before writing code or docs for a packet:

- Confirm the packet is authorized in `final_master/NEXT_PACKET.md`.
- Confirm the lock exists and matches the packet.
- Check `EXECUTION_INDEX.md` for dependency readiness (foundation packets not `draft`).
- Confirm you are extending canon (list the canonical entities/paths you will touch).
- Confirm evidence-first: tests + staging proof script are written before `P<NN>-B` work.

If any preflight item fails: stop and escalate to manager (update `NEXT_PACKET.md` first).

---

## 2. Anti-duplicate “canon-first” rule

When implementing packet `B`:

- First locate the canon:
  - existing tables/entities,
  - registries (settings, templates, tools, etc.),
  - routes/APIs,
  - feature flags,
  - audit/event schemas.
- Extend the canon; do not create “v2” unless `P<NN>-A` explicitly approved it.

If you detect a near-duplicate:

- stop and record it as a risk in the contract section 9,
- turn it into either:
  - a new packet `P<NN>-X` to reconcile, or
  - an out-of-scope declaration (explicit).

---

## 3. “No unfinished” rule (close the loop)

A packet is not finished until:

- evidence ledger is filled (commit/PR, tests, staging proof),
- rollout/rollback posture is validated,
- lock is released,
- status in `EXECUTION_INDEX.md` is updated.

---

## 4. KIMI exception (still no parallel)

`Wordy`/`Excele` can be net-new surfaces, but still follow:

- `P22-A / P23-A` must be complete evidence mapping before `B`,
- single-writer lock per packet.

