# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet unless it is listed below.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- **Open docs mode**: manager has authorized **all remaining PNN-A (scope)** packets so documentation agents don’t block on the gate.
- **Coding is still gated**: `P<NN>-B` / `P<NN>-C` remain manager-authorized one-by-one.

---

## Authorized packet(s) — OPEN DOCS MODE (PNN-A only)

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

### 4) P12-A — Mindmap: calm interaction canon + scope approval (DOCS ONLY)

Goal: freeze mindmap core-loop canon (minimal toolbelt, branch-state semantics, undo/redo posture, export/readback baseline, AI co-building contract, degraded posture) and update evidence + index.

Dependencies: `docs/product/MINDMAP_V8_READINESS_AUDIT.md` + plan `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md`.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P12-A.md`

### 5) P13-A — Whiteboard: board canon + toolbelt baseline (DOCS ONLY)

Goal: freeze whiteboard operator-safe toolbelt + facilitation baseline + export/readback assumptions + AI co-building proposal contract (preview/apply/reject), with explicit non-goals (no Miro parity).

Dependencies: wave1 plan + readiness/SSOT as referenced in contract.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P13-A.md`

### 6) P15-A — Tabele: singular relational grammar (DOCS ONLY)

Goal: freeze one relational grammar (schema→records→relations→views→forms/interfaces) + permissions/lock semantics + schema drift posture + AI plan→preview/diff→approve→materialize contract (no silent writes).

Dependencies: benchmark `docs/strategy/TABELE_V8_BENCHMARK.md` + wave1 plan.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P15-A.md`

### 7) P14-A — Proces flow: semantics + interoperability posture (DOCS ONLY)

Goal: freeze process semantics (typed objects + meaning) + BPMN-adjacent mapping posture + export/import assumptions + validation layering (semantic-first).

Dependencies: wave1 plan + readiness/SSOT as referenced in contract.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P14-A.md`

### 8) P16-A — Anna: public assistant canon + boundaries (DOCS ONLY)

Goal: freeze public assistant contract (public boundaries, CTA funnel events, citations/uncertainty, voice/memory degraded rules) explicitly separate from Teresa.

Dependencies: `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` + `docs/product/CHAT_V8_BENCHMARK.md`

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P16-A.md`

### 9) P22-A — Wordy: KIMI-style docs lane evidence mapping (DOCS ONLY)

Goal: freeze Wordy’s net-new lane scope (KIMI-style) with explicit missing-input flags where needed; define evidence mapping before any runtime.

Dependencies: KIMI references + internal program doctrine (no guessing).

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P22-A.md`

### 10) P23-A — Excele: KIMI-style sheets lane evidence mapping (DOCS ONLY)

Goal: freeze Excele’s net-new lane scope (KIMI-style) with explicit missing-input flags where needed; define evidence mapping before any runtime.

Dependencies: KIMI references + internal program doctrine (no guessing).

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P23-A.md`

### 11) P25-A — Help: contextual help canon + content ops baseline (DOCS ONLY)

Goal: freeze contextual help as runtime product (entry points, routing, PL/EN fallback) + content ops baseline + recommendation payload contract for Anna/Teresa.

Dependencies: Wave2 help/KB plan + KB templates.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P25-A.md`

### 12) P26-A — Baza wiedzy: KB canon + taxonomy + content ops (DOCS ONLY)

Goal: freeze KB as curated knowledge system (taxonomy, search/discovery posture, ingestion rules, governance) integrated with Help and AI grounding.

Dependencies: Wave2 help/KB plan.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P26-A.md`

### 13) P28-A — Assessment: assessment lane canon + governance (DOCS ONLY)

Goal: freeze assessment lane scope, artifact model, governance and handoffs (bounded).

Dependencies: wave plans + existing flow docs as referenced in contract.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P28-A.md`

### 14) P29-A — Program partnerski: partner lifecycle canon + ledger boundaries (DOCS ONLY)

Goal: freeze partner program lifecycle + earnings/ledger semantics + governance boundaries (bounded).

Dependencies: Org/Settings/Admin foundations.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P29-A.md`

### 15) P34-A — Mądrość czata: policy gateway canon + boundaries (DOCS ONLY)

Goal: freeze chat wisdom/policy gateway (what is allowed, how refusals/citations work, governance) before chat history/search.

Dependencies: governance foundations + chat benchmarks.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P34-A.md`

### 16) P35-A — Historia czatów: history/library canon + retrieval boundaries (DOCS ONLY)

Goal: freeze chat history library + retrieval/search posture with governance boundaries and anti-duplicate gates.

Dependencies: P34 wisdom gateway recommended first.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P35-A.md`

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
