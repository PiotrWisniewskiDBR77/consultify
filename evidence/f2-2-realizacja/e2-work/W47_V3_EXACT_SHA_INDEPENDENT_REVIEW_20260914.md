# S4 F2-2 Praca — W47 v3 exact-SHA independent review

**Verdict: ACCEPT.** Exact freeze `861db8842fcc81a6538a0f25e86e0387e33230aa` removes all ten unsafe casts added by the S4 delta, restores both source-contract tests, and preserves the E2 behavior on exact base `eba9d72ad9c730728b212ee7826164519e4d095c` without a candidate-new red.

## Exact identities and manifest

- Base: `eba9d72ad9c730728b212ee7826164519e4d095c`
- Content: `18496d866221cd4defca705a39fd5e6e6d7fd822`
- Freeze: `861db8842fcc81a6538a0f25e86e0387e33230aa`
- The freeze is the direct child of the content commit.
- The manifest is self-excluding and contains **76/76** content-commit blobs. Independent recomputation found **0** missing files, byte mismatches, or SHA-256 mismatches.
- Manifest-listed evidence is exactly **1,502,178 B**; with the self-excluded 15,106 B manifest, the review package is **1,517,284 B**, below 2 MiB.

## W47 correction and identity contract

- Positive lines in `ExecutionHub.tsx` relative to exact base contain **0** `as any`; all ten casts identified by W47 are absent. The file still contains inherited casts, but its total is exactly base-equal (**122** at base and content).
- `ExecutionHub.daneRealne.source.test.ts` and `ExecutionHub.kokpitRaidOblozenie.source.test.ts` are byte-identical to base. Fresh candidate runs pass **12/12** and **8/8** with unchanged assertions.
- `buildExecutionBankRows` defaults to `LEGACY`. `ExecutionHub` explicitly requests `INITIATIVE` for the enabled four-button surface and explicitly preserves `LEGACY` when that surface is disabled.

## Independent test and PostgreSQL evidence

- Every one of the 18 exact-delta/source-contract files was run separately with `--retry=0`: **167/167 PASS**, **0 FAIL**, Vitest **0 SKIP**.
- The change/progress golden flow was additionally rerun with an explicit local PostgreSQL identity and `MOCK_DB=false`: **12/12 PASS** with the database path exercised, including tenant isolation, idempotent replay, and concurrent same-key handling.
- Fresh Gateway/JWT/PostgreSQL runs with `MOCK_DB=false`: execution work analysis **3/3 PASS**, initiatives execution dropdown **2/2 PASS**; both collected, no skip.
- The author matrix contains exactly **171** importer sibling rows. Independent parsing confirms the declared classification totals: 124 unchanged green/skip, 36 inherited nonzero identical, 1 inherited nonzero improved, 4 expanded green, 4 additive green, and 2 candidate fixes of base reds. Every candidate non-green row is tied to an exact-base identical or improved result; candidate-new/worse reds: **0**.

## Static, build, and canon gates

- Fresh server TypeScript with 8 GiB heap: exit **0**.
- Fresh candidate front TypeScript: **177** diagnostics, **0** in `ExecutionHub.tsx`, `executionBankModel.ts`, and `executionRealData.ts`; the exact-base measurement recorded by CTO and the author is **189**, so the delta is **-12**.
- Fresh production build: exit **0**, **10,747** modules.
- Fresh list-canon: **349/349**, exit 0. Fresh artifact ratchet: crimson/card-N/danger **8/0/117**, exit 0.
- Recorded language count has no growth; duplicate i18n keys are EN **0** / PL **0**. `git diff --check` is clean and no real conflict marker was added.

## UI evidence

All eight 1440x900 full-`ExecutionHub` screenshots were visually inspected: populated/empty, EN/PL, light/dark. The populated state shows **3/3/6** items across the three time windows and the `Project` column; the empty state uses the canonical table empty treatment. Their combined size is **710,839 B** and all **8/8** byte counts and SHA-256 hashes are identical to the prior accepted screenshot set. The capture receipt records zero console errors, page errors, and HTTP 4xx/5xx responses.

No implementation was changed by this review. There is no migration, deploy, or protected-branch push.
