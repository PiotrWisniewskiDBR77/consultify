# TEMPLATE-1c — canonical workbook templates (W153)

**Wynik: PASS.** `sheet_template` is now resolved against the live `tp_base_templates` registry and is no longer classified as a legacy registry. No migration file was changed.

## Behavior

- SHEET-BASE (`2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1`) is returned by `GET /api/artifacts` as `source=canonical`, `legacy=false`, `scope=system`; the UI maps `system` to **Application**.
- Inventory #95 (`0a757a44-2ef4-466a-9231-dff14b89e515`) is returned as `source=canonical`, `legacy=false`, `scope=organization`, preserving the Northwind source record scope required by W118.
- A real card backed by the old `report_builder_templates` registry remains `source=legacy`, `legacy=true`.
- A sheet snapshot without a recognized canonical runtime is left untouched, so a real legacy snapshot is not relabeled.
- Workbook template backfill now indexes visible `tp_base_templates` rows idempotently and emits a complete canonical identity block.
- The existing workbook OOXML snapshot test moved from `scripts/dev/__tests__` to `tests/unit/scripts`, where the Vitest unit glob discovers it.

## Live API evidence

The proof uses the production `artifacts.routes.ts` router and `artifactRegistryService.ts` through HTTP (`supertest`) against a local PostgreSQL 18 restore. It refuses non-loopback database hosts and skips schema initialization.

- Dump: `/Users/piotrwisniewski/Developer/kopie/staging-pre-wdrozenie15-20260916T1344.dump`
- SHA-256: `0c59519c4b1dfc2d0860c9ca91984a9d87e54190e9fc9161b754a1390f08ffc3`
- Local target: `127.0.0.1:55433/consultify_template1c`
- Request: `GET /api/artifacts?artifactFamily=template&include=drafts&dedupe=false&limit=500`
- HTTP: 200; 106 visible template rows
- Receipt: `evidence/api-readback.json`

The proof intentionally runs only on the restored local copy. It does not connect to staging.

## Verification

- Contract, adapter, UI mapping, and discovered snapshot tests: **42/42 PASS**.
- Backend TypeScript build: **PASS**.
- Live API readback on the restored dump: **PASS**.
- `git diff --check`: **PASS**.
- Applied migrations changed: **none**.

Runbook:

```bash
TEMPLATE1C_PROOF_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55433/consultify_template1c' \
  LOG_LEVEL=error npx tsx scripts/dev/template1c-api-proof.ts
```
