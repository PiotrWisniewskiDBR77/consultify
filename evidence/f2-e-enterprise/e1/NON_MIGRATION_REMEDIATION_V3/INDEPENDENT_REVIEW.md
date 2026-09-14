# F2-E E1 NON_MIGRATION_REMEDIATION V3 — independent scoped review

**Verdict: scoped ACCEPT.** The exact 72-file freeze is internally consistent, and an independent 12-process Real PostgreSQL rerun closes the V2 P1: production remains below the controlled cold-process scaling envelope while the deliberate whole-file mutant fails the identical gate with a large margin. No new P1 or P2 was found in this restricted non-migration scope. Full E1 remains **HOLD / MIGRATION_REQUIRED** for restart-safe, multi-replica durable job/checkpoint/resume persistence; this review does not accept full E1.

## Frozen checkpoint

- `FREEZE_MANIFEST.json` SHA-256: `a4d31d8f7f5c4228726feaee322512853d7bf9775fc447641807f84d074f0c1b`.
- `SHA256SUMS` SHA-256: `68f7f60b422d6731d12c5e8b36ca111ba039372d566c6ea827997d9fd97d727b`.
- Manifest/SHA256SUMS: `72/72` files present and exact, drift `0`, checked both before and after the independent reruns.
- Frozen source HEAD: `e0279b4c1e3ccc71bcadd50e3dc739677ae70f99`; base: `0f0107b93c051b3ced9d3aafce740b36ac457f61`.

## Independent evidence

- Archive memory gate reran against real PostgreSQL `127.0.0.1:6456/f2e_e1` with three repetitions and one fresh `node --expose-gc` child for each measurement. All 12 process IDs were distinct.
- Independent production medians for 2,000 / 8,000 / 20,001 rows were `135.36 / 171.25 / 249.45 MiB` peak RSS delta. The three raw 20,001-row production deltas were `249.45 / 237.23 / 254.11 MiB`.
- The independently calculated envelope was `276.20 MiB`; production passed by `26.75 MiB`. Its measured marginal slope was `0.7913` retained RSS byte per additional uncompressed artifact byte, below both the `0.90` envelope coefficient and the separate `<0.95` assertion.
- The deliberate whole-file mutant used three further fresh processes and produced raw deltas `366.36 / 371.23 / 371.80 MiB`, median `371.23 MiB`. It failed the identical `276.20 MiB` envelope by `95.03 MiB`; every gate assertion had the required polarity. Independent report SHA-256: `2a5998bcecb2291da26b09bb7151e56b986b86e861c6babddfbeea0d94681620` (`/tmp/f2e-v3-independent-memory.json`).
- Source inspection confirms that the worker dynamically imports the production `writeOrganizationExportArchiveStreaming` path, which queries tables in pages with configured `batchSize: 500`, appends JSON/CSV batches, hashes and counts receipts through `createReadStream`, and streams the temporary directory into the ZIP. The mutant changes only the built-in `createReadStream` behavior to `Readable.from([readFileSync(path)])` before that production module is imported. The dataset-name length differs slightly by mode, but the mutant has only `0.53 MiB` more uncompressed artifact data and exceeds the envelope by `95.03 MiB`; this does not affect the verdict.
- Classification verifier independently returned `GREEN 1930/1930`; its adversarial mutation suite passed `14/14`.
- Targeted unit/UI suite independently passed `4/4` files and `10/10` tests. This retains the separate `fs.readFile` receipt guard, failed-job retention boundary, organization budget authority, progress/resume behavior, clean localized failure state and retry.
- `git diff --check` passed. Frozen evidence also records `4/4` RealPG/JWT/audit files with `9/9` tests, server TypeScript, the `10,712`-module production build, and the PL/DE production-router browser pass. V3 changes since V2 are confined to the isolated memory gate/worker and refreshed evidence; the behavioral suites were rerun independently where the remediation could affect them.

## Finding disposition

The V2 P1 is closed. The gate no longer depends on the accumulated history of a shared Vitest process: each point runs in a cold child, raw repetitions remain visible, the decision uses medians, growth is measured across controlled artifact sizes, and a real whole-file mutation is RED under the same envelope that accepts production. The independent rerun reproduced both sides with comfortable separation.

No new P1 or P2 was found in the scoped non-migration remediation. This acceptance does not change the architectural boundary: the in-memory job registry cannot provide restart-safe or multi-replica resume. No migration, E2 work, commit, push, deployment, or channel write was performed by this reviewer.
