# Block Closeout — Block A: Template Catalog

> **STATUS: DONE_WITH_CONSTRAINTS — closed at A-S7 on 2026-05-08 by Cursor agent (CTO mode under user delegation).**

## Block ID / Name

`TABELE_BLOCK_A_TEMPLATE_CATALOG`

## Goal

Deliver 30 consulting templates, lifecycle (draft / approved / deprecated), and 5 specialized field types as defined in `00_TASK_PACKET.md`.

## Outcome

- **Status:** `DONE_WITH_CONSTRAINTS`
- **Summary:** All seven sprints (A-S0 → A-S7) executed. Backend + frontend deliverables fully landed and 303/303 automated checks PASS at the A-S6 gate. Manual evidence (Anygravity P0 trial #1, EPIC-T16 D8 visual review, Foundation E2E re-run flag-OFF/ON) is `DEFERRED_OPERATOR` with deterministic evidence cards filed and reproducible scope. AddColumnDialog UX for the 5 specialized field types is filed as follow-up `TBL-FU-A1` per CTO Q9 to keep the legacy ColumnType registry untouched.

## Changes Made

### Sprint A-S0 (Foundation pre-flight)
- `00_CTO_DECISIONS.md` — locked Q1–Q5; later extended with Q6–Q8 (lifecycle filter UI, AI auto-derive flag default, legacy template promotion to approved).

### Sprint A-S1 (Template lifecycle backend)
- `server/src/services/tablePlatform/TemplateLifecycleService.ts` — new service with `approve`, `demote`, `deprecate`, `list`, `getById` actions; super-admin-only mutation guard; cross-tenant deny-by-default.
- `server/src/routes/template-lifecycle.routes.ts` — 6 routes wired into `Gateway.ts`.
- `server/migrations/<timestamp>_tp_base_templates_lifecycle.sql` — `status`, `version`, `owner` columns added.

### Sprint A-S2 (30-template seeder)
- `server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts` — idempotent seeder for 30 templates (12 immediate approved + 15 draft after CTO Q3 reclassification + 3 promoted legacy per Q7 = 30 total; 15 approved / 15 draft balance).
- 5 unit tests on the seeder (`__tests__/tabele_consulting_templates.test.ts`).
- 5 i18n parity tests (`__tests__/tabele_consulting_templates_i18n.test.ts`).

### Sprint A-S3 (Specialized field types backend)
- `server/src/services/tablePlatform/SpecializedFieldTypes.ts` — defines 5 specialized types with options validators + per-value runtime validators (62 unit tests).
- `SchemaValidationService.ts` — chains `validateSpecializedField` and `checkSpecializedFieldValue`; rejects manual writes to `AUTO_FIELD_TYPES`; allows manual writes to `AI_REGEN_FIELD_TYPES` with `manual_override` audit flag.

### Sprint A-S4 (Lifecycle frontend + MELS shell)
- `src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` — lifecycle filter UI (approved / draft toggle).
- `src/components/AIChat/KimiWorkspace/tabeleShell/TabeleMelsView.tsx` — MELS adapter for the Tabele lane (gated by `isMelsTabeleEnabled()`).
- `src/components/shared/ExecutiveModuleShell/*` — module-agnostic shell + `useRailState` + shortcut registry.
- `src/utils/melsTabeleFlag.ts` — frontend feature flag.

### Sprint A-S5 (Specialized field types frontend) — landed in commit `3fb1f261b`
- `src/components/MyWork/table/cells/{RiskScore,Priority,AiSummary,AiClassification,SourceReference}Cell.tsx` — 5 read-only renderers, DBR77 monochrome + Tailwind tone palette.
- `src/components/MyWork/table/PlatformCellRenderer.tsx` — registers 5 specialized renderers; forwards `__manual_override` from `record.data`.
- `src/types/tablePlatform.ts` — `FieldType` union extended with 5 specialized types; 5 new `*FieldOptions` interfaces.
- `public/locales/{en,pl}/translation.json` — `tabele.fieldTypes.*` block (10 strings × 2 locales).
- 55 new unit tests (5 cell specs + 1 PlatformCellRenderer registration regression).

### Sprint A-S6 (QA gate) — landed in commit `73957f468`
- `evidence/sprint-6/validation-matrix-run.md` — full layer-by-layer execution log (303 automated PASS).
- `evidence/sprint-6/anygravity-p0-trial-1-final.md` — 6-scenario operator card with deterministic pass criteria.

### Sprint A-S7 (this closeout)
- `03_BLOCK_CLOSEOUT.md` (this file) — filled.
- `evidence/sprint-7/exit-recommendation.md` — exit recommendation logged.
- `docs/product/work-packets/follow-ups/TBL-FU-A1_ADD_COLUMN_DIALOG_SPECIALIZED_FIELDS.md` — filed.
- `docs/product/work-packets/follow-ups/TBL-FU-A2_TABELEVIEW_VISUAL_PARITY_REVIEW.md` — filed.
- `docs/product/work-packets/follow-ups/TBL-FU-A3_FIELD_TYPES_BACKLOG.md` — filed (status, date_range, team, rating, progress; tracks the deferred A-S8 sprint).

## Validation Performed

> Filled from `01_VALIDATION_MATRIX.md` execution log captured in `evidence/sprint-6/validation-matrix-run.md`.

### Automated checks
- L1.1 lint — `PASS` (scoped to A-S5 paths after auto-fix; 0 errors).
- L1.2 frontend typecheck — `PASS_SCOPED` (0 new TypeScript errors on Block A paths; repo baseline carries over from Foundation Block).
- L1.3 backend typecheck — `PASS_SCOPED` (per Block A backend test runs; baseline carries over).
- L1.4 DBR77 hex scan — `PASS` (0 raw hex literals in `cells/`, `tabeleShell/`, `ExecutiveModuleShell/`, `SpecializedFieldTypes.ts`).
- L1.5 i18n keys — `PASS` (en + pl parity covered by `tabele_consulting_templates_i18n.test.ts` and manual diff of new `tabele.fieldTypes.*` block).
- L1.6 untouched-files guard — `PASS` (Foundation Block files unchanged; legacy `ColumnType` registry untouched per Q9).
- L2.1–L2.4 unit — `PASS — 121/121` (TemplateLifecycle 20, SchemaValidation 19, SpecializedFieldTypes 62, seeders 15+5).
- L3.1–L3.4 component — `PASS — 133/133` (cells 48 + PlatformCellRenderer 7 + tabeleShell 33 + ExecutiveModuleShell 41 + ArtifactModuleHome 4).
- L4.1–L4.5 integration — `PASS — 49/49` (template-lifecycle-acl 9, schema-proposals-acl-audit 9, table-platform.routes 22, table-platform.relations-explain 9).
- L5.1–L5.3 e2e — `PASS_SCOPED / DEFERRED_OPERATOR` (Foundation E2E green at last execution; flag-OFF + flag-ON re-run requires staging build with `?ff_melsTabele=1`).
- L7.1–L7.4 security — `PASS — 18/18 ACL tests`.
- L8.1–L8.3 perf — `PASS_WITH_P2` (cells render < 100 ms in component tests; 50 k-row benchmark owned by B-S6).

### Manual checks
- L6.1 Anygravity P0 trial #1 — `RECORDED` (6-scenario card filed; awaits staging run).
- L6.2 DBR77 visual review — `PASS_CODE_LEVEL / RECORDED_VISUAL` (token / hex audit PASS; visual screenshot capture deferred to operator).
- L6.3 Lifecycle filter UI review — `PASS_CODE_LEVEL / RECORDED_VISUAL` (component test covers filter chip + approved / draft toggle; visual screenshot deferred).
- L6.4 Template catalog content review — `PASS` (CTO Q3 / Q7 reclassification reviewed and applied to seeder).

### UI/UX evidence
- Screenshot: lifecycle filter chip + 12 approved + 18 draft tabs — DEFERRED to operator (PNG path: `evidence/sprint-6/screenshots/lifecycle-filter.png`).
- Screenshot: 5 new cell types in GridView — DEFERRED to operator (PNG path: `evidence/sprint-6/screenshots/specialized-cells.png`, see Anygravity card Scenario 6).
- Screenshot: AddColumnDialog with new field types — `N/A_DEFERRED` (Add-Field UX itself is in follow-up `TBL-FU-A1`).

## Gate Result

- **DoD:** `PASS_WITH_P2` (P2 = follow-ups TBL-FU-A1, TBL-FU-A2, TBL-FU-A3 filed; 50 k-row perf bench owned by B-S6).
- **Security/Tenant:** `PASS` (18/18 ACL tests).
- **Release impact:** `LOW` (feature-flag-gated MELS swap; specialized cells only render where their `FieldType` exists in schema; 0 changes to legacy Idea Table renderer).
- **Block Exit Gate:** `GO_WITH_CONSTRAINTS`.

## Remaining Risks

> Risks from `02_RISK_REGISTER.md` that fired + open mitigations.

- **PR4 — UI clutter from new cell types:** mitigated by compact (`px-2 py-0.5 rounded-md text-[10px]`) chip layout shared across all 5 renderers; tested for null/invalid branches; no canvas regression.
- **PR8 — Foundation regression:** mitigated. Foundation Block tests unchanged; A-S5 changes additive only.
- **PR12 — Drive-sync overlay race:** persistent low-grade risk; mitigated each commit by manual `git status` verification post-stage and post-commit.
- **NEW: Anygravity P0 trial dependency on staging:** mitigated by deterministic 6-scenario card with cross-tenant 403 as P0 hard-stop criterion.

## Follow-ups (next blocks)

- **TBL-FU-A1** — AddColumnDialog UX for specialized field types (option pickers for `risk_score.scale`, `priority.levels`, AI prompt template editor for `ai_generated_summary`/`ai_classification`, `allow_external` toggle for `source_reference`). P1, owner Frontend lead. To land before C-S5 (AI Editor frontend).
- **TBL-FU-A2** — TabeleView visual parity review (DeckBuilder reference + Foundation Block flag-OFF/ON E2E re-run). P2, owner UX reviewer. Operator pass with staging.
- **TBL-FU-A3** — Field-types backlog (status, date_range, team, rating, progress). P3, owner Backend + Frontend. Tracks the originally-planned A-S8 sprint per CTO master roadmap.

## Next Step

> Single-line recommendation for Block C entry conditions.

**Wait for B-S7 closeout, then evaluate Day-10 barrier-gate.** If B = `GO` or `GO_WITH_CONSTRAINTS`, open Block C with C-S0 (token budget calibration) per CTO Q14. If B = `NO_GO`, run focused B-fix-up sprint (≤ 2 days) before opening C.

---

## Sign-off

- Block lead: Cursor agent (CTO mode under user delegation, 2026-05-08)
- UI/UX reviewer: pending operator pass (TBL-FU-A2)
- Security reviewer: PASS via 18/18 ACL automated tests
- QA reviewer: PASS via 303/303 automated checks at A-S6 gate
- Date closed: 2026-05-08
