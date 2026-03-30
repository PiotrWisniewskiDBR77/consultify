# Final V8 — Execution Playbook (SSOT for delivery)

Date: 2026-03-30  
Scope: operational rules to deliver **all 35 positions** without losing context and without “paper-complete” drift.

This playbook is **execution SSOT**. If a per-module contract conflicts with this playbook on process (gates, evidence format, packet anatomy), this playbook wins.

---

## 1. The unit of work: a bounded delivery packet

Every position is delivered as **bounded packets**. A packet is the smallest unit that can be:

- approved (scope),
- implemented,
- proven (tests + staging proof),
- rolled out safely,
- recorded in evidence ledger.

Packet naming:

- `P<NN>-A`, `P<NN>-B`, `P<NN>-C` … where `<NN>` is position number (01–35).

Minimum packet anatomy:

- **Context pack** (max 5 links)
- **Inputs required** (what must exist before starting)
- **Acceptance checklist** (product must-pass)
- **Evidence checklist** (what proofs we will attach)
- **Rollback posture** (how to revert safely)

---

## 2. Status model (program-wide)

We use exactly these states:

- `draft`
- `approved(scope)`
- `in progress`
- `delivered`
- `verified(evidence)`

Meaning:

- **approved(scope)**: scope is explicit, non-goals are explicit, missing inputs are listed, packet boundaries exist.
- **delivered**: functionality works in the declared scope (but evidence may still be incomplete).
- **verified(evidence)**: evidence ledger is complete for the delivered scope (tests + staging proof + audit notes).

No position is considered “done” until it is **verified(evidence)**.

---

## 3. The two gates that prevent context loss

### 3.1 Missing-input gate (No guessing)

If a position/packet requires competitor-specific behavior (“100% KIMI style”, Gamma-like, etc.), it cannot enter `in progress` unless:

- the competitor reference is linked (local `Softs/` evidence pointer or SSOT benchmark),
- the contract states what is **bounded** vs **non-goal**,
- degraded modes are defined (what we do when the reference is missing/partial).

### 3.2 Evidence gate (Done = evidence)

A packet cannot move to `verified(evidence)` unless the evidence ledger contains:

- commit/PR reference,
- test proof (command + result summary),
- staging proof (video/screen + what it demonstrates),
- operator notes (what changed + known limits).

---

## 4. Context pack rule (max 5 links, always the same order)

Every packet starts with a context pack, in this order:

1. Master index: `FINAL_V8_MASTER_PLAN_2026-03-29.md`
2. Position contract (this module file)
3. Detailed plan / SSOT (section 3 Authority chain)
4. Benchmark / Softs parity evidence (section 4)
5. Dependencies and boundaries (section 2.3 + section 9 risks/decisions)

If you need more links, you are not ready — split the packet.

---

## 5. Handoff contract (producer → consumer)

Where one position depends on another, the dependency must be explicit:

- **Producer output**: what is produced (surface / behavior / payload)
- **Consumer assumption**: what is assumed
- **Version rule**: what happens when producer changes

No “soft dependency by hope”.

---

## 6. Change control (scope discipline)

- If new scope appears during work, it must be recorded as:
  - `Out-of-scope` (explicitly not in this packet), or
  - a new packet `P<NN>-X` with its own acceptance + evidence.
- Never merge scopes silently between positions (program rule).

---

## 7. Concurrency control (no parallel implementations)

Goal: prevent “parallel worlds” (duplicate entities, competing migrations, conflicting feature flags) and ensure every agent knows the **environment already exists**.

Rules:

- **Single-writer rule**: at any time, a given packet (`P<NN>-X`) has exactly one active implementer.
- **Lock required**: before starting `in progress` for a packet, create a lock file under:
  - `docs/product/work-packets/cursor-work/final_master/locks/P<NN>-<X>.md`
- **No duplicate entities**: never create a “new thing” if a canon exists (tables, enums, routes, flags, registries). Extend the canon; if unclear, stop and resolve in `P<NN>-A`.
- **No silent divergences**: every packet work must be traceable to one branch/PR and one evidence ledger row.

Lock file content (minimum):

- Packet ID, owner, branch name, start date/time, intended scope statement (1–3 bullets), links to contract and evidence ledger row.

Release rule:

- Lock is removed (or marked `released`) when the packet reaches its **terminal state**:
  - `P<NN>-A` → `approved(scope)` (scope + evidence-first artifacts written)
  - `P<NN>-B` → `delivered` (core runtime works in bounded scope; tests pass)
  - `P<NN>-C` → `verified(evidence)` (evidence ledger complete + staging proof attached)

Reference:

- Coordination details: `docs/product/work-packets/cursor-work/final_master/EXECUTION_COORDINATION.md`
- Manager gate: `docs/product/work-packets/cursor-work/final_master/NEXT_PACKET.md`

---

## 8. Evidence-first rule (tests + staging script before coding)

Before starting any `P<NN>-B` work (core runtime):

- the contract must include:
  - the exact **tests** to run (what + where),
  - a **staging proof script** (3–8 click-by-click steps),
  - the evidence ledger rows to fill.

If the tests/proof script are not written, you are still in `P<NN>-A` (scope approval), not in `P<NN>-B`.

---

## 9. Evidence ledger format (copy-paste)

Add entries to the module’s `## 10. Evidence ledger` as you verify packets.

```markdown
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| PNN-A | verified(evidence) | <link> | <command + outcome> | <video/screen link> | <1–3 bullets> |
```

