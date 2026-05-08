# Sprint 3 — AI Editor Levels 5–8 (Block C)

**Sprint ID:** `C-S3`
**Owner:** Agent A
**Status:** `EXECUTED — GO`
**Estimate:** ~1.5 days
**Epic:** EPIC-T10
**Executed:** 2026-05-08

## Goal

Full implementation of view, relational, methodological, source level handlers. Methodological + source require super-admin.

## Pre-sprint risk check

C-S4 (admin role check), C-XB1/2/3 (cross-block dependencies).

## Deliverables

- `viewLevel.ts` — view config suggestion (create or update).
- `relationalLevel.ts` — proposes new linkedRecord relations between tables;
  same-base / same-tenant guard.
- `methodologicalLevel.ts` — reads `template.governance_rules` (Block A) or
  caller-supplied rules; emits read-only deviation flags.
- `sourceLevel.ts` — suggests candidate sources for records missing them.
- Unit tests + admin-role gate test.

## Files

### Updated

- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/viewLevel.ts`
  — was C-S1 stub; full implementation emits `op_view_create` (when no
  `viewId` in context) or `op_view_update` (when present).
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/relationalLevel.ts`
  — was C-S1 stub; full implementation emits `op_relation_create`. Cross-tenant
  defense scoped to a candidate set: either caller-supplied
  `candidateTargetTableIds[]` (filtered through tenant) or same-base scan.
  Drops self-references and targets outside the candidate set.
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/methodologicalLevel.ts`
  — was C-S1 stub; full implementation emits read-only
  `op_methodological_flag` envelopes. Best-effort lookup of
  `tp_base_templates.governance_rules` via the table's base, with graceful
  fallback when the column is missing on older deployments. Caller may
  override via `context.governanceRules`.
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/sourceLevel.ts`
  — was C-S1 stub; full implementation emits `op_source_suggest`. Auto-scans
  records with zero `tp_record_sources` rows (best-effort, falls back to
  table records when the join table doesn't exist). Caps candidates at 5
  per record (UI fan-out cap) and drops candidates with empty `ref`.
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/operations.ts`
  — added `opViewCreate`, `opViewUpdate`, `opRelationCreate`,
  `opMethodologicalFlag`, `opSourceSuggest` to the discriminated union.
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/index.ts`
  — `LevelStubInput.actorIsSuperAdmin: boolean` is now required so handlers
  can rely on a definite role decision.
- `consultify/server/src/services/tablePlatform/TableAiEditorService.ts`
  — orchestrator now gates levels 7 (methodological) and 8 (source) on
  `actorIsSuperAdmin === true`, throwing `SUPER_ADMIN_REQUIRED` (HTTP 403)
  BEFORE consume() so a forbidden caller cannot drain the budget.
- `consultify/server/src/routes/table-platform.ai-editor.routes.ts`
  — propose route now passes `actorIsSuperAdmin: Boolean(authReq.user?.isSuperAdmin)`.

### Created

- 4 handler test files in
  `consultify/server/src/services/tablePlatform/TableAiEditorLevels/__tests__/`:
  - `viewLevel.test.ts` — 5 tests
  - `relationalLevel.test.ts` — 6 tests
  - `methodologicalLevel.test.ts` — 5 tests
  - `sourceLevel.test.ts` — 6 tests

## Sprint Exit Gate

- [x] 4 handlers ship full impl + tests.
- [x] Admin-role guard verified at the orchestrator (`SUPER_ADMIN_REQUIRED`
      thrown for methodological/source when the actor is not super-admin;
      consume() not called on the forbidden path — explicit test in
      `TableAiEditorService.test.ts` test #5b).
- [x] Cross-tenant verified at every handler:
      - relational: drops `toTableId` outside the tenant-filtered candidate
        set (test #2 + #6),
      - methodological: drops flags referencing unknown record/field IDs,
      - source: drops suggestions for unknown record IDs (test #3),
      - all four: tenant-violation early-return test.
- [x] Recommendation: **GO** to S4.

## Execution Log (2026-05-08)

### Architecture decisions

1. **Read-only flag/suggest envelopes for levels 7 & 8.** Methodological
   and source levels emit `op_methodological_flag` and `op_source_suggest`
   respectively — these envelopes do NOT mutate data when applied. The
   user reviews flags and decides whether to fix data or amend the rule;
   for source candidates, C-S6 SourcePackBuilderService creates the
   actual `tp_record_sources` rows after user confirmation. This
   preserves the "AI never executes" invariant from EPIC-T10.

2. **`actorIsSuperAdmin` in `LevelStubInput` is required.** Forcing every
   handler call to declare the actor's role makes the invariant explicit
   in the type system. The orchestrator gates the dispatch; handlers
   never need to re-check role (defense in depth via routing layer).

3. **Best-effort schema lookups.** `methodologicalLevel.resolveRules` and
   `sourceLevel.listRecordsMissingSources` use try/catch around schema
   variants (`tp_base_templates.applied_template_id`,
   `tp_record_sources`). When those columns/tables are missing on older
   deployments, the handlers degrade to a baseline scan instead of
   throwing — so the AI Editor can ship before all of Block A's
   template-application work lands.

4. **Same-base candidate scan for relational level.** When the caller
   doesn't supply `candidateTargetTableIds`, we scan tables in the SAME
   base — never the entire workspace — to keep the prompt token budget
   small and prevent the LLM from accidentally proposing cross-base
   links. Self-references (`fromTableId === toTableId`) are explicitly
   rejected with a warning.

### Validation

- ESLint: 0 errors across all new/edited files.
- Vitest: **75 / 75 PASS** for Block C as a whole (C-S1 11 + 14, C-S2 27,
  C-S3 22, plus the dedicated super-admin gate test in
  `TableAiEditorService.test.ts`).
- Cross-tenant defense covered for every level via dedicated
  `*_tenant_violation` test.
- Super-admin gate verified by `TableAiEditorService.test.ts > 5b`:
  attempting `methodological` or `source` with `actorIsSuperAdmin: false`
  throws `SUPER_ADMIN_REQUIRED` (HTTP 403) and `mockConsume` is never
  called (no token leak).

### Deferred to C-S5 / C-S6

- Real `MutationExecutor` wiring for view, relational, methodological,
  source applies — C-S5 (frontend `TabeleAiEditorPanel` + apply button).
- `SourcePackBuilderService` integration at apply time — C-S6.
- Full Block A template lookup (when `applied_template_id` lands across
  all deployments) — C-S5 hardening.
