# PMO-1a v4c receipt — W231/W232

Result: READY FOR CTO REVIEW. PMO decision request cards no longer expose a disabled/dead button without an honest reason when the transition target is outside the PMO proposal map.

## Scope

- Branch: `codex/a-pmo1a-v4c-w231-20260917`.
- Base: `origin/integracja/20260911` = `e05ea74752eee242ad38f64c036cf50f4b2e3f73`; `origin/integracja/20260911` is an ancestor of the branch head.
- Qoder D reservation respected: `src/components/Initiatives/InitiativeDocumentView.tsx:1570-1590` was not edited.
- Production/staging/demo were not touched. RealPG evidence used a local Docker copy of `~/Developer/kopie/staging-pre-wdrozenie28-20260918T0037.dump` on `127.0.0.1:6458`.

## Product change

- Added an explicit PMO blocked reason for `primary && !target && !isAnalysisBoundary`: `This transition is not supported by the PMO decision request yet.`
- Added EN/PL i18n keys for the new PMO reason.
- Added a unit test for an unsupported `targetStatus` outside the PMO request map; the button stays disabled, renders a reason, and does not call `requestDecision`.
- Corrected the RealPG measurement helper:
  - removed `APPROVED: 'EXECUTING'` from `TARGET_BY_STATUS` because the UI PMO request map does not support it;
  - filters primary transitions by `roleAllowed`, matching the panel path;
  - removed inline login password and reads runtime proof credentials from env/DOSTEP.
- Screenshot helper now accepts a local Chrome executable path, can target a specific initiative/title, and asserts the blocked reason text when required.

## RealPG evidence

Local setup:

- Docker container: `codex-pmo1a-v4-pg`, image `pgvector/pgvector:pg17`, port `6458`.
- Dump: `staging-pre-wdrozenie28-20260918T0037.dump`.
- Backend: `http://127.0.0.1:4214`, `NODE_ENV=development`, `CI=true`, `DB_MANAGED_SCHEMA=off`, local Postgres only.
- Frontend: `http://127.0.0.1:4215`.
- Local-copy auth seed: updated only the two existing Northwind users in the copied DB (`james.whitfield@northwind.example`, `sarah.mitchell@northwind.example`) so the API login path could be exercised on the dump. No staging/demo DB was used.

Measurement artifacts:

- `measure-v4c-realpg.json`
- `measure-v4c-ui-reason-scan.json`

Corrected RealPG measurement summary:

- `before-seed`: total 22, ready 0, case missing 22.
- `case-without-identity`: total 22, ready 0, execution_context_missing 1.
- `case-with-identity-not-scheduled`: total 22, ready 0, source_not_ready 1.
- `case-with-identity-scheduled`: total 22, ready 1, case ready 1.
- Positive flow: proposal `201`, review `200`, execution `201`; `initiative_status_history` count `3 → 4`; final status `IN_EXECUTION`.

UI-pattern scan summary:

- total: 22
- proposalReady: 1
- disabledWithReason: 19
- noDecisionButton: 2
- deadButtonWithoutReason: 0

The disabled-card screenshot target was `Digital Work Instructions` (`80b23c87-6806-5ddb-8744-2326c4c50f36`), which had `primaryTarget=APPROVED`, `target=null`; the screenshot helper asserted the visible reason text.

## Screenshots

- `screenshots/pmo1a-v4c-onon-disabled-reason-light.png` — ON/ON light, Stage Transition visible, blocked reason visible.
- `screenshots/pmo1a-v4c-onon-disabled-reason-dark.png` — ON/ON dark, Stage Transition visible, blocked reason visible.
- `screenshots/pmo1a-v4c-offoff-light.png` — OFF/OFF light, Stage Transition absent.
- `screenshots/pmo1a-v4c-offoff-dark.png` — OFF/OFF dark, Stage Transition absent.

Each screenshot is below 2 MB.

## Validation

- `npm exec vitest -- run src/components/Initiatives/__tests__/PmoStageTransitionPanel.pmo1a.test.tsx server/src/services/initiative/__tests__/initiativeTransitionPreflightService.dec453.test.ts --retry=0 --no-file-parallelism` — PASS, 2 files / 22 tests.
- `npm exec vitest -- run src/components/Initiatives/__tests__/pmoContrast.pmo1a.test.ts --retry=0 --no-file-parallelism` — PASS, 1 file / 3 tests.
- `npm run type-check:server` — PASS.
- `node --check docs/program/PMO_1A_V4_W224_20260917/scripts/pmo1a_v4b_realpg.mjs` — PASS.
- `node --check docs/program/PMO_1A_V4_W224_20260917/scripts/pmo1a_capture_shell.mjs` — PASS.
- `node --check docs/program/PMO_1A_V4_W224_20260917/scripts/pmo1a_v4c_ui_reason_scan.mjs` — PASS.
- Full frontend `npm run type-check` remains red outside this delta: 139 TS error lines, 0 in changed files.

## Known limits

- The local proof used `DB_MANAGED_SCHEMA=off`; `/api/ready` reports `ready` with ledgers marked as not evaluated by operator choice. This matches the local dump proof mode and does not claim migration readiness.
- The auth password seed is a local-copy proof step only and must not be applied to staging/demo/production.
