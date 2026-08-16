# Final acceptance gate — 14c8852a7

- Acceptance SHA: `14c8852a71cdc5c8bf723a9b21f5e1cc00a467f5`
- Matrix SHA-256: `e687bc74fcf643c51cc8f0e1d21d998c96d1a984a6ebda72e9013fce9aad7bf1`
- Matrix validation: 175 classified files; isolated 72, realDB 64, legacy PostgreSQL port 27, external runtime 2, flaky harness 3, stale harness 6, performance 1.

## Standard gate

The standard gate ran on `0345220974ef8f6eb5fef4959c71b51cc72953d2` with all 12 shards strictly sequential (`CLEANUP_TEST_CONCURRENCY=1`). It discovered 4,058 files and finished with 40,206 tests: 39,562 passed, 0 failed, 625 pending, 19 todo; missing, unexpected, and non-green file lists were empty.

The only paths changed between `034522097` and acceptance `14c8852a7` are:

- `tests/integration/routes/pmo-analysis.test.js`
- `tests/integration/routes/capacity.test.js`

Both paths are explicitly owned by `gates.realdb.files`, are excluded from the standard gate, and are absent from `gates.isolated.files`. The cleanup matrix itself is byte-identical at the two SHAs. Consequently the standard and isolated input sets are unchanged; `scope-equivalence.json` records this bounded reuse decision machine-readably. The original standard summary SHA-256 is `6bb734d8966b2206142f6069017a63e1bcad7a3c840888f6a0f8f3f2a93aaccc`.

## Isolated gate

Exact `14c8852a7`, 72 files, one fresh Vitest process per file, sequential execution, 500 ms cooldown between files, no category overlap:

- 1,590 tests
- 1,590 passed
- 0 failed, 0 pending, 0 todo
- 0 non-zero process exits or missing JSON results

Machine results: `isolated-14c8852a7-cooldown/results.tsv` and `manifest.json`.

## Real PostgreSQL gate

Exact `14c8852a7`, disposable `pgvector/pgvector:pg15`, a new empty database, all 719 migrations, 64 files, one fresh Vitest process per file, sequential execution, no category overlap:

- 428 tests
- 427 passed
- 0 failed
- 1 explicit pending positive-control test whose source labels fixture authority pending
- 0 non-zero process exits, unhandled failures, or missing JSON results

Machine results: `realdb-14c8852a7/results.tsv` and `manifest.json`.

## Honest exclusions

The 27 `legacyPostgresPort` files remain `NOT_RELEASE_EVIDENCE`. External-runtime, stale/flaky-harness, and performance classifications remain dedicated or pending gates exactly as recorded by the matrix; they are not represented as executed by this three-part acceptance packet.

## Verdict

For the governed standard + isolated + realDB release gate: **PASS**. Executed assertions have zero failures; discovery/result accounting has zero missing or unexpected files; the exact acceptance SHA has literal green isolated and realDB evidence, while standard evidence is reused only through the bounded, machine-recorded two-path realDB-only equivalence.
