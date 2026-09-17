# TPL-1b · New template — receipt

Date: 2026-09-17

Track: B · Codex-2

Queue source: KANAL.md W212/W215
Base SHA: `215c1cb8248f4f915ad376c6371a31b6a90676a0`

## Verdict

READY FOR CTO REVIEW. The remaining TPL-1b scope after the accepted 96-item inventory cleanup is implemented as a full artifact and governed lifecycle: required base, metadata, inherited formatting, source binding per block, live organization/object test, submit, independent approval, exactly one default per type, and approved-edit revisioning.

## Delivered behavior

- `New template` opens a full-screen artifact from Template Library. It does not use the retired format/mode modal.
- The artifact follows the accepted 16.09 layout: Menu 1, Menu 2 (`Structure`, `Formatting`, `Sources`, `Test run`, `History`), eight-slide Board deck archetype, and right accordion (`Metadata`, `Formatting`, `Sources`, `Assignment`, `Approval`, `History`).
- A base is mandatory: archetype, system template, or organization-owned template. System/own bases are tenant/type checked.
- DOC, DECK and SHEET keep their own canonical structure and every block/sheet carries a source binding.
- The test gate resolves a live object in the caller's organization, creates a real OOXML package probe (`docx`, `pptx` or `xlsx`), records an immutable receipt, and requires all checks to pass.
- Submit is unavailable before the latest draft version has a PASS receipt.
- The author cannot approve their own template. Approval also writes the existing provenance ledger evidence and promotes initial version `0.1` to `1.0`.
- `Default for type` is explicit in the artifact. Approval swaps the prior default transactionally; a partial unique index enforces one approved default for `(organization, document_type, output_type)`.
- Approved templates are immutable. `POST /templates/:id/revisions` clones an approved organization template into a new draft with parent lineage and increments `1.0 → 1.1`; draft edits invalidate the prior PASS.
- Legacy template create/update behavior remains available outside the governed workflow.

## Database

Additive migration: `server/migrations/20262273_deliverable_template_workflow.sql`.

Creates only:

- `deliverable_template_workflows`
- `deliverable_template_test_runs`
- supporting indexes and checks

The migration was applied twice on a fresh disposable PostgreSQL 16 database without error. No staging/demo database was touched.

Rollback for CTO runbook (not shipped as a migration):

```sql
DROP TABLE IF EXISTS deliverable_template_test_runs;
DROP TABLE IF EXISTS deliverable_template_workflows;
```

## Evidence

### Real PostgreSQL lifecycle

Command:

```text
NODE_ENV=test DB_TYPE=postgres MOCK_DB=false RUN_DB_TESTS=1 POSTGRES_SKIP_INIT_IN_TEST=true DATABASE_URL=<disposable-local-pg> npx vitest run server/src/services/__tests__/deliverableTemplateWorkflow.realpg.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result: `1 file / 1 test PASS`.

Measured on PostgreSQL:

1. migration is idempotent (same SQL applied twice),
2. draft registration persists,
3. the live organization initiative is resolved by tenant,
4. the eight-slide test generates a non-empty PPTX package and records PASS,
5. submit succeeds only after PASS,
6. author self-approval is rejected,
7. a different approver creates approved version `1.0`,
8. exactly one default row remains for the document/output pair.

Boundary: the test uses the real workflow tables, transactions, tenant lookup and OOXML generator. The pre-existing provenance writer and template registry reader are mocked in this focused test; their own existing suites remain the evidence for those components. No claim is made that a staging Gateway request was executed.

### Unit/component

- Workflow gate + version tests: `2 files / 6 tests PASS`.
- Template Library `New template` focused component tests: `1 file / 5 tests PASS` (`14` unrelated tests skipped by name filter).
- Server TypeScript: PASS.
- Frontend TypeScript scan: zero diagnostics in touched TemplateBuilder/workflow/router files. Repository-wide baseline diagnostics outside this packet were filtered, not claimed fixed.
- ESLint on touched workflow files: zero errors; warnings are inherited `any`/hook warnings in existing files.
- `git diff --check`: PASS.

### Visual/browser

Rendered at `1440×1000`, EN, light and dark:

- 3 required base choices,
- 5 Menu 2 entries,
- 8 structure items,
- 6 right-panel accordion sections,
- `Test` and `Submit` disabled before persistence/PASS,
- horizontal overflow: `0 px`,
- console/page errors: `0`.

Evidence:

- `evidence/new-template-light.png`
- `evidence/new-template-dark.png`

## Scope boundary

- No Track A file was changed.
- No deploy, staging/demo mutation, Railway change or push to an integration branch.
- The test export is a valid lightweight OOXML package used as the lifecycle gate. It is not a visual parity claim for the production document/deck/workbook renderer.
