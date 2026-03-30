# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks “obvious”).
- One packet at a time (single-writer program posture), unless manager explicitly lists multiple.

---

## Authorized packet(s)

### 1) P18-A — Provenance/Review/Visibility (approved(scope))

Goal: freeze trust-state canon (payload + stage language + approve(run) ≠ review(artifact)).

Dependencies:

- none (foundation packet)

Lock:

- create `docs/product/work-packets/cursor-work/final_master/locks/P18-A.md`

Completion:

- update `EXECUTION_INDEX.md` #18 → `approved(scope)`
- release the lock (`Status: released`)

Notes:

- Outputs Library (#19) is already progressing in runtime; P18-A must be shipped next to make the trust-state dependency explicit and prevent drift.

