# TemplateService Baseline — Block A Sprint 0

**Sprint:** `A-S0` Preflight
**Date:** 2026-05-08
**Author:** Cursor agent (Orchestrator)
**Status:** `READ-ONLY AUDIT — no code mutations performed`
**Scope:** Static analysis of `TemplateService.ts` and `tp_base_templates` schema vs the plan in `00_TASK_PACKET.md` / `epics/EPIC-T5*` / `epics/EPIC-T6*`.

---

## 1. Existing surface inventory

### 1.1 `TemplateService.ts` (current capabilities)

File: `DRD/consultify/server/src/services/tablePlatform/TemplateService.ts` (430 lines).

Public methods:

| Method | Signature | Notes |
|---|---|---|
| `listTemplates(category?)` | `(string?) → row[]` | Orders by `is_featured DESC, usage_count DESC`. **No filter by status / owner / tenancy.** |
| `getTemplate(id)` | `(string) → row \| null` | **No tenant scoping.** |
| `createFromTemplate(...)` | full materialization → returns base | Increments `usage_count`. Calls `metadataService.createBase` + per-table create + per-field create. |
| `publishAsTemplate(...)` | inserts into `tp_base_templates` | **No status field — every published template is implicitly visible to everyone.** |
| `seedDefaultTemplates()` | seeds 6 templates if table is empty | One-shot guard via `COUNT(*)`. |

### 1.2 `tp_base_templates` actual schema

Migration source: `DRD/consultify/server/migrations/721_templates.sql`.

```sql
CREATE TABLE IF NOT EXISTS tp_base_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  thumbnail_url TEXT,
  schema_snapshot JSONB NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_by TEXT,                   -- TEXT, not UUID
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Indexes: `idx_tp_templates_category`, `idx_tp_templates_featured WHERE is_featured = true`.

### 1.3 Existing 6 default templates (from `seedDefaultTemplates`)

| Name | Category | is_featured |
|---|---|---|
| CRM Pipeline | sales | true |
| Project Tracker | project-management | true |
| HR Onboarding | hr | true |
| Product Roadmap | product | false |
| Content Calendar | marketing | false |
| Bug Tracker | engineering | false |

### 1.4 Existing tests

- **No `TemplateService.test.ts` exists.** Coverage is implicit through:
  - `__tests__/migrations.test.ts` (132 lines) — schema migration smoke tests.
  - `__tests__/smoke.test.ts` (508 lines) — full-stack smoke.
  - No unit-level test for `seedDefaultTemplates`, `createFromTemplate`, `listTemplates`, `getTemplate`, `publishAsTemplate`.
- Baseline test count for direct TemplateService coverage: **0**.

---

## 2. Migration plan vs reality — findings

### Finding A-S0-F1: Migration filename and location

**Plan said:** `consultify/server/src/services/tablePlatform/migrations/2026_05_block_a_template_lifecycle.sql`

**Reality:** Migration runner uses pattern `^(7\d{2}|\d{8})_.*\.sql$` and discovers files at `DRD/consultify/server/migrations/` (top-level `migrations/`, not under `services/tablePlatform/migrations/`).

Latest 7XX-prefixed migration is `769_document_studio_templates.sql`. Latest date-prefixed migration is `20260502_canvas_content_contract.sql`.

**Adjustment:** Block A migration filename is `20260508_block_a_template_lifecycle.sql`, placed at `DRD/consultify/server/migrations/`. Same convention for Block B / C / D.

**Impact:** documentation-only; no plan rework; sprint cards already reference "ship migration" without specifying directory. Docs should be tightened in S1.

### Finding A-S0-F2: `created_by` is TEXT, not UUID

**Plan said:** `ALTER TABLE tp_base_templates ADD COLUMN owner_user_id UUID NULL REFERENCES users(id)`.

**Reality:** existing `created_by` is `TEXT`. The `users` table is referenced by string-typed FKs in many other tables (legacy convention: TEXT user IDs).

**Adjustment:** Use `owner_user_id TEXT NULL`. No FK reference (consistent with existing `created_by` pattern). Block A migration column types:

```sql
ALTER TABLE tp_base_templates
  ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'deprecated')),
  ADD COLUMN version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN owner_user_id TEXT NULL,
  ADD COLUMN approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN governance_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tp_templates_status ON tp_base_templates(status);
CREATE INDEX IF NOT EXISTS idx_tp_templates_owner ON tp_base_templates(owner_user_id) WHERE owner_user_id IS NOT NULL;
```

**Impact:** EPIC-T6 schema spec needs a one-line update. No risk to plan integrity.

### Finding A-S0-F3: 6 existing templates become `status='draft'` after migration

**Plan said:** 12 of 30 new templates ship as `approved`, 18 as `draft`.

**Reality:** The migration's `DEFAULT 'draft'` flips all 6 existing templates to `draft` automatically. They would disappear from the default `Approved` filter chip in `ArtifactModuleHome`.

**Adjustment options:**

1. **Promote to `approved`** — UPDATE in same migration: `UPDATE tp_base_templates SET status='approved' WHERE name IN ('CRM Pipeline','Project Tracker','HR Onboarding')` (the 3 with `is_featured=true`).
2. **Leave as `draft`** — they remain visible only when filter shows draft; super-admin can promote via UI later.
3. **Delete and re-seed** — risky if any user already created bases from them.

**CTO decision:** **Option 1.** The 3 featured legacy templates (`CRM Pipeline`, `Project Tracker`, `HR Onboarding`) get promoted to `approved` in the same migration. The 3 non-featured (`Product Roadmap`, `Content Calendar`, `Bug Tracker`) stay as `draft` because they are less consultancy-aligned. Result: total `approved` count after migration = 12 new + 3 legacy = **15 approved**, **15 draft**.

**Impact:** EPIC-T5 + EPIC-T6 task packets should be updated to reflect 15+15 (was 12+18). `ArtifactModuleHome` default filter still shows ~15 cards which is acceptable.

### Finding A-S0-F4: No existing TemplateService unit tests

**Plan said:** "All new unit / component / integration tests green" + "existing tests don't regress."

**Reality:** No existing direct unit tests. Smoke tests cover happy path of one or two methods.

**Adjustment:** Block A Sprint 1 (Lifecycle Backend) gets one extra micro-task:

> Write a baseline `TemplateService.test.ts` covering existing public methods (`listTemplates`, `getTemplate`, `createFromTemplate`, `seedDefaultTemplates`) BEFORE adding lifecycle methods. This locks pre-block behavior into a regression test.

**Impact:** S1 grows by ~0.5 day. Total Block A duration unchanged because S2 and S3 have buffer. Sprint card to be updated at S1 start.

### Finding A-S0-F5: `AUTO_FIELD_TYPES` rejects manual writes

**Plan said:** Mark `ai_generated_summary` and `ai_classification` as `AUTO_FIELD_TYPES` so values are re-derivable.

**Reality:** `AUTO_FIELD_TYPES` in `SchemaValidationService.ts:338` rejects ALL manual writes:

```ts
if (AUTO_FIELD_TYPES.has(field.field_type)) {
  errors.push({ message: `Cannot set auto field '${field.name}' (...)` });
}
```

This blocks the desired UX where AI generates a value and the user can override (with audit).

**Adjustment:** Do **not** add `ai_generated_summary` / `ai_classification` to `AUTO_FIELD_TYPES`. Instead:

- Add a new field-options flag: `options.aiAuto = true` (for AI-derived fields).
- Add a new mechanism `AI_REGEN_FIELD_TYPES` (set: `ai_generated_summary`, `ai_classification`) — these are eligible for AI recompute via Block C orchestration but accept manual writes (with audit row noting `manual_override = true`).
- Block A delivers schema only; Block C wires the recompute hook.

**Impact:** EPIC-T7 spec needs this clarification. No risk to plan integrity. Sprint S3 (Field Types Backend) absorbs the change in implementation.

### Finding A-S0-F6: `ALLOWED_FIELD_TYPES` confirmed; safe to extend

**Reality:** `SchemaValidationService.ts:15` exports `ALLOWED_FIELD_TYPES` with 28 entries (`singleLineText` … `barcode`). Adding 5 new entries (`risk_score`, `priority`, `ai_generated_summary`, `ai_classification`, `source_reference`) is a clean push to the array.

**Impact:** None. Plan unchanged.

---

## 3. Baseline test snapshot (paper)

A live `npm run test` run was not executed in this sprint because:
- This is a read-only sprint (Sprint 0).
- Repo-wide tests touch staging DB connections; not appropriate from agent context.
- Baseline metric is the **test file inventory + line count**, captured statically.

Static inventory:

```
__tests__/
  AutomationService.test.ts                472 lines
  DateDependencyEngine.test.ts             142 lines
  ExportService.test.ts                    230 lines
  ExtensionService.test.ts                 221 lines
  InterfaceService.test.ts                 213 lines
  MetadataService.test.ts                  376 lines
  ModuleSyncService.test.ts                 62 lines
  ProjectionService.test.ts                281 lines
  RecordsService.test.ts                   174 lines
  RelationExplainabilityService.test.ts    455 lines
  SSOService.test.ts                       205 lines
  ScheduledAutomationExecutor.test.ts      151 lines
  SchemaValidationService.test.ts          218 lines
  ServiceAccountService.test.ts            197 lines
  ViewQueryEngine.test.ts                  222 lines
  WebhookDispatcherService.test.ts         365 lines
  dependencyGraph.test.ts                   99 lines
  formulaEngine.test.ts                    226 lines
  migrationRunner.test.ts                   58 lines
  migrations.test.ts                       132 lines
  smoke.test.ts                            508 lines
  TOTAL                                  5 007 lines
```

**Live execution** of `cd consultify/server && npm test` is required at S6 (QA Gate) to confirm no regressions.

---

## 4. Sign-off

- Migration plan adjustments: F1, F2, F3 → flow into S1 sprint card.
- EPIC-T5 + EPIC-T6 + EPIC-T7 docs: F2, F3, F5 require small text edits.
- Block A test plan: F4 adds a baseline regression suite as part of S1.
- No surprises that warrant pausing the program.

**Recommendation:** `GO` to Block A Sprint 1.

**Open question for user (none blocking):**

Q: Do you want the 3 legacy "featured" templates (CRM Pipeline, Project Tracker, HR Onboarding) automatically promoted to `approved` in the lifecycle migration, or kept as `draft` so they require explicit super-admin promotion?

CTO default: **promote to `approved`** (Option 1). User can override before S1 starts.
