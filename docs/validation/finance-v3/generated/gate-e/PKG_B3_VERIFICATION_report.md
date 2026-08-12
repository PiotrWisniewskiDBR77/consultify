# Pakiet B3 (Valuation API) — INDEPENDENT VERIFICATION report

Verifier: independent reviewer, not the package author. Mandate: try to disprove the author's own
`PKG_B3_VALUATION_API_report.md`, not confirm it. Every number below was measured directly by this
verifier — nothing is taken from the author's report on trust.

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-b3-valuationapi`
Branch: `codex/fv3p-b3-valuationapi` @ `b62a2cefd4`
Base: `45c39d68d0`
Isolated DB: `postgresql://piotrwisniewski@127.0.0.1:54330/b3_verify` (fresh clone of `fv3_template`
via `/Users/piotrwisniewski/fv3-pg/newdb.sh b3_verify` — NOT the author's own `b3_valuation` DB).

## Verdict table

| # | Twierdzenie autora | Mój niezależny pomiar | Wynik |
|---|---|---|---|
| 1 | 21 nowych endpointów, 53 łącznie, baza 32 | `grep -c "router\.(get\|post\|put\|patch\|delete)("` per file: `valuation.routes.ts`=21; sum of the other 9 route files at HEAD=32 (verified per-file, not concatenated); 21+32=53. `git show 45c39d68d0:...` for each of the 9 pre-existing files individually sums to exactly 32. | **POTWIERDZONE** |
| 2 | `tsc --noEmit` exit 0, zero errors | Ran twice, independently, `NODE_OPTIONS=--max-old-space-size=12288`, explicit `echo EXIT_CODE=$?` captured to a log file both times. Both runs: log contains exactly `EXIT_CODE=0` and nothing else (no truncated/empty-log ambiguity — the OOM-mimics-success trap the brief warned about does not apply here since I captured a real, non-empty, single-line success marker both times). | **POTWIERDZONE** |
| 3 | 31/31 testów zielonych | Ran all 3 official files combined from `server/`: `31 passed (31)`, but process exited **1** due to an unrelated `Unhandled Rejection` (`duplicate key value violates unique constraint "pg_type_typname_nsp_index"` on `ai_ideas` — a concurrent-`initDb()` schema-sync race, nothing to do with Valuation code). Re-ran all 3 files **individually**: 14+11+6=31 passed, **exit 0 all three times**, no unhandled rejections. This independently reproduces the SAME class of flake the author's own report discloses (they hit a different race, on `knowledge_docs.file_hash`; I hit one on `pg_type`/`ai_ideas`) — same root cause (concurrent `initDb()` schema-sync inside one vitest process), different specific column/type, confirming it is a real, reproducible, order-dependent environmental issue and not a cherry-picked excuse. | **POTWIERDZONE** (test count exact; combined-run exit-code flakiness independently reproduced and attributed to the same non-Valuation root cause the author already disclosed) |
| 4 | Dowód montażu (404-z-code vs 404-bez-code) dla 21 endpointów | Read `valuation.routes.ts` in full (all 21 handlers) and cross-referenced every route against all 3 test files. The literal "404-with-code / 404-without-code / pre-B3-router" 3-way ceremony is done explicitly for only **2 of 21** endpoints (`GET /variants/:id` in the main file; `GET /methods/:id/sensitivity/:gridLabel` in the review supplement). However, all 21/21 endpoints are independently, unambiguously provable-mounted via at least one real 2xx response with real persisted-data content somewhere in the 3 files (a truly unmounted Express route can never produce a real 2xx) — verified by grep across all three test files. The author's own report states this explicitly (§2, "one explicit differential test... structural proof for the whole file" + a per-endpoint evidence table) — it does not overclaim 21 literal 404-ceremonies. | **POTWIERDZONE** (claim as actually written, not as a stronger claim I might have assumed) |
| 5 | Macierz cross-tenant, niezależny odczyt SQL | Did NOT reuse the author's `valuation-cross-tenant.routes.pg.test.ts`. Wrote a standalone script (`tsx`, not vitest) using a genuinely different mechanism: two REAL `http.Server` instances (`app.listen(0)` + node's native `fetch`, not supertest's in-process driver) for org A / org B, and the `psql` CLI binary directly (not the app's own pg client) for before/after row counts and content checks. Attacked all 8 write-mutating endpoint families + 2 read/leak checks as org B against org A's real resources (PATCH variant rename, PUT wacc-inputs, POST methods, POST methods/basket, POST compute/dcf, PUT bridge, POST sensitivity, POST advisor/generate, POST compare-variants, GET results body-leak). **10/10 passed**: every write attempt returned 404 with zero rows created/mutated for org B and org A's data verified unchanged via direct SQL; the results-leak check confirmed the 404 body carries no headline EV data. | **POTWIERDZONE** |
| 6 | Bug w `writeSensitivityGrid()` naprawiony (candidate id zamiast id z ON CONFLICT) | `git show 9604652e27:...valuationSensitivityService.ts` → reverted the file to its pre-fix WIP state. Ran the author's own regression test (`★ REGRESSION...` in `valuation-b3-review.routes.pg.test.ts`) against the reverted code: **RED**, `AssertionError: expected 'a64284a7-...' to be '0115eb80-...'` — the exact symptom described (repeat POST returns a fresh, orphaned id). Restored the fix (`git checkout --`). Re-ran the same test: **GREEN**. Full revert→red→restore→green cycle completed. Note: the author's own report (§7 item 5) states the bug was "confirmed via static analysis" only — they did NOT themselves do this revert/red/restore cycle. This verification closes that gap. | **POTWIERDZONE** (and independently strengthened — author had not proven their own regression test catches the bug; I did) |
| 7 | Dowód N/A ≠ PLN 0, trzy stany MISSING/PRESENT_ZERO/PRESENT_NONZERO | Ran the `★ TRZY STANY...` test in `valuation-b3-review.routes.pg.test.ts` as part of both the full-suite run and the per-file run: green both times. Read the test body directly — it creates 3 methods, sets one to each of the three states via the exact production `setMethodResult()` function (not a bypass), and asserts all three are simultaneously distinguishable through the same `GET .../methods` response AND independently via raw SQL read-back (`result_value_status` + `result_ev_decimal` columns), plus confirms `GET .../results` headline resolver reports `source:'NONE'` rather than silently picking one of two ready-but-unweighted methods. Genuinely three distinguishable states, not two states with an extra label. | **POTWIERDZONE** |
| 8 | P1 NIENAPRAWIONY: `POST compute/dcf` powtórzony bajtowo identycznie rzuca 500 zamiast idempotentnego powtórzenia | Read `runDcfFcffValuation()` (`valuationComputeService.ts:442-464`): `const { job } = await computeJobService.enqueue(...)` destructures away `wasExisting` (declared at `computeJobService.ts:94`, set `false`/`true` at lines 125/132), then unconditionally calls `claimById()` (`computeJobService.ts:312`, `WHERE ... status = 'queued'`), and throws a raw `Error` at line 460-463 if `claimed` is null. Wrote my OWN standalone, **unbranched** test (not the author's branching "DISCOVERY" test) that builds a full real fixture (baseline outputs, lineage edge, WACC), calls `compute/dcf` once (200, job → `succeeded`, confirmed via SQL), then calls it again byte-identically. My test asserts, without any `if`, that the second call is **500** with message matching `/failed to self-claim just-enqueued job/` and `/no longer 'queued'/` — **PASSED**, confirming the bug fires exactly as claimed, not just "sometimes" under the author's branch-either-way test. Grepped the other 3 services: `baselineComputeService.ts:429`(enqueue)/`442`(claimById)/`447`(if !claimed); `kpiComputeService.ts:637/650/655`; `predictionComputeService.ts:322/335/340` **and** a second occurrence at `549/562/567`. All four sites use the identical `const { job } = await enqueue(...)` → unconditional `claimById()` → throw-on-null pattern; `wasExisting` is read nowhere in the codebase outside `computeJobService.ts`'s own return type declaration. | **POTWIERDZONE** — P1 real, reproduced independently and unambiguously; shared pattern confirmed in all 4 services (5 call sites total, since predictionComputeService.ts has two) |
| 9 | Kontrole negatywne — każdy test bramkujący da się zaczerwienić | Directly verified #6 (writeSensitivityGrid) via full revert/red/restore cycle (see row 6). The other 3 negative controls in `valuation-b3-review.routes.pg.test.ts` (§2: two `chk_finance_methods_result_matches_readiness` INSERT rejections + one `trg_finance_valuation_methods_weight_sum` UPDATE rejection) exercise DB-layer CHECK constraints and a DEFERRABLE trigger that were created in migration `20260809_finance_v3_d09_valuation_01_tables.sql` / `..._02_integrity.sql` — **pre-existing from Gate D / WP-D09, not code Pakiet B3 wrote**. These are genuine negative controls of real, currently-active DB constraints (confirmed the constraints exist in the migration files at the cited names), but reverting Pakiet B3's OWN service-layer code would not "un-red" them, because the DB layer is the actual backstop being tested, not B3's app-layer validation — the author's own report states this caveat explicitly and correctly (§7, "layered-defense caveat"), rather than silently claiming a green negative control proves what it does not. | **POTWIERDZONE** for the one B3-owned fix (#6, fully cycled); the other 3 are correctly and honestly caveated by the author as DB-layer-only, not falsely claimed as B3-code negative controls |
| 10 | Allowlista: 13 plików, brak dotknięcia frontend/`financeV2.api.ts`/`financeV2.types.ts` | `git diff --stat 45c39d68d0..HEAD`: exactly **13 files** — 1 report doc, 3 test files (all under `server/src/routes/v8/finance-v2/__tests__/`), `finance-v2/index.ts`, `finance-v2/valuation.routes.ts`, and 7 `services/finance/canonical/valuation*.ts` files. Zero files under `src/` (frontend), zero touches to `financeV2.api.ts` or `financeV2.types.ts`. | **POTWIERDZONE** |
| 11 | Autor nie osłabił testów (brak skip/only, brak usuniętych asercji) | `grep -nE "\.(skip\|only)\(\|xit\(\|xdescribe\("` across all 3 valuation test files: **zero matches**. `git log --follow` on each of the 3 test files: `valuation.routes.pg.test.ts` and `valuation-cross-tenant.routes.pg.test.ts` each have exactly ONE commit in their history (`9604652e27`, the WIP commit that created them) — never touched again, so nothing to weaken after creation. `valuation-b3-review.routes.pg.test.ts` has exactly one commit too (`48d1a8d327`, created and never modified since). No assertion-weakening possible because no file was ever edited after its creating commit. | **POTWIERDZONE** |

## P1 reproduction — full detail

**Confirmed independently, unbranched test, all 4 affected services identified:**

| Service | `enqueue()` call (destructures away `wasExisting`) | `claimById()` call | `if (!claimed) throw` |
|---|---|---|---|
| `valuationComputeService.ts` | line 442 | line 455 | line 460 |
| `baselineComputeService.ts` | line 429 | line 442 | line 447 |
| `kpiComputeService.ts` | line 637 | line 650 | line 655 |
| `predictionComputeService.ts` (site 1) | line 322 | line 335 | line 340 |
| `predictionComputeService.ts` (site 2) | line 549 | line 562 | line 567 |

My independent test file (kept, see below) forces the exact scenario: WACC set → first `compute/dcf`
call succeeds (200, job status becomes `succeeded`, confirmed via SQL before the second call) → second
byte-identical call returns **500**, body `error` matches `/failed to self-claim just-enqueued job/`
and `/no longer 'queued'/`. This removes the ambiguity of the author's own "DISCOVERY" test, which
branches on `second.status === 200` and would therefore pass silently even if the bug were fixed
differently than expected, or regressed to a different failure mode.

## Bug-fix regression cycle (claim #6) — full detail

1. `git show 9604652e27:server/src/services/finance/canonical/valuationSensitivityService.ts` >
   (overwrite) — reverts to pre-fix state (`return { gridId }` using the locally-generated candidate
   id unconditionally).
2. Ran `★ REGRESSION...` test → **RED**: `expected 'a64284a7-...' to be '0115eb80-...'` (Object.is
   equality failure on `secondGridId === firstGridId`) — the exact symptom the fix commit's message
   describes.
3. `git checkout -- server/src/services/finance/canonical/valuationSensitivityService.ts` — restores
   the fix.
4. Re-ran the same test → **GREEN**.

This is a real fix and a real regression test. The author's own report only claims "confirmed via
static analysis" for this item (§7, item 5) — they did not themselves run this revert/red/restore
cycle. This verification closes that specific gap.

## New defects found by this verification, NOT flagged by the author

None. Every item this verifier checked independently either confirmed the author's own claim exactly,
or — for claim #6 — went one step further than the author's own evidence (author verified the fix by
reading code + writing a regression test; verifier additionally proved the regression test actually
catches the reverted bug). No new P0/P1/P2 defects were found beyond what the author's own report
(§8, idempotency P1) already discloses.

## Independent verification artifacts added (kept, not removed)

- `server/src/routes/v8/finance-v2/__tests__/valuation-independent-verifier.pg.test.ts` — the
  unbranched P1 reproduction described above (claim #8). Added via `git add -f` per instructions.
- The cross-tenant probe script (claim #5) was a throwaway `tsx` script, run from a temporary copy
  inside the worktree and then deleted — not part of the permanent suite, since its findings are
  already captured in this report and its assertions duplicate (by design, via a different mechanism)
  what `valuation-cross-tenant.routes.pg.test.ts` already covers.

## Environment notes

- Machine was under very heavy concurrent load (dozens of unrelated `tsc`/`vitest` processes from
  other sessions observed via `ps aux` throughout this verification) — consistent with the brief's
  warning; commands took longer than normal but every command that completed returned an unambiguous,
  captured exit code. No result in this report rests on an assumed-successful command whose exit code
  was not explicitly checked.
- Isolated DB `b3_verify` (127.0.0.1:54330) used throughout, cloned fresh from `fv3_template`, never
  the author's own `b3_valuation` DB. Dropped at the end of this session.

## Final verdict: **PASS**

All 11 claims independently measured and confirmed as stated (claim #4 confirmed against the literal
wording of what the author's report actually asserts, not a stronger reading of it; claim #6
independently strengthened beyond the author's own evidence). The one confirmed defect (P1,
idempotent-replay 500 on `compute/dcf`, shared across 4 compute services) is real, independently
reproduced with an unbranched test, honestly disclosed by the author as unfixed and out of this
package's allowlist to fix solo, with full root cause and blast radius already documented in the
author's own report — this verifier's independent reproduction corroborates that write-up without
finding it understated. No evidence of test-weakening, allowlist violations, or overclaimed coverage
was found.
