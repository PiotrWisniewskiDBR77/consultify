# Q2 E4 author gate — 2026-09-14

**READY_FOR_INDEPENDENT_REVIEW** for candidate `d89bd146c17c8469827b9984e857976975c9e819` on base `29d1db9f00793dab6aeac5f68656200cddf9e529`.

## Behavior evidence

- Server flag default OFF: 1 file, 2/2 tests PASS.
- Fresh isolated PostgreSQL 18 (`cx-q2-execution-reports-pg`, host port 5293): Gateway/JWT/PG, real PDF, local SMTP success, SMTP 550 failure receipt behavior, canonical KPI snapshot and recurring canonical runner: 1 file, 5/5 tests PASS.
- Real StandardTable row -> StandardPreview, translated evidence relation without raw source UUID, translated pin control and unauthorized row actions disabled: 1 file, 1/1 test PASS.
- Full delta test inventory: 3/3 files, 8/8 tests PASS with `--retry=0`.
- `type-check:server` with 8 GB heap: exit 0.
- Focused esbuild: 6/6 server files and 6/6 production/browser files plus the Z-42 screen PASS. `dev-render/main.tsx` standalone bundle remains red on three inherited missing lazy-screen imports; the requested Z-42 route itself loaded and rendered successfully through Vite.
- Duplicate i18n keys: EN 0, PL 0. `git diff --check`: PASS.

## Visual evidence

- `light.png`: English first, full `ExecutionHub` shell, 1440x1200.
- `dark.png`: Polish second, full `ExecutionHub` shell, 1440x1200.
- Both show Menu 1/2/3, StandardTable, row kebab and selected six-block StandardPreview. Browser accessibility inspection found and the package fixed two inherited shell leaks used by this screen: untranslated pin and table-preset labels.
- Evidence PNG size: 136957 bytes, below 2 MiB.

## Boundaries

No migration, deployment, staging/demo/London/integration push or Railway change. Both `ENABLE_EXECUTION_REPORT_E4` and `VITE_EXECUTION_REPORT_E4` remain default OFF. Repo-wide frontend TypeScript remains red on inherited line errors and is not claimed green.
