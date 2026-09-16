# OPEN-1 test receipt

Status before CTO review: **READY FOR CTO REVIEW, not frozen**.

## Focused behavior

- Assessment, Audit, Execution focused suite: 9 files, 64/64 PASS, `--retry=0`.
- Execution deep-link family after review fix: existing `ExecutionHub.workDeepLink.source.test.ts` 3/3 PASS; OPEN-1 task routing test and surface tests are included in the next combined rerun.
- RealPG audit program/pack scoping: 1 file, 4/4 PASS, `--retry=0`.
- Targeted esbuild: 10/10 changed production files PASS.
- Server TypeScript: full `type-check:server`, RC 0.
- Frontend TypeScript: `TIMEOUT_120 / NOT_PROVEN` under W20; it was not repeated without a new cause.

## Browser evidence

Five EN/light, 1440×900 real-component captures are stored beside this receipt:

1. Assessment Insights row → session preview with `Open session`.
2. Audit Sessions row → loaded lifecycle and criteria workspace entry.
3. Audit proposal → registration → `Open initiative`.
4. Execution Decisions row → preview with `Open` by decision id.
5. Execution Work row → task preview with `Open`.

The captures prove list-to-preview/open affordances. Route behavior is covered by focused tests; no staging navigation was performed.

## Scope hold

W116 assigns Codex-1 to Assessment and Execution. Audit production/test/evidence changes remain a separately identifiable, uncommitted segment until the CTO explicitly assigns or accepts that portion.
