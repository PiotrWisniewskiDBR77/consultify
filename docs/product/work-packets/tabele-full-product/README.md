# Table Studio Full Product Program

**Program ID:** `TABELE_FULL_PRODUCT_PROGRAM`
**Status:** `APPROVED — CTO decisions locked 2026-05-07`
**Owner:** Cursor agent (CTO mode) per user delegation
**Lane SSOT:** `DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`
**Spec source:** user prompt 2026-05-07 "Consultify Table Studio / Airtable Artifact Engine"

---

## Why this program exists

The Table Studio Foundation Block (closed `GO` on 2026-05-07) delivered the Tabele artifact lane, Word-canvas preview, RelationExplainability, materialization to Table Platform, and a P0 ACL fix. That covered approximately 60–65 % of the full Consultify Table Studio product specification. This program closes the remaining ~35–40 % via four sequenced/parallelized work packets, ten epics, and approximately 32 sprints.

The Foundation Block is reused, not redone. No work in this program touches the Foundation Block deliverables except as additive integration points.

---

## Program structure

```
tabele-full-product/
├── README.md                              ← this file
├── 00_CTO_DECISIONS.md                    ← locked program-level decisions
├── 01_MASTER_ROADMAP.md                   ← timeline, parallelization, milestones
├── 02_DEPENDENCIES_GRAPH.md               ← cross-block dependencies
├── 03_PROGRAM_RISK_REGISTER.md            ← cross-block risks
├── block-A-template-catalog/              ← parallel with B
├── block-B-record-provenance/             ← parallel with A
├── block-C-ai-operator/                   ← waits for A and B
└── block-D-integration-evidence/          ← waits for A, B, C
```

Each block follows the established Foundation-Block template:
- `00_TASK_PACKET.md` (per `.cursor/TASK_PACKET_TEMPLATE.md`)
- `01_VALIDATION_MATRIX.md` (8 layers per `.cursor/SPRINT_GATE_CHECKLIST.md`)
- `02_RISK_REGISTER.md`
- `03_BLOCK_CLOSEOUT.md` (skeleton, filled at block exit)
- `epics/EPIC-T*.md`
- `sprints/SPRINT_0..7.md`

## Block summary

| Block | Title | Epics | Duration | Dependencies |
|---|---|---|---|---|
| **A** | Template Catalog **+ MELS adoption** | EPIC-T5, T6, T7, **T16** | ~7 sprints | Foundation Block (DONE) |
| **B** | Record Provenance | EPIC-T8, T9 | ~7 sprints | Foundation Block (DONE) |
| **C** | AI Operator | EPIC-T10, T11, T12 | ~8 sprints | Blocks A and B (gate) |
| **D** | Integration & Evidence | EPIC-T13, T14, T15 | ~7 sprints | Blocks A, B, C (gate) |

Total: 11 epics, ~32 sprints, ~3 calendar weeks at 4-agent topology.

> **EPIC-T16 (Module Executive Layout Standard — Tabele lane)** was added 2026-05-08 per CTO directive. The standard itself lives at `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md`. Wordy and Prezentacje migration to MELS is queued for a separate follow-up program (`executive-layout-unification`).

---

## Reading order

1. `00_CTO_DECISIONS.md` — what is locked and why.
2. `01_MASTER_ROADMAP.md` — when each block runs.
3. `02_DEPENDENCIES_GRAPH.md` — what blocks need what.
4. `03_PROGRAM_RISK_REGISTER.md` — top program-level risks.
5. Then dive into the block of current focus.

---

## Governance

This program operates under the same invariants as the Foundation Block:

- **Scope-lock per packet.** Adding new requirements during execution requires a new packet, not in-flight scope expansion.
- **Governance invariant.** Every AI-driven mutation of schema or data goes through `proposal → approval → execution → audit`. No silent execution.
- **Tenant invariant.** Every new endpoint has a cross-tenant 403 test. Cross-tenant audits are mandatory at L4 of validation.
- **Reuse-first.** New code only where the existing Table Platform (64 services / 250+ endpoints) does not already cover the requirement.
- **Honest degraded UI.** No false-success previews; no phantom artifacts. Foundation Block already enforces this for tabele lane.

---

## Cross-references

- Foundation Block closeout: `DRD/consultify/docs/product/work-packets/table-studio-foundation/03_BLOCK_CLOSEOUT.md`
- Lane SSOT: `DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`
- Repo structure: `.cursor/REPO_STRUCTURE_AND_CLASSIFICATION.md`
- Source-of-truth index: `.cursor/SOURCE_OF_TRUTH_INDEX.md`
