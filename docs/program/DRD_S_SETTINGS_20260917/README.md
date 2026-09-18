# DRD-S · Session settings panel — evidence

Status: code READY for CTO review. Base while writing: `origin/integracja/20260911`; package branch `codex/a-drds-settings-w236-20260917`.

## Scope

- Adds `VITE_DRD_SESSION_SETTINGS`, default OFF by parser behavior and Docker ARG/ENV wiring.
- When OFF, `MethodWorkspaceShell` keeps the legacy four-column Settings strip unchanged.
- When ON for DRD, Settings replaces the legacy strip with `ArtifactRightPanel` and six sections: Identity & scope, People & roles, Run plan, Quality & approvals, Outputs & sharing, History & comparison.
- No migration and no new table. Missing model fields are shown honestly as absent/read-only; S-2/S-3 remain migration packages.
- Frozen raw output remains available inside technical details.

## RealPG dump 28

Dump: `/Users/piotrwisniewski/Developer/kopie/staging-pre-wdrozenie28-20260918T0037.dump`.
Restore command used a local `postgres:17-alpine` container. Restore exit was `1` only because the dump references `vector`/`ai_knowledge_embeddings`; the DRD core tables restored and were queryable.

Counts:

| table | rows |
|---|---:|
| `method_sessions` | 20 |
| `method_session_roles` | 24 |
| `method_approvals` | 2 |

`method_sessions` already has the fields consumed by this package: `id`, `name`, `organization_id`, `project_id`, `method_pack_id`, `method_pack_version`, `state`, `mode`, `owner_user_id`, `version`, `frozen_snapshot_id`, `revision_of_session_id`.

Example DRD rows from dump 28 include `Northwind 2027 — Digital Readiness Diagnosis`, frozen, version 6, with `project_id=northwind-drd-2027-v2`, and `Northwind 2027 — Digital Readiness Diagnosis · Q3 re-assessment`, frozen, version 6, with `project_id=northwind-drd-2027-q`.

## Validation

- `npx vitest run src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.test.tsx src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.frozenShell.test.tsx --retry=0` → PASS, 2 files, 21 tests.
- `npx esbuild src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx --bundle --platform=browser --format=esm --jsx=automatic --tsconfig=tsconfig.json --alias:@=./src --external:react --external:react-dom --external:react/jsx-runtime --external:react-router-dom --external:react-i18next --external:lucide-react --outfile=/tmp/drds-settings.js` → PASS.
- `git diff --check` → PASS.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --project tsconfig.json --pretty false` → FAIL on existing repo-wide errors outside changed DRD-S files; grep of output for `DrdHttpMethodWorkspaceScreen`, `MethodWorkspaceShell`, `drdSessionSettingsFlag`, and `DrdHttpMethodWorkspaceScreen.test` returned 0 matches.
- `npm run check:flagi:dockerfile` → FAIL on 13 pre-existing missing ARGs (`VITE_ANALYTICS_DEBUG`, `VITE_API_URL`, `VITE_APP_ENV`, `VITE_BUILD_AT`, `VITE_BUILD_SHA`, `VITE_DEV_DIAGNOSTICS`, `VITE_FF_`, `VITE_GA_MEASUREMENT_ID`, `VITE_I18N_DEBUG`, `VITE_NAV_DEBUG`, `VITE_SCREAMING_SNAKE`, `VITE_STORE_DEBUG`, `VITE_X`). New `VITE_DRD_SESSION_SETTINGS` is present in `Dockerfile.api` and `Dockerfile.frontend`.
