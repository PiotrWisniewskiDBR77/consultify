# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- **Parallel batch**: manager has authorized 3 packets simultaneously (all Generation surfaces with same dependencies).

---

## Authorized packet(s) — PARALLEL BATCH

### 1) P03-A — Wdrożenia: control tower canon + write-truth boundaries (scope approval)

Goal: freeze operator-grade execution control tower (queues + drill-down + interventions) with explicit one-truth rules (no split-brain) and bounded dependency/blast-radius vocabulary.

Dependencies: P11-A ✅ (approved(scope) recommended), Foundations ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P03-A.md`

### 2) P05-A — Finanse: finance lane canon + scope approval

Goal: freeze bounded consequence-management lane (import→analysis→mutation→readback) with KPI↔Finance coherence, versioning semantics, and import/mutation error taxonomy (no silent corruption).

Dependencies: Results linkage SSOT ✅, Foundations ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P05-A.md`

### 3) P06-A — Radar: prioritization grammar + handoff canon (scope approval)

Goal: freeze ranking grammar + “why-now” payload contract (rationale/evidence/uncertainty) and handoff payloads to downstream modules (Initiatives/Execution/Notes).

Dependencies: Radar SSOT ✅, Foundations ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P06-A.md`

### 6) P05-A — Finance lane canon + scope approval (DOCS ONLY)

Goal: freeze bounded finance lanes (import→analysis→mutation→readback), KPI↔Finance coherence boundary, versioning semantics (current vs actual), error taxonomy + recovery posture, anti-duplicate gate, and degraded modes.

Dependencies: P04-A ✅ (approved(scope)), Finance SSOT ✅, KPI↔Finance linkage SSOT ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P05-A.md`

### 7) P06-A — Radar canon + prioritization grammar (DOCS ONLY)

Goal: freeze Radar ranking/prioritization grammar + “why-now” payload contract + handoff payload to `Inicjatywy`/`Wdrożenia`/`Notatki` + degraded/error posture + anti-duplicate gate.

Dependencies: Radar SSOT ✅ (`docs/product/MYWORK_RADAR_V8_SSOT.md`)

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P06-A.md`

---

Completion (each agent independently):

- update `EXECUTION_INDEX.md` own row → `approved(scope)`
- release own lock (`Status: released`)
- sync contract to SSOT copy
- commit + push

**Note**: If git push fails due to concurrent push, run `git pull --rebase` and retry. Each agent touches only its own contract file + one row in EXECUTION_INDEX.

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
| P17-A | approved(scope) | 2026-03-30 |
| P20-A | approved(scope) | 2026-03-30 |
| P21-A | approved(scope) | 2026-03-30 |
| P11-A | approved(scope) | 2026-03-30 |
| P04-A | approved(scope) | 2026-03-30 |
