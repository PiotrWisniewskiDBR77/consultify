# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- One packet at a time (single-writer program posture), unless manager explicitly lists multiple.

---

## Authorized packet(s)

### 1) P31-A — Settings taxonomy + ownership model (scope approval)

Goal: freeze one settings root IA (user / tenant / module scopes) + ownership/inheritance rules + impact metadata baseline. Settings must consume Organization (P30) reuse contract — no parallel "org settings" truth.

Dependencies:

- P30-A (Organization canon) — `approved(scope)` (done)
- P18-A (trust-state canon) — `approved(scope)` (done)

Lock:

- create `docs/product/work-packets/cursor-work/final_master/locks/P31-A.md`

Completion:

- update `EXECUTION_INDEX.md` #31 → `approved(scope)`
- release the lock (`Status: released`)

Notes:

- This is the next foundation block in dependency-first order (after trust/home/gov/org).
- Settings must NOT redefine org identity keys — those come from P30 reuse fields.
- Boundary with Admin (P32) and Superadmin (P33): Settings exposes preferences and module controls; operator/security writes stay in Admin/Superadmin.

## Completed (archive)

| Packet | Terminal state | Date |
|---|---|---|
| P18-A | approved(scope) | 2026-03-30 |
| P19-A/B/C | verified(evidence) | 2026-03-30 |
| P27-A | approved(scope) | 2026-03-30 |
| P30-A | approved(scope) | 2026-03-30 |
