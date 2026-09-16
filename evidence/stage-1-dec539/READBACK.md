# STAGE-1 / DEC-539 — readback

Verdict: **READY FOR CTO REVIEW**.

## Real PostgreSQL

- Isolated database: `stage1_full_dec539` on `cx-codex6-pg` (`6457`), cloned from the strict migrated `cx6_swieza` schema.
- Schema before the package: **1,811 public tables**, **12 initiatives**.
- First migration run: aggregate backfill `0`, deterministic seven-code mapping `12`.
- Readback: `12/12` rows have `lifecycle_stage_source='mapped'`; invalid `status` / `lifecycle_stage` pairs: `0`.
- Second migration run: aggregate update `0`, mapped update `0`.
- Additive rollback probe: `UPDATE ... SET lifecycle_stage=NULL` cleared `5` rows in the focused fixture; a subsequent migration restored them without dropping either column.
- The disposable database was dropped after the readback.

## Behaviour and static gates

- Targeted Vitest: **6 files, 46/46 tests passed**, `--retry=0`.
- Frontend TypeScript: `npm run type-check` — **0 errors**.
- Server TypeScript: `npm run type-check:server` — **0 errors**.
- Per-file esbuild: all changed runtime entry points passed.
- `git diff --check`: passed.

## Browser evidence

- URL: `http://127.0.0.1:4214/?screen=inicjatywy-lista&lang=en&theme=light`
- Image: `initiatives-12-stage-dropdown-en-light-1440x900.png`.
- The open Status dropdown shows the exact 12-stage vocabulary in one list. The sample-data harness still emits unrelated 404s for organization/users/admin-flag endpoints; the Initiatives list and dropdown render successfully.

No staging write, deployment, Railway change, or protected-branch push was performed.
