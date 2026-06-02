# FINAL IMPLEMENTATION PLAN 24 — Tabele (Table Studio) Lane Foundation

**Plan ID:** `FIP-24-TABELE`
**Created:** 2026-05-07
**Status:** `PLANNED — pending D1/D2/D3`
**Owner:** Planning & Delivery Agent (orchestrator) + 4 parallel subagents (A/B/C/D)
**Block ID:** `TABLE_STUDIO_FOUNDATION_BLOCK`
**Work packet:** `DRD/consultify/docs/product/work-packets/table-studio-foundation/`

> This is the lane SSOT. All execution detail lives in the work packet. This file is the long-form narrative that anchors the block in product/architecture context — analogous to `FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE_2026-03-29.md`.

---

## 1. Vision

Stand up the **Tabele (Table Studio)** artifact lane in Consultify so the user can converse with an AI in a Word-style document canvas to generate, govern, and operate relational tables. The user experience mirrors `/wordy` (chat ↔ document preview) but produces a real, materialized Table Platform `tableId` whose Word-canvas surface visualizes:

- **Cover header** — title, subtitle, autosave dot.
- **KPI strip** — Rows / Columns / Status / Format.
- **Schema section** — Word-paragraph idiom for each field, with governance state pill (committed / proposed / rejected).
- **Records section** — first 25 rows as a clean read-only table.
- **Relations section** — chips with explainability tooltip (calls new `/relations/explain` endpoint).
- **AI Rationale section** — summary paragraph + bullets + cited sources + governance proposal status.

Every AI-driven schema mutation goes through the existing **`proposal → approval → execution → audit`** pipeline (`ChatToSchemaService`). The canvas surfaces governance state honestly. No silent execution. No hidden learning.

## 2. Why now

- Wordy / Excele / Prezentacje lanes ship this quarter; Tabele is the gap that distinguishes Consultify from "another AI document generator" by producing **operational structures**, not just one-shot files.
- `TABLE_V8_SSOT.md` and `TABLE_MISSING_CAPABILITIES_MATRIX_V8.md` flag "schema governance lane integration" + "relation explainability surface" as MISSING.
- Sprint 0 preflight (2026-05-07) discovered that the backend pipeline is already in place — only the frontend lane and one new backend endpoint remain.

## 3. Scope (one-line summary)

Build the Tabele lane as the **frontend mirror** of Wordy/Excele/Prezentacje, **reuse** the existing schema-governance backend, **add** one missing backend capability (relation explainability), **deep-link** to the existing Table Builder, **leave** all out-of-scope files untouched.

Detailed scope: `work-packets/table-studio-foundation/00_TASK_PACKET.md`.

## 4. Architecture

```
                        ┌────────────────────────────────────────────────────────┐
                        │  /tabele                                                │
                        │  ┌──────────────────────────────────────────────┐      │
                        │  │  ArtifactModuleHome (lane=tabele, accent=sky) │      │
                        │  │   └── 8 builtin templates                     │      │
                        │  └─────────────────┬────────────────────────────┘      │
                        │                    │ Start new                          │
                        │                    ▼                                    │
                        │  ┌──────────────────────────────────────────────┐      │
                        │  │  KimiWorkspaceShell  (lane=tabele)            │      │
                        │  │   ┌──────────────┬──────────────────────┐    │      │
                        │  │   │ ChatPanel    │ TabelePreviewLayout   │    │      │
                        │  │   │ (left)       │  - Cover              │    │      │
                        │  │   │ system_prompt│  - KPI strip          │    │      │
                        │  │   │ = TABELE_*   │  - Schema section     │    │      │
                        │  │   │              │  - Records section    │    │      │
                        │  │   │              │  - Relations chips    │    │      │
                        │  │   │              │  - Rationale section  │    │      │
                        │  │   └──────────────┴──────────────────────┘    │      │
                        │  │   Header right-slot (Menu 3):                 │      │
                        │  │    [Open in Builder] [Download CSV] [Stop]    │      │
                        │  └──────────────────────────────────────────────┘      │
                        └────────────────────────┬───────────────────────────────┘
                                                 │ Open in Builder
                                                 ▼
                        ┌────────────────────────────────────────────────────────┐
                        │  /my-work/sheets/:workspaceId/tables/:tableId          │
                        │   (existing surface — untouched in this block)         │
                        └────────────────────────────────────────────────────────┘
```

### Backend slice

```
Frontend (TabeleView)                         Backend
   │                                            │
   ├─ propose schema  ──────────────────────►  POST /api/table-platform/schema/proposals             [ChatToSchemaService — EXISTING]
   ├─ execute proposal ─────────────────────►  POST /api/table-platform/schema/proposals/:id/execute [ChatToSchemaService — EXISTING]
   ├─ list proposals  ──────────────────────►  GET  /api/table-platform/workspaces/:id/schema/proposals
   ├─ get table       ──────────────────────►  GET  /api/table-platform/tables/:id                   [tablePlatformRoutes — EXISTING]
   ├─ list records    ──────────────────────►  GET  /api/table-platform/tables/:id/records          [tablePlatformRoutes — EXISTING]
   └─ explain relation ────────────────────►  GET  /api/table-platform/tables/:id/records/:rid/relations/explain
                                               └── RelationExplainabilityService                    [NEW — this block, only new piece]
```

## 5. Pillars (mapped to epics)

| # | Pillar | Epic | Sprint | Owner |
|---|---|---|---|---|
| P1 | Frontend lane parity (peer of Wordy/Excele/Prezentacje) | EPIC-1 | S2 | Agent B |
| P2 | Word-canvas preview (sectioned document idiom) | EPIC-2 | S3 | Agent C |
| P3 | Backend relation explainability + ACL audit | EPIC-3 | S1 | Agent A |
| P4 | Integration: orchestrator + intent routing + i18n + a11y + e2e | EPIC-4 | S4, S5 | Agent D + orchestrator |

## 6. Execution topology

```
Wave 0   (orchestrator)              Sprint 0 — Preflight                         [DONE]
Wave 0.5 (orchestrator)              Sprint 0.5 — Documentation                   [IN PROGRESS]
Wave 1   (Agent A ‖ Agent B)         Sprint 1 (backend) ‖ Sprint 2 (scaffold)
Wave 2   (Agent C ‖ Agent D)         Sprint 3 (preview) ‖ Sprint 4 (orchestrator)
Wave 3   (orchestrator)              Sprint 5 — Intent routing + i18n + a11y + e2e
Wave 4   (orchestrator)              Sprint 6 — Validation matrix run
Wave 5   (orchestrator)              Sprint 7 — Closeout
```

Each wave has a binary gate: `PASS` / `PASS_WITH_P2` / `BLOCKED_P1`. No wave starts until previous wave is GREEN.

## 7. Decisions surfaced

These three decisions are open and must be confirmed before Wave 1 starts. Working assumptions are listed; closeout records the actual decision.

| ID | Question | Working assumption | Closeout outcome |
|---|---|---|---|
| D1 | `/tabele` route target — `<TabeleView />` (visible) vs `<V4ComingSoonView />` (consistent with siblings)? | `<TabeleView />` direct — make the lane usable | _to fill_ |
| D2 | Backend scope — reuse existing `ChatToSchemaService` + `AuditService` vs build duplicate `SchemaGovernanceService` + `TableMutationAuditService`? | REUSE — Sprint 0 preflight confirmed existing services cover the entire pipeline | _to fill_ |
| D3 | ACL audit handling — STOP-and-file-P0 if leak found vs in-block patch (would expand scope)? | STOP-and-file-P0; do not patch in this block | _to fill_ |

## 8. Block invariants

These apply to every file changed in this block.

1. **Governance:** `proposal → approval → execution → audit`. No silent execution.
2. **Tenant safety:** every backend endpoint resolves `tenant_id` from auth context; cross-tenant returns 403.
3. **ACL filter:** `relations/explain` excludes records the actor cannot read.
4. **No unrelated refactors:** files-explicitly-untouched list (in `00_TASK_PACKET.md` §4) shows zero diff.
5. **Menu 3 placement:** AI buttons live only in `KimiWorkspaceShell` header right-slot.
6. **DBR77 monochrome:** no off-palette hex literals in new components.
7. **i18n:** every visible string has an EN + PL key.
8. **A11y:** keyboard nav + aria + reduced-motion + dark-mode contrast.
9. **No new DB migration in this block.**
10. **All changes additive; rollback = revert PR + feature flag.**

## 9. Validation gate (high-level)

Full matrix in `01_VALIDATION_MATRIX.md`. Top-level criteria:

- L1: lint + typecheck + DBR77 hex scan + untouched-files guard.
- L2: unit (frontend + backend) — including 4-lane regression test for `useKimiArtifactPipeline`.
- L3: component (`TabeleView`, `KimiWorkspaceShell`, `ArtifactModuleHome`, `TabelePreviewLayout`).
- L4: integration (relations/explain happy path, cross-tenant 403, ACL filter, schema-proposals ACL audit READ-ONLY).
- L5: e2e smoke (5 scenarios on `/tabele`).
- L6: manual / Anygravity (P0 trial; DBR77 visual; Menu 3 audit; Wordy ↔ Tabele parity).
- L7: security (tenant scope, no silent execution, prompt injection guard, ACL filter).
- L8: perf (relations/explain p95 < 500 ms; preview render < 100 ms).

## 10. Risk register (high-level)

Full register in `02_RISK_REGISTER.md`. Severity-weighted top risks:

- **P0** — T4 (existing governance routes leak proposals across tenants). Mitigated by Sprint 1 ACL audit.
- **P0** — S2 (auto-approve hidden writes). Mitigated by hard "no auto-execute" rule + L7.2 review.
- **P1** — T1 (KimiLane union breaks switches). Mitigated by `tsc --noEmit` + 4-lane regression test.
- **P1** — P1 (Excele vs Tabele user confusion). Mitigated by sky vs emerald accent + distinct labels.
- **P1** — P5 (canvas idiom diverges from Wordy). Mitigated by side-by-side parity screenshot in Sprint 6.
- **P1** — S1 (cross-tenant proposal listing). Mitigated by Sprint 1 audit.
- **P1** — S4 (relations/explain exposes ACL records). Mitigated by `explain()` filter + integration test.

## 11. Rollback strategy

- **Tier 1** (no revert): set `featureTabeleLaneEnabled=false`. Sidebar entry, route, lane home all hidden.
- **Tier 2**: comment out the single `app.use(...)` line for the new route in `server/src/index.ts`.
- **Tier 3**: full PR revert. All changes additive; no DB migration.
- **Tier 4**: hot patch path within same business day for any post-merge P0.

## 12. Out-of-scope guardrails

- No formula engine, automation engine, computed columns.
- No real-time presence / CRDT.
- No new icon library (reuse `lucide-react`).
- No edits to `MyWork/table/*`, `WordyView`, `ExceleView`, `PrezentacjeView`, `ReportsAndPresentations/*`, `ChatToSchemaService`, `AuditService`, `TableContextService`, `RelationService`, `routes/table-platform.routes.ts`.
- No new DB migration.
- No `SchemaGovernanceService` / `TableMutationAuditService` duplicates (existing services cover it).
- No persistent caching for relation-explain results in this block (deferred to TBL-FU-1).
- No proposal-review UI inside the canvas (only status pill + link to existing review surface).

## 13. Cross-block follow-ups (next blocks)

- **TBL-FU-1** Persistence backing for `RelationExplainabilityService` reasoning cache.
- **TBL-FU-2** Promote ACL audit findings to a dedicated security block (only if L4.4 finds a leak).
- **TBL-FU-3** Productionize `/wordy`, `/excele`, `/prezentacje` (today they show `V4ComingSoonView`). Symmetry with Tabele worth tracking.
- **TBL-FU-4** Schema proposal "Review queue" UI inside the Tabele canvas.
- **TBL-FU-5** Computed columns / formula engine / automation engine for Tabele lane.

## 14. Cross-references

- `consultify/docs/product/TABLE_V8_SSOT.md` — table platform SSOT.
- `consultify/docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md` — relational schema + docs workflow.
- `consultify/docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md` — capabilities matrix.
- `consultify/docs/product/CANVAS_SOURCE_OF_TRUTH.md` — canvas SSOT.
- `consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` — UI standard.
- `consultify/docs/ui-standards/00-foundation/color-system.md` — DBR77 tokens.
- `DRD/ROLE_PERMISSIONS_WORKFLOW_SOURCE_OF_TRUTH.md` — roles/permissions.
- `DRD/UI_UX_SOURCE_OF_TRUTH.md` — UI gateway.
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` — testing OS.
- `.cursor/CONSULTIFY_AI_DELIVERY_OS.md` — delivery OS.
- `.cursor/OPUS47_DELIVERY_PROCEDURE.md` — delivery procedure.

## 15. Sign-off

- Block lead: ___ (waiting for D1/D2/D3 confirmation)
- UI/UX reviewer: ___
- Security reviewer: ___
- QA reviewer: ___
- Date approved: ___
- Date closed: ___
