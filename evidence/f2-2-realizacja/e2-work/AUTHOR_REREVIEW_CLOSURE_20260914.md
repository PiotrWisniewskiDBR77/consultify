# F2-2 Realizacja E2 — author closure after independent rereview

**Verdict: READY_FOR_EXACT_SHA_INDEPENDENT_REVIEW; all four HOLD findings are closed on the existing `88f1a1994d` line without a migration or rebase.**

## Closed findings

1. `f2-2-entry-contract.red.test.ts` no longer depends on the absent historical `coverage-29-initial.json`. It reads the tracked audit and checkpoint SSOT, preserves the 29/29 denominator, proves that incomplete items remain explicit, and checks the current Bank filter contract.
2. The weekly generator checks the affected-row count from `INSERT ... ON CONFLICT DO NOTHING`. A conflict now reads the persisted period, `asOf`, and payload and returns them with `created:false`; it never returns the losing process's in-memory receipt.
3. A real concurrent Gateway/JWT/PostgreSQL test issues two requests for the same organization and week. The result is exactly one HTTP 201, one HTTP 200, one persisted row, one `created:true`, and byte-equivalent persisted payload receipts.
4. The E0 dev render now uses the existing `bg-c-surface-subtle` and `text-c-text` tokens. Fresh light and dark screenshots were captured from the production-built focused harness with zero console or network errors.

## Verification

- Full Wpis 30 delta: **13/13 test files, 96/96 tests PASS**, `--retry=0`, with `DB_TYPE=postgres`, `RUN_DB_TESTS=1`, `MOCK_DB=false`.
- Gateway/JWT/RealPG: `executionWorkAnalysis.gateway.pg.test.ts` **3/3 PASS**, including actual concurrent generation; `initiativesExecutionRuntime.dropdown.pg.test.ts` **2/2 PASS**.
- Server TypeScript: `npx tsc -p server/tsconfig.json --noEmit` — exit 0.
- Focused esbuild: `executionWorkAnalysisService.ts` and `execution-risk-signal-e0.tsx` — exit 0.
- Focused production build: `npx vite build --config dev-render/vite.execution-risk-signal-e0.config.ts` — exit 0.
- Browser: fresh 1440x900 light and dark captures, inspected visually; zero console errors, page errors, and 4xx/5xx responses.
- Light screenshot SHA-256: `4e612bb261be374062066f336154ca1b990e40ae1a8aebd29391a432835dfdbd`.
- Dark screenshot SHA-256: `e52441ab9d70f3edc22a158596e9c142d53e7f1ba9836e611ecab1cd05fc8a44`.
- Token scan in the changed dev-render screen: zero `bg-c-surface-muted`, zero `text-c-text-primary`.
- `git diff --check`: PASS.
- Migration: none.

The freeze manifest is generated after the implementation commit and self-excludes the manifest file, so every other delta path is hashed against the exact candidate content SHA.
