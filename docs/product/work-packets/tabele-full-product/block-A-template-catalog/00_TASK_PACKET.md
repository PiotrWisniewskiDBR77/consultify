# Task Packet — Block A: Template Catalog

**Block ID:** `TABELE_BLOCK_A_TEMPLATE_CATALOG`
**Template:** `.cursor/TASK_PACKET_TEMPLATE.md`
**Created:** 2026-05-07
**Status:** `PLANNED`
**Lane SSOT:** `DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`

---

## 1) Goal

Deliver the full Tabele template catalog (30 consulting templates), a `draft → approved → deprecated` lifecycle for templates, and five specialized field types (`risk_score`, `priority`, `ai_generated_summary`, `ai_classification`, `source_reference`) so that the Tabele lane covers the template-driven generation flows defined in the Consultify Table Studio specification (sections 4.2, 4.3, 5D, 5F, 12).

**Added 2026-05-08 (CTO directive):** This block also delivers EPIC-T16 — Tabele lane adoption of the **Module Executive Layout Standard (MELS)** so the Tabele frontend converges on the layout pattern proven by `DeckBuilder` (Prezentacje). MELS spec lives at `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md`. The Tabele changes land within the existing frontend sprints (A-S4, A-S5, A-S6) — no extra calendar.

## 2) Non-Goals

- No new AI Editor; that ships in Block C (EPIC-T10).
- No record provenance UI on grid cells; that ships in Block B.
- No QA Engine; that ships in Block C.
- No Source Pack Builder; that ships in Block C.
- No table → document/presentation conversion; that ships in Block D.
- No edits to Foundation Block deliverables (`TabeleView`, `TabelePreviewLayout`, `RelationExplainabilityService`) **other than** wiring the layout into `ExecutiveModuleShell` per EPIC-T16. Canvas content stays unchanged.
- No new view types beyond what Table Platform already exposes.
- No Wordy or Prezentacje migration to MELS — those are queued for the follow-up `executive-layout-unification` program.

## 3) Constraints

### Technical
- Must run on existing stack: React 19 + TypeScript 5.8, Express 5, Postgres 8, Vitest 4, Playwright 1.57.
- DB migration: additive only — `ALTER TABLE tp_base_templates ADD COLUMN status TEXT, version TEXT, owner_user_id TEXT, approval_history JSONB, governance_rules JSONB`. No row rewrites. Migration filename: `20260508_block_a_template_lifecycle.sql` at top-level `consultify/server/migrations/` (per S0 finding A-S0-F1).
- `owner_user_id` is `TEXT` (not UUID + FK) to match the `created_by TEXT` convention already in `tp_base_templates` (per S0 finding A-S0-F2).
- New `ALLOWED_FIELD_TYPES` entries extend the existing array without renaming. Backward compatibility on existing fields preserved.
- Cell renderers reuse `PlatformCellRenderer` extension pattern; no new top-level renderer registry.
- 12 new templates ship as `approved` + 3 legacy "featured" templates promoted in same migration; 18 new ship as `draft`. Final post-migration count: **15 approved + 15 draft** (per CTO decision Q3 + S0 finding A-S0-F3).
- AI-derived field types (`ai_generated_summary`, `ai_classification`) are NOT added to `AUTO_FIELD_TYPES` (which rejects manual writes). Instead a new `AI_REGEN_FIELD_TYPES` constant + `options.aiAuto` flag gates regeneration; manual writes accepted with audit (per S0 finding A-S0-F5).

### Product / UX
- Template card in `ArtifactModuleHome` shows lifecycle badge: green dot for `approved`, amber for `draft`, gray strike-through for `deprecated`.
- Filter chip in `ArtifactModuleHome` toolbar: "All / Approved / Draft" (default `Approved`).
- DBR77 monochrome palette; no new accent colors.
- New field types follow existing `singleSelect` styling patterns; `risk_score` uses heat-map gradient inside DBR77 token system.
- All template strings have EN + PL i18n.

### Safety / security
- Template lifecycle endpoints check tenant + super-admin role for promotion. Cross-tenant: 403.
- `source_reference` field type stores `source_id` only; the resolution to actual source content goes through `PermissionsService` per request.
- `ai_generated_summary` and `ai_classification` mark fields as AI-derived; manual override is logged in audit.
- Migration runs under transaction; rollback drops new columns.

## 4) Scope

### In scope — files to CREATE

**Backend (services / routes / migrations / tests)**
- `consultify/server/src/services/tablePlatform/migrations/2026_05_block_a_template_lifecycle.sql`
- `consultify/server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts` (30 schema_snapshots)
- `consultify/server/src/services/tablePlatform/TemplateLifecycleService.ts`
- `consultify/server/src/services/tablePlatform/SpecializedFieldTypes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/TemplateLifecycleService.test.ts`
- `consultify/server/src/services/tablePlatform/__tests__/SpecializedFieldTypes.test.ts`
- `consultify/server/src/routes/__tests__/template-lifecycle-acl.test.ts`

**Frontend (components / utilities / tests)**
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleBadge.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleFilter.tsx`
- `consultify/src/components/MyWork/table/cells/RiskScoreCell.tsx`
- `consultify/src/components/MyWork/table/cells/PriorityCell.tsx`
- `consultify/src/components/MyWork/table/cells/AiSummaryCell.tsx`
- `consultify/src/components/MyWork/table/cells/AiClassificationCell.tsx`
- `consultify/src/components/MyWork/table/cells/SourceReferenceCell.tsx`
- Component tests under `tests/components/MyWork/table/cells/`

**Frontend — EPIC-T16 (MELS) shell**
- `consultify/src/components/shared/ExecutiveModuleShell/index.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/TopBar.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/LeftRail.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/RightRail.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/useRailState.ts`
- `consultify/src/components/shared/ExecutiveModuleShell/shortcuts.ts`
- `consultify/src/components/shared/ExecutiveModuleShell/styles.module.css`
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleLeftRail.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleRightRail.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleTopBarChips.tsx`
- Tests for shell + rail state + shortcuts under `tests/components/shared/ExecutiveModuleShell/`.

**Docs / SoT**
- This packet folder.
- `consultify/docs/product/TABLE_TEMPLATE_CATALOG_V1.md` (catalog of 30 templates, audience, fields, governance rules).

### In scope — files to UPDATE (additive only)

- `consultify/server/src/services/tablePlatform/TemplateService.ts` — add `listTemplates({status})`, `approveTemplate`, `deprecateTemplate`, `getTemplateGovernance`. Existing `seedDefaultTemplates` extended with the 30 new templates wired to `tabele_consulting_templates.ts`.
- `consultify/server/src/services/tablePlatform/SchemaValidationService.ts` — extend `ALLOWED_FIELD_TYPES` with the 5 new types; add validators per type in a new `validateSpecializedField()` switch.
- `consultify/server/src/routes/table-platform.routes.ts` — add `POST /templates/:id/approve`, `POST /templates/:id/deprecate`, `GET /templates?status=...`. Owner check + tenant check on each.
- `consultify/src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` — extend `BUILTIN_TEMPLATES.tabele` to surface the 12 `approved` templates; add lifecycle filter chip.
- `consultify/src/components/MyWork/table/CellRenderer.tsx` — register new specialized cell renderers.
- `consultify/src/components/MyWork/table/PlatformCellRenderer.tsx` — same registration.
- `consultify/src/components/MyWork/table/AddColumnDialog.tsx` — expose 5 new field types in the picker.
- `consultify/src/components/MyWork/table/tableTypes.ts` — extend `ColumnType` union with new types.
- `consultify/public/locales/{en,pl}/translation.json` — ~100 new keys (template names, descriptions, lifecycle labels, field type labels).

### Files explicitly OUT OF SCOPE (must show zero diff)

- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/*` (canvas content stays Foundation Block).
- `consultify/server/src/services/tablePlatform/RelationExplainabilityService.ts`
- `consultify/server/src/routes/table-platform.relations-explain.routes.ts`
- All Wordy / Excele / Prezentacje components (MELS migration for those modules is a separate follow-up program).

### Files EXPECTED TO CHANGE for EPIC-T16 (MELS) only

- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` — refactored to consume `ExecutiveModuleShell` and supply slot content. End-user behaviors must remain green for all Foundation Block E2E specs.

## 5) Definition Of Done

### Functional
- [ ] 30 templates seeded into `tp_base_templates` with correct schema_snapshots, audience, governance_rules.
- [ ] 15 templates marked `approved` (12 new + 3 promoted legacy), 15 marked `draft`. Lifecycle filter chip works.
- [ ] Approve / deprecate endpoints work with super-admin only; cross-tenant 403 verified.
- [ ] 5 new field types render correctly in GridView, KanbanView, and TabelePreviewLayout records section.
- [ ] AddColumnDialog exposes new types with appropriate option presets.
- [ ] EN + PL i18n on every visible string (no missing keys at runtime).
- [ ] Anygravity P0 trial #1 PASS (after S2).
- [ ] **EPIC-T16:** Tabele frontend renders inside `ExecutiveModuleShell`. Top bar + left rail + right rail per MELS § 6 acceptance.
- [ ] **EPIC-T16:** No Menu 2 (horizontal toolbar) anywhere in Tabele view.
- [ ] **EPIC-T16:** Keyboard shortcuts work (`Cmd/Ctrl+\`, `Cmd/Ctrl+/`, `Cmd/Ctrl+K`, `Cmd/Ctrl+Enter`, `Cmd/Ctrl+Shift+A`).
- [ ] **EPIC-T16:** Rail widths and collapsed state persist across reload (localStorage namespaced by module).

### Validation
- [ ] `cd consultify && npm run lint` clean.
- [ ] `cd consultify && npm run type-check` clean.
- [ ] `cd consultify/server && npm run typecheck` clean.
- [ ] All new unit / component / integration tests green.
- [ ] Migration runs on staging DB without errors; rollback rehearsed.
- [ ] Cross-tenant 403 verified on all 3 new endpoints.
- [ ] DBR77 hex scan: 0 raw hex literals in new components.

### Evidence
- All filled in `03_BLOCK_CLOSEOUT.md` per `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`.
- Anygravity P0 #1 result attached.
- Screenshot of lifecycle filter chip and 5 new field type cells.

## 6) Risk Notes

See `02_RISK_REGISTER.md`. Top risks:

- **A-T1** Migration adds columns to a hot table; could lock for seconds. Mitigation: `ALTER TABLE ADD COLUMN ... DEFAULT NULL` is non-rewriting.
- **A-T2** 30 templates × 2 locales = many strings; i18n drift. Mitigation: centralized strings + i18n linter.
- **A-T3** New field type `source_reference` couples to Block B's `tp_record_sources`. Mitigation: A defines the field type to point to a `source_id`, B owns table; coordinated via XB1 in program risk register.
- **A-S1** Approve / deprecate without owner check leaks template promotion across tenants. Mitigation: super-admin role check on every endpoint + cross-tenant test.

### Rollback strategy

- All additive: revert PR.
- Feature flag `featureTemplateLifecycleEnabled` gates lifecycle UI and approval endpoints.
- Migration rollback: `ALTER TABLE tp_base_templates DROP COLUMN status, version, owner_user_id, approval_history, governance_rules` (reversible).
- Specialized cell renderers fall back to text rendering if registry missing.

---

## Sign-off

- Block lead: ___ (waiting for user GO)
- UI/UX reviewer: ___
- Security reviewer: ___
- Date: ___
