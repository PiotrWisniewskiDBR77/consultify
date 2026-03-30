# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- One packet at a time (single-writer program posture), unless manager explicitly lists multiple.

---

## Authorized packet(s)

### 1) P21-A — Report template-first canon + sources posture (scope approval)

Goal: freeze report as a template-first deliverable artifact with evidence pointers (sources/citations), degraded/no-web posture, and clear separation of approve(run) vs review(artifact). Reports consume Templates (P24), land in Outputs (P19), carry provenance (P18).

Dependencies:

- P24-A (Templates canon) — `approved(scope)` (done)
- P19-A/B/C (Outputs Library) — `verified(evidence)` (done)
- P18-A (Provenance/trust) — `approved(scope)` (done)
- P30-A (Organization) — `approved(scope)` (done)

Lock:

- create `docs/product/work-packets/cursor-work/final_master/locks/P21-A.md`

Completion:

- update `EXECUTION_INDEX.md` #21 → `approved(scope)`
- release the lock (`Status: released`)

Notes:

- Reports are a product lane (not "documents in general") — template-first, governed, with sources posture.
- Reports ≠ Wordy (P22) — Wordy is KIMI net-new; Reports is template-driven deliverable.
- No "full report builder" — scope is template→generate→artifact→library→continue→export.

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
