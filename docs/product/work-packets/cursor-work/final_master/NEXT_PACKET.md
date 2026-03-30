# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks “obvious”).
- One packet at a time (single-writer program posture), unless manager explicitly lists multiple.

---

## Authorized packet(s)

### 1) P30-A — Organization (approved(scope))

Goal: freeze one tenant truth + reuse contract (profile/defaults/trust) that downstream modules must consume (no parallel org truth).

Dependencies:

- P18-A (trust-state canon) should be `approved(scope)` (now done)

Lock:

- create `docs/product/work-packets/cursor-work/final_master/locks/P30-A.md`

Completion:

- update `EXECUTION_INDEX.md` #30 → `approved(scope)`
- release the lock (`Status: released`)

Notes:

- This is the next foundation block in dependency-first order (after trust/home/gov).

