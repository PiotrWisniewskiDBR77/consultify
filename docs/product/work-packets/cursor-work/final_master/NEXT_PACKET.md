# Final V8 — NEXT PACKET (manager gate)

This file is the **only** authority for what any execution agent is allowed to start **right now**.

Rules:

- Agents **must not self-select** a packet unless it is listed below.
- If a packet is not listed here, it is **not authorized** to start (even if it looks "obvious").
- Scope/docs packets are **closed by default**. Re-open `P<NN>-A` only with an explicit manager entry below.
- `P<NN>-B` / `P<NN>-C` remain gated and must appear in the runtime section below.

---

## Scope/docs phase

All broad `P<NN>-A` documentation packets are treated as **closed for manager-gate purposes**.

If a scope packet truly needs a redo, re-open it explicitly here with a fresh manager note. Until then, agents should assume docs work is frozen and move only through runtime (`B` / `C`) packets.

---

## Authorized packet(s) — RUNTIME (PNN-B/PNN-C only)

### 1) P35-B — Historia czatów: lifecycle + search target closure (core runtime)

Goal: deliver full thread lifecycle + server-side search target with pagination/filters + team folder permission denials (no leakage), with integration/security tests + staging demo.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P35-B.md`

### 2) P20-B — Prezentacje: Gamma-style split-screen deck generation + preview + export (core runtime)

Goal: deliver KIMI-style split-screen chat↔deck workflow: generate deck from chat (step-by-step with task progress), preview (live deck cards), export PDF/PPTX, reopen from Outputs Library. Reuse existing `KimiWorkspaceShell` + `useKimiArtifactPipeline` + `presentationGeneratorService` + `DeckBuilder` components. Integrate with P18 (provenance), P19 (Outputs Library), P24 (templates). No silent apply.

Lock: `docs/product/work-packets/cursor-work/final_master/locks/P20-B.md`

*(P22-C and P23-C completed — see archive below)*

---

Completion (each agent independently):

- update own contract ledger/evidence row
- update `EXECUTION_INDEX.md` own row to the packet terminal state:
  - `P<NN>-A` → `approved(scope)`
  - `P<NN>-B` → `delivered`
  - `P<NN>-C` → `verified(evidence)`
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
| P17-B | delivered | 2026-03-30 |
| P18-B | delivered | 2026-03-30 |
| P20-A | approved(scope) | 2026-03-30 |
| P21-A | approved(scope) | 2026-03-30 |
| P21-B | delivered | 2026-03-30 |
| P11-A | approved(scope) | 2026-03-30 |
| P04-A | approved(scope) | 2026-03-30 |
| P02-A | approved(scope) | 2026-03-30 |
| P03-A | approved(scope) | 2026-03-30 |
| P05-A | approved(scope) | 2026-03-30 |
| P06-A | approved(scope) | 2026-03-30 |
| P16-B | delivered | 2026-03-30 |
| P16-C | verified(evidence) | 2026-03-31 |
| P17-C | verified(evidence) | 2026-03-31 |
| P18-C | verified(evidence) | 2026-03-31 |
| P21-C | verified(evidence) | 2026-03-31 |
| P24-B | delivered | 2026-03-30 |
| P24-C | verified(evidence) | 2026-03-31 |
| P25-B | delivered | 2026-03-30 |
| P34-B | delivered | 2026-03-30 |
| P25-C | verified(evidence) | 2026-03-31 |
| P34-C | verified(evidence) | 2026-03-31 |
| P22-B | delivered | 2026-03-31 |
| P23-B | delivered | 2026-03-31 |
| P22-C | verified(evidence) | 2026-03-31 |
| P23-C | verified(evidence) | 2026-03-31 |
| P20-B | delivered | 2026-03-31 |
