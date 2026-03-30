# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- **Parallel batch**: manager has authorized 3 packets simultaneously (all Generation surfaces with same dependencies).

---

## Authorized packet(s) — PARALLEL BATCH

### 1) P21-A — Report template-first canon + sources posture (scope approval)

Goal: freeze report as template-first deliverable with evidence pointers, degraded/no-web posture, approve(run) vs review(artifact) separation.

Dependencies: P24-A ✅, P19 ✅, P18-A ✅, P30-A ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P21-A.md`

### 2) P20-A — Deck lifecycle canon + review/export grammar (scope approval)

Goal: freeze durable deck identity + reopen/continue + review/export state + export resilience. Decks consume Templates (P24), land in Outputs (P19), carry provenance (P18).

Dependencies: P24-A ✅, P19 ✅, P18-A ✅, P30-A ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P20-A.md`

### 3) P17-A — Run grammar canon + stage separation (scope approval)

Goal: freeze one run grammar (plan→approve→run→materialize) with validation/preflight as distinct stage, approve(run) vs review(artifact) boundary, rerun/failure semantics. ArtifactRun consumes Outputs (P19), Provenance (P18), Templates (P24).

Dependencies: P24-A ✅, P19 ✅, P18-A ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P17-A.md`

---

Completion (each agent independently):

- update `EXECUTION_INDEX.md` own row → `approved(scope)`
- release own lock (`Status: released`)
- sync contract to SSOT copy
- commit + push

**Note**: If git push fails due to concurrent push, pull and retry. Each agent touches only its own contract file + one row in EXECUTION_INDEX.

## Completed (archive)

| Packet | Terminal state | Date |
|---|---|---|
| P18-A | approved(scope) | 2026-03-30 |
| P19-A/B/C | verified(evidence) | 2026-03-30 |
| P27-A | approved(scope) | 2026-03-30 |
| P30-A | approved(scope) | 2026-03-30 |
| P31-A | approved(scope) | 2026-03-30 |
| P32-A | approved(scope) | 2026-03-30 |
| P33-A | approved(scope) | 2026-03-30 |
| P24-A | approved(scope) | 2026-03-30 |
