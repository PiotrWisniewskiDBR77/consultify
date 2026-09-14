# Q2 F2-2 E4 Execution reports — independent exact-SHA review A — 2026-09-14

**HOLD** for exact implementation freeze `dac84d8a849029dfb6204792aa2eccd519ef6c27`: Wpis 42 requires Hub-shell screenshots in EN light, EN dark and PL, while the freeze contains only EN light (`light.png`) and PL dark (`dark.png`).

## Scope and identity

- Reviewed implementation freeze: `dac84d8a849029dfb6204792aa2eccd519ef6c27`.
- Base: `29d1db9f00793dab6aeac5f68656200cddf9e529`.
- Worktree was clean before review; `git diff --check` passed.
- Freeze manifest: 20/20 file hashes and sizes match the exact worktree; PNG evidence totals 136,957 bytes.
- No migration, deployment, protected-branch push or Railway change was performed.

## Blocking finding

### P1 — missing EN dark Hub-shell evidence

Wpis 42 explicitly requires `EN light/dark + PL`. The committed evidence has:

- `light.png`: English, light theme, complete ExecutionHub shell;
- `dark.png`: Polish, dark theme, complete ExecutionHub shell;
- no English dark-theme screenshot.

Both present screenshots show the module shell, Menu 1/2/3, StandardTable, selected row, row kebab and six-block StandardPreview. Add a third EN/dark screenshot through the same registered Z-42 harness, keep total package evidence below 2 MiB, refresh the manifest/freeze commit, and request a new exact-SHA review.

## Passed gates

- Full test-file inventory from the package delta: 3/3 files.
- `executionReportE4.serverFlag.routes.test.ts`: 2/2 PASS, `--retry=0`.
- `ExecutionReportE4Surface.canon.test.tsx`: 1/1 PASS, `--retry=0`.
- Fresh isolated PostgreSQL 18, Gateway/JWT/PDF/local SMTP integration: 5/5 PASS, `--retry=0`.
- Server TypeScript with `NODE_OPTIONS=--max-old-space-size=8192`: exit 0.
- Server feature gate is strict opt-in (`ENABLE_EXECUTION_REPORT_E4 === "true"`); frontend gate is strict opt-in (`VITE_EXECUTION_REPORT_E4 === "true"`), so both default OFF.
- Existing legacy execution-report route remains available while E4 is OFF; the new E4 route returns FEATURE_DISABLED.
- Tenant boundary is derived from the verified actor and used on report/snapshot reads. Report creation requires the actor to be the owner and a different approver; DECIDE and delivery require that approver. Domain publication verifies the immutable frozen hash and requires all delivery recipients to be DELIVERED.
- The E4 profile reuses canonical `reportDefinition` / `reportRun`, `runScheduledInitiativeWorkReport`, `deliverInitiativeWorkReport` and `UnifiedExportService`; no parallel lifecycle or delivery engine was introduced.
- Real SMTP success persists one distribution receipt. SMTP 550 leaves the run APPROVED, persists the failed recipient attempt, and creates zero distribution receipts.
- UI uses StandardModuleBar through ExecutionHub, StandardTable, StandardPreview, standard preset dropdowns, translated badges/labels and a row kebab. No native select, `primary-*`, noncritical crimson or raw source UUID was found in the E4 surface.

## P2 follow-up — test portability, nonblocking for this freeze

The RealPG test asserts the literal database name `consultify_q2`, creates tables without `IF NOT EXISTS`, and calls `smtp.close()` even when setup fails before the SMTP server exists. It passes 5/5 on the documented freshly recreated database, but a differently named or dirty reviewer database fails during setup rather than testing behavior. Make setup use a unique schema/database contract or assert `current_database()` from the supplied URL, and guard cleanup after partial setup.
