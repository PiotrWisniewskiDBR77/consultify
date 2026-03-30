# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- **Parallel batch**: manager has authorized 3 packets simultaneously (all Generation surfaces with same dependencies).

---

## Authorized packet(s) — PARALLEL BATCH

### 1) P01-A — Integracja: control-plane canon + object model (scope approval)

Goal: freeze the operator-grade integration control plane: explicit object model (provider/connection/workflow/run), lifecycle grammar, and recovery states (connect → complete → monitor → recover).

Dependencies: benchmark + readiness SSOT (`SYNC_PLATFORM_BENCHMARK_V8.md`, `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`)

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P01-A.md`

### 2) P07-A — Notatnik: notebook canon + scope approval

Goal: freeze notebook as durable working memory (capture + search + linking + attachments lifecycle) with explicit provenance language and bounded downstream handoffs.

Dependencies: `NOTATKA_V8_SSOT.md` + benchmark (`NOTATKA_V8_BENCHMARK.md`)

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P07-A.md`

### 3) P08-A — Teresa: copilot canon + boundaries (scope approval)

Goal: freeze Teresa as contextual copilot (proposal→approval→execution→audit) with P0 handoff targets, voice degraded rules, and clear boundaries vs Anna/public assistant.

Dependencies: chat benchmark + Wave2 AI OS context (`CHAT_V8_BENCHMARK.md`, `WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`)

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P08-A.md`

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
