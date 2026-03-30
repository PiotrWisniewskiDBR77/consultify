# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- One packet at a time (single-writer program posture), unless manager explicitly lists multiple.

---

## Authorized packet(s)

### 1) P32-A — Admin cockpit canon + core IA (scope approval)

Goal: freeze one tenant operator cockpit (members/roles + integrations/sync oversight) with explicit boundaries vs Organization (P30), Settings (P31), and Superadmin (P33). No parallel "admin truth" — consume P30 org canon and P31 settings taxonomy.

Dependencies:

- P30-A (Organization canon) — `approved(scope)` (done)
- P31-A (Settings taxonomy) — `approved(scope)` (done)
- P18-A (trust-state canon) — `approved(scope)` (done)

Lock:

- create `docs/product/work-packets/cursor-work/final_master/locks/P32-A.md`

Completion:

- update `EXECUTION_INDEX.md` #32 → `approved(scope)`
- release the lock (`Status: released`)

Notes:

- Admin owns: team membership, role assignment, integration/sync oversight, security policy writes (MFA/SSO/session/password).
- Admin does NOT own: org identity (P30), personal/module preferences (P31), cross-tenant platform ops (P33).
- Settings (P31) §2.3.5 explicitly routes security/collaboration writes to Admin — Admin must define those write surfaces.

## Completed (archive)

| Packet | Terminal state | Date |
|---|---|---|
| P18-A | approved(scope) | 2026-03-30 |
| P19-A/B/C | verified(evidence) | 2026-03-30 |
| P27-A | approved(scope) | 2026-03-30 |
| P30-A | approved(scope) | 2026-03-30 |
| P31-A | approved(scope) | 2026-03-30 |
