# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- One packet at a time (single-writer program posture), unless manager explicitly lists multiple.

---

## Authorized packet(s)

### 1) P24-A — Template runtime canon + ownership/permissions (scope approval)

Goal: freeze template-as-runtime-contract (structure + defaults + rules) with explicit ownership (user / org / app), publish/review gate, and family convergence for report + deck templates. Templates live in Outputs (P19) and consume foundation (P18 provenance, P27 tools, P30 org).

Dependencies:

- P19-A/B/C (Outputs Library) — `verified(evidence)` (done)
- P18-A (Provenance/trust) — `approved(scope)` (done)
- P27-A (Tools) — `approved(scope)` (done)
- P30-A (Organization) — `approved(scope)` (done)

Lock:

- create `docs/product/work-packets/cursor-work/final_master/locks/P24-A.md`

Completion:

- update `EXECUTION_INDEX.md` #24 → `approved(scope)`
- release the lock (`Status: released`)

Notes:

- Templates land in Outputs Library (P19) — no parallel "template store" outside Outputs.
- Template publish must be governed (review payload, no silent publish).
- Org branding defaults come from P30 reuse fields (ResolvedOrganizationContext.profile).
- This is the first Generation surface packet — starts the consumer wave.

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
