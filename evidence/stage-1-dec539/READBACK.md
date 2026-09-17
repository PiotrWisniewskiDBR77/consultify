# STAGE-1 DEC-539 — current-base readback

Status: **READY FOR CTO REVIEW**.

- Base: `be57c5dae677844a224d78d874d3ab52444a882d`.
- Branch: `codex/stage-1-dec539-final-20260917`.
- Product migration: `20262260_initiatives_lifecycle_stage.sql`, SHA-256 `6d0722817611d37adeb885e6d7a9484ef1fda02a4a5980069331393a07e91f2a`.
- Flags: `VITE_INITIATIVES_STAGES_12` is exact-true and default OFF; Docker ARG is present.

## Current-base evidence

- Canonical fresh local PostgreSQL: **926/926 migrations applied**, replay `Applying migrations: 0`, ledger checksum equals the source checksum above.
- RealPG behavior: `h1c` + `h1d` + `dwaMagazynyRozjazd` = **15/15 PASS**, `--retry=0`, one worker. This includes SCHEDULED preservation, GO/no-GO, cron candidate behavior and two-store readback.
- Focused unit/UI family: **60/62 PASS**. The same two P11 tests fail on the untouched base (**23/25 PASS** there): stale `PLANNING -> planned` expectation and a source-text assertion that still looks for status-history SQL in `InitiativeController` after that writer moved to `initiativeTransitionService`. STAGE-1 regression delta is zero; new/changed behavior tests are green.
- TypeScript, exact lock `@types/node 22.19.3`: server base **0**, candidate **0**; frontend base **152**, candidate **150**.
- Repository gates: language PASS with no increase; Docker flag guard `197` analyzed / `0` missing; list canon `346=346`; artifact crimson `8=8`; `git diff --check` PASS.
- New `as any` delta: **0**.
- Final independent re-review: **ACCEPT, P0=0, P1=0, P2=0**; reviewer-selected **24/24 PASS**.
- RED→GREEN lineage: W105 recorded six RealPG failures in `f21a049d55` (stage degradation/start-execution); the corrected current-base port passes the expanded 15-case family.

## OFF/ON contract

- OFF (`unset`, `false`, `0`) preserves the legacy seven-code `status` and `displayStatus` across chip, Next gate, presets, Plan and the planning portfolio read.
- ON (`true`) presents the persisted twelve-stage `lifecycleStage` while keeping `status` as the seven-code compatibility projection.
- The frontend status adapter imports the canonical maps from `server/src/constants/initiativeLifecycleStages.ts`; it no longer carries separate `runtimeToStatus`, `statusToRuntime` or `legacyToRuntime` dictionaries.
- SQL keeps the immutable migration snapshot required to backfill rows; runtime mapping has one source.

## Target-ledger evidence

The local staging dump `/Users/piotrwisniewski/Developer/kopie/staging-pre-wdrozenie14-20260916T1236.dump` is PostgreSQL 18 custom format, 236 MB, SHA-256 `f3c466ec3fe7889b0a49942fd9487f077c07729388051720c82bc45f5e10647c`. A read-only `pg_restore` extraction of `public.schema_migrations` contains `20262200`, `20262210`, `20262220`, `20262230` and `20262240`, but **no `20262260`**. The migration id and checksum have therefore not been applied in that target snapshot.

## Boundaries

No staging/demo/Railway write, deploy, protected-ref push or screenshot was performed. All database work used a disposable local container at `127.0.0.1:6454`; it and its volume were removed after the run.
