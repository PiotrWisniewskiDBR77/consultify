# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- **Parallel batch**: manager has authorized 3 packets simultaneously (all Generation surfaces with same dependencies).

---

## Authorized packet(s) — PARALLEL BATCH

### 1) P08-A — Teresa: copilot canon + boundaries (scope approval) — REDO (previous attempt incomplete)

Goal: freeze Teresa as contextual copilot (proposal→approval→execution→audit) with P0 handoff targets, voice degraded rules, and clear boundaries vs Anna/public assistant. This packet must fill contract §2.3 canon + evidence ledger and update `EXECUTION_INDEX` #08 → `approved(scope)`.

Dependencies: P17-A ✅, P07-A ✅, foundations ✅; benchmarks: `CHAT_V8_BENCHMARK.md` + Wave2 AI OS context.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P08-A.md`

### 2) P09-A — Ankiety: collection lane canon + scope approval

Goal: freeze surveys as governed collection lane (submission status grammar + operator workflow + handoff payload to Insights), explicitly not an insight engine.

Dependencies: flow `docs/flows/core/ASSESSMENT_EXECUTION_FLOW.md` + detailed plan.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P09-A.md`

### 3) P10-A — Wnioski w Interview: insight artifact canon + scope approval

Goal: freeze insight as auditable artifact (finding/evidence/limits/next action) with confidence semantics, evidence pointers rules, and handoff payload to Initiatives.

Dependencies: readiness `docs/product/INTERVIEW_V8_READINESS_AUDIT.md` + Ankiety handoff posture (P09).

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P10-A.md`

### 8) P02-A — Kalendarz interoperability canon (scope approval) (DOCS ONLY)

Goal: freeze calendar interoperability canon (providers, time model objects, recurrence/exceptions doctrine, conflict-safe writes, permission gradients + UI rules, provider lifecycle honesty, error posture) without code changes.

Dependencies: Calendar SSOT ✅ (`docs/product/MYWORK_CALENDAR_V8_SSOT.md`), Foundations ✅

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P02-A.md`

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
| P02-A | approved(scope) | 2026-03-30 |
| P03-A | approved(scope) | 2026-03-30 |
| P05-A | approved(scope) | 2026-03-30 |
| P06-A | approved(scope) | 2026-03-30 |
