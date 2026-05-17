# Master Roadmap — Table Studio Full Product Program

**Program ID:** `TABELE_FULL_PRODUCT_PROGRAM`
**Status:** `APPROVED — execution pending user GO`
**Total duration:** ~3 calendar weeks at 4-agent topology (Agent A backend, Agent B frontend, Agent C integration/migrations/i18n, Agent D QA/evidence/closeout).

---

## Phase plan

```
Week 1 (Days 1–5):   Block A ‖ Block B  (parallel start)
Week 2 (Days 6–10):  Block A ‖ Block B  (continue)
Day 10: Barrier — both A and B must close GO.
Week 2–3 (Days 11–15): Block C
Week 3 (Days 16–20): Block D + Final program closeout
```

---

## Block-by-block timeline

### Block A — Template Catalog (Days 1–10)

| Sprint | Day | Deliverable | Lead |
|---|---|---|---|
| S0 Preflight | 1 | Existing `TemplateService` audit + reuse decision | Orchestrator |
| S1 Lifecycle backend | 2 | `template.status/version/owner` + endpoints | Agent A |
| S2 Templates seed | 3–4 | 30 schema_snapshots + seeder + Anygravity P0 trial #1 | Agent A + Orchestrator |
| S3 Field types backend | 5 | `risk_score`, `priority`, `ai_generated_summary`, `ai_classification`, `source_reference` | Agent A |
| S4 Lifecycle frontend | 6–7 | Template lifecycle UI + filter | Agent B |
| S5 Field types frontend | 7–8 | Cell renderers + editors for new types | Agent B |
| S6 QA gate | 9 | Full L1–L8 validation matrix | Agent D |
| S7 Closeout | 10 | `03_BLOCK_CLOSEOUT.md` filled, follow-ups filed | Orchestrator |

### Block B — Record Provenance (Days 1–10, parallel with A)

| Sprint | Day | Deliverable | Lead |
|---|---|---|---|
| S0 Preflight | 1 | DB migration plan review + rollback rehearsal | Orchestrator |
| S1 DB migration | 2 | `tp_record_sources` + `tp_records.confidence_score`/`validation_status` | Agent C |
| S2 Provenance API | 3–4 | `POST/GET/DELETE /records/:id/sources` + tests | Agent A |
| S3 Confidence algorithm | 5–6 | Score computation + recompute hook + audit | Agent A |
| S4 Grid UI | 7 | Source popover + confidence bar + validation badge | Agent B |
| S5 Tabele lane integration | 8 | `TabelePreviewLayout` records section gets source/confidence | Agent C |
| S6 QA gate | 9 | Cross-tenant ACL + perf 50 k records + regression | Agent D |
| S7 Closeout | 10 | Closeout filled, follow-ups filed | Orchestrator |

### Barrier Gate (Day 10)

Both A and B must report `GO` (not `GO_WITH_CONSTRAINTS`) before C can start. If either is `GO_WITH_CONSTRAINTS`, run a focused fix-up sprint (max 2 days) before opening C.

### Block C — AI Operator (Days 11–17)

| Sprint | Day | Deliverable | Lead |
|---|---|---|---|
| S0 Preflight | 11 | Token budget calibration + LLM cost analysis | Orchestrator |
| S1 AI Editor skeleton | 11 | `TableAiEditorService` + 8 method stubs + proposal contract | Agent A |
| S2 Levels 1–4 | 12 | cell / record / column / structure | Agent A |
| S3 Levels 5–8 | 13 | view / relational / methodological / source | Agent A |
| S4 QA Engine backend | 14 | `TableQaService` + `tp_qa_reports` | Agent A |
| S5 AI Editor + QA frontend | 15 | `TabeleAiEditorPanel` + `TabeleQaPanel` + diff preview | Agent B |
| S6 Source Pack Builder | 16 | `TabeleSourcePackPanel` + V8 snapshot integration | Agent C |
| S7 QA + Closeout | 17 | Validation + closeout | Agent D + Orchestrator |

### Block D — Integration & Evidence (Days 18–21)

| Sprint | Day | Deliverable | Lead |
|---|---|---|---|
| S0 Preflight | 18 | Intent routing audit, no overlap with Foundation Block | Orchestrator |
| S1 Table → Doc/Deck backend | 18 | `TableArtifactConversionService` | Agent A |
| S2 Form-intake backend | 19 | `Form.embedTargetTableId` + routing rules | Agent A |
| S3 Tabele lane conversions | 19 | Buttons in Menu 3 + live-link toast | Agent B |
| S4 Form intake frontend | 20 | "Create intake form" + form-to-table preview | Agent B |
| S5 Anygravity trial #2 + screenshots | 20 | P0 trial + DBR77 + Menu 3 + parity screenshots | Orchestrator + Agent C |
| S6 Demo recording + dry-run | 21 | 5-min e2e demo + full validation matrix dry-run | Agent D |
| S7 Final closeout | 21 | `TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT.md` | Orchestrator |

---

## Milestones

| Milestone | Target day | Exit criterion |
|---|---|---|
| M1 — Block A GO | Day 10 | Lifecycle + 30 templates + new field types live; Anygravity P0 #1 PASS |
| M2 — Block B GO | Day 10 | DB migration deployed; provenance + confidence + validation UI live; perf budget met |
| M3 — Barrier passed | Day 10 | M1 + M2 both `GO` |
| M4 — Block C GO | Day 17 | 8-level AI Editor + QA Engine + Source Pack Builder live |
| M5 — Block D GO | Day 21 | Tabele → doc/deck flow + form-intake + Anygravity P0 #2 + manual evidence |
| M6 — Program closed | Day 21 | All blocks `GO`; final closeout; follow-ups filed |

---

## 4-Agent Topology

Per `.cursor/CONSULTIFY_AI_DELIVERY_OS.md`. Agents work in parallel inside a sprint, not across sprints.

| Agent | Lane responsibility |
|---|---|
| **A** | Backend services, routes, integration tests |
| **B** | Frontend components, lane UI, component tests |
| **C** | Cross-cutting: DB migrations, intent routing, i18n, screenshot capture |
| **D** | QA gates, evidence consolidation, closeout, cross-tenant audits |

Each sprint card lists the lead agent per deliverable.

---

## Hard stops

The orchestrator must STOP and request user approval if any of the following fires:

- Cross-tenant leak detected during ACL audit (P0).
- DB migration blocks production reads/writes for >30 s (P0).
- AI Editor exceeds 200 % of daily token budget on a single workspace (P0 cost incident).
- Anygravity P0 trial fails on critical path.
- Any out-of-scope file change is detected (untouched-files guard).

---

## Out of scope (entire program)

- Real-time CRDT collaboration on records (separate program).
- Offline-first table editing (separate program).
- Native mobile Tabele app (separate program).
- External BI integrations (Tableau, PowerBI) (separate program).
- AI training on tenant data for cross-tenant suggestions (forbidden by `40-security-tenancy.mdc`).

---

## Communication cadence

- Sprint kickoff: card opened in `sprints/SPRINT_*.md` with daily section.
- Sprint daily: orchestrator updates card with completion status, blockers.
- Sprint exit: gate verdict written; if `NO_GO`, escalation card filed.
- Block exit: `03_BLOCK_CLOSEOUT.md` filled per `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`.
- Program exit: `TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT.md` aggregates all 4 block closeouts.
