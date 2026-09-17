# PMO-1a v4 — RealPG/HTTP receipt (HOLD)

Status: **HOLD, not READY FOR CTO REVIEW**.

PMO-1a v4 fixes the UI/server readiness mismatch found in v3, but the full acceptance criterion from Wpis 222 is still not met: no real lifecycle-transition proposal POST reaches `200 + initiative_status_history` on the Northwind dump copy. The active 409 from v3 is gone for the unseeded 22-card set, but a seeded positive-path probe exposes the next backend barrier: `transformation_canonical_run_identity_missing`.

## Code SHA

- Branch: `codex/a-pmo1a-v4-w224-20260917`.
- SHA after rebase on current line: `ca9fda05e9a561a58a08f6844feb4fde2fd86ffc`.
- Backup: `origin/backup/codex/a-pmo1a-v4-w224-20260917-wip-20260917` at the same SHA.
- Base line after rebase: `487605f93f` (`origin/integracja/20260911` at measurement time).

## What changed

- Restored the v3 safeguards that were not present on the current line: primary-transition-only blockers, deduplication by readiness key, and runtime/legacy version fallback for analysis requests.
- Added PMO-1a v4 D-37 visibility to `GET /api/initiatives/:id/transition-preflight`: `transitionCase.status = ready | missing | ambiguous`.
- The PMO panel now disables `Request decision` with an explicit reason when transition-case lineage is missing or ambiguous instead of offering a button that POSTs into `INITIATIVE_TRANSITION_CASE_REQUIRED`.
- For 7-code lifecycle transitions, the request button no longer requires `canonicalVersion`; D-37 is the actual readiness gate.

## Static and unit evidence

- `PmoStageTransitionPanel.pmo1a.test.tsx` + `initiativeTransitionPreflightService.dec453.test.ts`: **19/19 PASS**.
- `npm run type-check:server`: **PASS**.
- Full `npm run type-check`: **156 line errors, 0 in changed files**.
- Commit hook passed: list canon, TERESA contract, artifacts, labels/language, triada, density, focus debt no-growth, Dockerfile flag guard, static env/esbuild proof, MVP final markers.

## RealPG/HTTP setup

- Dump: `/Users/piotrwisniewski/Developer/kopie/staging-pre-wdrozenie25-20260917T2048.dump`.
- Local container: `codex-pmo1a-v4-pg`, Postgres on `127.0.0.1:6458`.
- Restore: `pg_restore -j 2` from a file copied into the container, exit code 0.
- Migrations: `20262300_showcase_date_roll.sql`, `20262301_meetings_agenda_lifecycle.sql`, complete.
- Local API: `http://127.0.0.1:4214`, DB identity `localhost.:6458/consultify`.
- Login proof used only local-copy passwords for Northwind users.

## 22-card Northwind measurement before any D-37 seed

All reads below were real HTTP against the local API.

- Total cards: **22**.
- Runtime aggregate read: **8 × 200**, **14 × 404**.
- Transition case preflight: **22 × missing**.
- Active `Request decision`: **0/22**.
- Former v3 active 409 family (`APPROVED -> IN_EXECUTION`): **4 cards now disabled with `TRANSITION_CASE_MISSING`**.
- Other disabled/honest states: 4 × `OPEN_WORK_BLOCKS_CLOSURE`, 1 × `INITIATIVE_CARD_INCOMPLETE`, 8 × `NO_REVIEWER`, 5 × no recognized primary transition/end state.
- Result: **zero active buttons that would still POST into `INITIATIVE_TRANSITION_CASE_REQUIRED`**.

Evidence file: `measure-before-d37-seed.json`.

## Positive-path probe after local D-37 seed

I inserted a minimal transformation case, approved plan, and initiative artifact link **only in the local dump copy** for `Energy Monitoring and ISO 50001` (`29b45f98-35d5-564c-a88e-ef917c3be2fb`). After that:

- 1/22 cards became `transitionCase=ready` and `Request decision` ready.
- POST as James -> James was correctly blocked by `initiative_lifecycle_self_review_denied`.
- POST as Sarah Mitchell -> James passed D-37 and self-review, but failed with `409 transformation_canonical_run_identity_missing`.
- `initiative_status_history` stayed **3 -> 3**.

Evidence file: `measure-after-d37-seed.json` plus the Sarah POST result in this receipt.

## Verdict

HOLD remains. PMO-1a v4 closes the specific UX defect from v3 — no enabled button now falls into `INITIATIVE_TRANSITION_CASE_REQUIRED` on the unseeded 22-card set — but the Wpis 222 acceptance proof still requires at least one real POST ending in `200` and a history row. The next blocker is not UI readiness; it is missing canonical run identity for the transformation case path.

## Next fix required

Before READY, decide whether PMO-1a should:

1. create/attach the missing canonical run identity when it creates or uses a transition case, or
2. include canonical-run-identity readiness in the same preflight and keep the request disabled with a precise reason until the identity exists.

Only after that should we repeat: 22/22 measurement, one POST `200`, `initiative_status_history` increment, screenshots EN light/dark ON/ON and OFF/OFF.
