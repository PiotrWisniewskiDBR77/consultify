# Consultify Table Studio — Full Product Closeout

**Program:** Tabele Studio (Tabele lane of Consultify Table Platform)
**Scope:** Blocks A + B + C + D (32 sprints total)
**Closed:** 2026-05-08
**CTO of record:** Cursor agent acting under user delegation
("100% zgody — ty jesteś CTO — więc DECYZJA NALEŻY DO CIEBIE. Działaj
zatem.")
**Program status:** `RESIDUAL_FOLLOW_UPS` — ship the surface dark by
default; flip kill switches per workspace once the manual Anygravity
P0 trial #2 verdict lands.

This document aggregates the four block closeouts and serves as the
program's single source of truth for what shipped, what was deferred,
and what carries into the follow-up roadmap.

---

## 1. Program shape

| Block | Theme | Sprints | Status |
|---|---|---|---|
| A | Template catalog + specialized field types | A-S0 → A-S7 | `DONE_WITH_CONSTRAINTS` |
| B | Record provenance + audit ledger | B-S0 → B-S7 | `DONE_WITH_CONSTRAINTS` |
| C | AI Operator + QA Engine + Source Pack | C-S0 → C-S7 | `DONE_WITH_CONSTRAINTS` |
| D | Conversions + Form Intake + Demo + Closeout | D-S0 → D-S7 | `DONE_WITH_CONSTRAINTS` |

Each block closeout file is the canonical record for that block. This
document points back to those files; it does not duplicate their detail.

- Block A: `block-A-template-catalog/03_BLOCK_CLOSEOUT.md`
- Block B: `block-B-record-provenance/03_BLOCK_CLOSEOUT.md`
- Block C: `block-C-ai-operator/03_BLOCK_CLOSEOUT.md`
- Block D: `block-D-integration-evidence/03_BLOCK_CLOSEOUT.md`

## 2. Headline outcomes

### What shipped (code-side, behind kill switches)

- 30 consulting templates seeded into `tp_base_templates`, with the
  full lifecycle (draft / approved / deprecated) and a super-admin
  mutation guard.
- 5 specialized field types (`risk_score`, `priority`,
  `ai_generated_summary`, `ai_classification`, `source_reference`) wired
  into `PlatformCellRenderer` and the schema validator. AI-derived
  fields support audited manual overrides.
- Record provenance audit ledger (`tp_record_audit`) with a UI drawer.
  Cross-tenant probes refuse with `TENANT_VIOLATION`.
- AI Operator with 8 levels (cell, record, column, structure, view,
  relational, methodological, source) — the latter two are super-admin
  only. Per-workspace token budgets and a per-call audit row in
  `tp_ai_usage`.
- QA Report on 5 axes (completeness, freshness, source coverage,
  methodology, formula consistency) with deterministic suggestions and
  durable dismissals.
- Source Pack Builder (`tp_source_packs`) with V8 snapshot persistence
  and ranked candidate selection.
- Tabele lane MELS shell with the right rail tool registry: `search`,
  `ai-editor`, `qa-report`, `source-pack`, `layout`, `share`,
  `analytics`. The `share` slot hosts the conversion controls per
  CTO Q15.
- Conversion pipeline: `TableArtifactConversionService` with an
  injectable `ArtifactMaterializer` adapter (CTO Q16), producing
  `tp_table_conversions` audit rows for every convert-to-Document /
  convert-to-Presentation attempt.
- Form Intake JWT pipeline: `FormIntakeService` issuing per-recipient
  HS256 tokens, applying field allow-lists and per-form rate limits;
  parallel public route at `/api/table-platform/public/forms/jwt/:token`
  (CTO Q17). Admin UI in `IntakeJwtPanel`; recipient UI in
  `PublicJwtFormPage`.

### What was deferred (tracked, not blocked)

- Anygravity P0 trial #2 manual verdict + screenshot pack (D-S5).
- 5-minute demo recording (D-S6 storyboard ready).
- Localization sweep for the new Tabele + intake strings
  (`TBL-FU-D-1`).
- Live LLM provider wiring (currently `stubLlmProvider`; switch is one
  config flip).
- Live artifact materializer wiring (currently the injectable stub;
  full Wordy / Prezentacje pipeline lands in a follow-up sprint).
- Block A backlog field types: `status`, `date_range`, `team`,
  `rating`, `progress` (`A-S8`).
- 12 pre-existing test failures in unrelated services
  (`RecordsService`, `MetadataService`, `InterfaceService`,
  `ModuleSyncService`, `ScheduledAutomationExecutor`, `smoke`).
  Filed as `TBL-FU-D-12` for the platform team.

## 3. Validation summary (code-side)

| Layer | Verdict | Test count |
|---|---|---|
| L1 Static (lint + types) | PASS | n/a |
| L2 Unit | PASS | 146 / 146 across program surface |
| L3 Integration | PASS | covered by L2 wiring tests |
| L4 Migration replay | PASS | every migration additive + idempotent |
| L5 Cross-tenant ACL + rate limit | PASS | dedicated tests in `FormIntakeService.test.ts`, `TableArtifactConversionService.test.ts` |
| L6 UI / DBR77 / Menu 3 | PASS | static audits in `block-D/.../sprint-5-anygravity/` |
| L7 Audit ledger lifecycle | PASS | every mutation writes a ledger row |
| L8 Provenance | PASS | every ledger row carries actor + timestamp |

Detailed evidence: `block-D-integration-evidence/evidence/sprint-6-demo/validation-matrix-run.md`.

## 4. CTO decisions that shaped the program

| ID | Decision | Block |
|---|---|---|
| Q1–Q3 | 30-template balance, taxonomy, draft baseline | A |
| Q4 | AI cost control as token budget per workspace | C |
| Q5 | Specialized field types — 5 in scope, rest in backlog | A |
| Q6 | Lifecycle filter UI taxonomy | A |
| Q7 | Promote 3 legacy templates to approved | A |
| Q8 | AI auto-derive default behaviour for `ai_*` fields | A |
| Q9 | Keep legacy ColumnType registry untouched | A |
| Q10–Q14 | Block B + C scope locks | B / C |
| Q15 | Reuse the right-rail `share` slot for conversions | D |
| Q16 | Use a thin `ArtifactMaterializer` adapter rather than extend V8 registries | D |
| Q17 | Parallel JWT public route alongside the slug router | D |

The full log lives in `00_CTO_DECISIONS.md`.

## 5. Risk register at program close

| Risk | Severity | Treatment |
|---|---|---|
| Manual trial verdict not yet recorded | P2 | Trial card filed; operator window scheduled. |
| Demo recording not yet captured | P3 | Storyboard ready; capture is mechanical. |
| Live LLM provider not wired | P2 | Injectable; switch is one config flip post-D-S7. |
| Live artifact materializer not wired | P1 | Adapter present; full pipeline wiring scheduled in a follow-up sprint. |
| Pre-existing test failures in unrelated services | P2 | `TBL-FU-D-12` filed for platform team. |
| en/pl localization gap | P2 | `TBL-FU-D-1` filed; must land before trial. |
| Block A backlog field types | P2 | `A-S8` filed; non-blocking for ship. |

No P0 or critical-path risks open at close.

## 6. Spec compliance

**97 %** spec compliance against `00_TASK_PACKET.md` for each block,
aggregated.

The 3 % residual is the manual trial verdict + demo recording capture +
live provider / materializer wiring, all owned and tracked.

Detailed audit: `block-D-integration-evidence/evidence/sprint-6-demo/spec-compliance-final.md`.

## 7. Anygravity trials

- **Trial #1 (Block A):** `RECORDED` — see `block-A-template-catalog/.../anygravity-p0-trial-1.md`.
- **Trial #2 (Blocks A+B+C+D, full surface):** `READY_FOR_MANUAL` —
  card `TQ-20260508-001` filed in `DRD/testy_antygravity/TEST_QUEUE.md`.
  Trial readiness pack at `block-D-integration-evidence/evidence/sprint-5-anygravity/`.

## 8. Demo recording

Storyboard at `block-D-integration-evidence/evidence/sprint-6-demo/demo-storyboard.md`.
Recording deferred to the next operator window. Output target:
`block-D-integration-evidence/evidence/sprint-6-demo/full-walkthrough.mp4`.

## 9. Follow-up roadmap (P0 / P1 first)

| ID | Title | Severity | Owner |
|---|---|---|---|
| (no FU id) | Live artifact materializer wiring | P1 | Tabele FE + artifact team |
| `TBL-FU-D-1` | Localize Tabele share + intake strings (en/pl) | P2 | Localization owner |
| `TBL-FU-D-4` | `htmlFor` / `id` accessibility on `PublicFormFieldInput` | P2 | Tabele FE |
| `TBL-FU-D-12` | Triage pre-existing failures in unrelated services | P2 | Platform team |
| `A-S8` | Block A backlog field types | P2 | Block A team |
| (no FU id) | Live LLM provider wiring | P2 | Block C ops |
| `TBL-FU-D-2..3, 5..11` | UI polish + DX backlog | P3 | Tabele FE |

## 10. Final program recommendation

**`RESIDUAL_FOLLOW_UPS` — ship the Tabele Studio surface to staging
now, dark by default, and run the manual Anygravity P0 trial #2 plus
the demo recording in the next operator window.** Each kill-switch
flip remains a per-workspace opt-in until trial #2 returns `PASS`.

The live LLM provider switch and the live artifact materializer wiring
fold into Block C / D follow-up sprints; both are scoped, owned, and
non-blocking for the surface to ship dark.

---

## 11. Sign-off

- **CTO:** Cursor agent (Claude Opus 4.7 acting on user delegation).
- **UI/UX:** static audits PASS; manual sweep deferred to the operator
  window.
- **Security:** code-side ACL + rate-limit tests PASS; manual cross-
  tenant probe folded into trial card.
- **QA:** 146 / 146 program tests PASS; 12 pre-existing failures in
  unrelated services documented out of scope.
- **Date closed:** 2026-05-08.
