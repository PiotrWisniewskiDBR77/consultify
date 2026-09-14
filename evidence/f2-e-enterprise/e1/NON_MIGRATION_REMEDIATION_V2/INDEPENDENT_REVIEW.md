# F2-E E1 NON_MIGRATION_REMEDIATION V2 — independent scoped review

**Verdict: scoped HOLD.** The exact 66-file freeze is internally consistent and the receipt streaming, failed-job terminal retention, C6-R2 budget authority, localized failed/retry UI, classification, route/JWT/PostgreSQL and build checks reproduce. One P1 remains inside the non-migration scope: the archive RSS acceptance bound is order-sensitive and too loose to prove that full-file materialization cannot regress. Full E1 remains **HOLD / MIGRATION_REQUIRED** for restart-safe, multi-replica durable job/checkpoint/resume persistence; this review does not accept full E1.

## Frozen checkpoint

- `FREEZE_MANIFEST.json` SHA-256: `b2c4c9e4f3082dece4d21203d16477dbeaaede91385b939c69387315260b48fb`.
- `SHA256SUMS` SHA-256: `cebf1985a3ffebd58a1be2e3a609428bfb067c92c82e21c773855bff303370e2`.
- Manifest: `66/66` files present, exact SHA-256 and byte size, drift `0`.
- SHA256SUMS: `66/66` exact, drift `0`.
- Frozen source HEAD: `e0279b4c1e3ccc71bcadd50e3dc739677ae70f99`; base: `0f0107b93c051b3ced9d3aafce740b36ac457f61`.

## Independent reruns and inspection

- Classification verifier: `GREEN 1930/1930`; mutation/cycle suite: `14/14 PASS`.
- Targeted unit/UI suite: `4/4` files, `10/10` tests passed. The archive test spies on `fs.readFile` and the current receipt implementation uses `createReadStream`; the long-running failure test proves the failed transition resets `expiresAt`, retains the stable failed view and partial artifact for the terminal window, then removes both.
- Real PostgreSQL suite on the assigned `127.0.0.1:6456/f2e_e1`: `4/4` files, `9/9` tests passed. This includes OWNER and SUPERADMIN JWT routes and audit readback, the C6-R2 save/reload and actual usage gate, classification/runtime isolation, archive hashing/counts and the 20,001-row wide archive path.
- C6-R2 disposition matches the implementation: `organization_ai_settings` is the organization-wide authority; unit behavior proves 9/10 allow, 10/10 deny, 20 allow and the USD 50 default; the mounted JWT/PostgreSQL path proves the UI-shaped 10/10 save blocks at real usage and 20/20 re-enables.
- Independent production-build browser rerun on `/superadmin/customers/organizations`: PL and DE each show failed state with Preparing `0`, prior ready/success `0`, localized retry, successful recovery, and page/console errors `0/0`. Output was kept outside the freeze under `/tmp/f2e-v2-review-browser.qi8muq`.
- `npx tsc -p server/tsconfig.json --noEmit --pretty false`: passed. `git diff --check`: passed. Frozen production build: `10,712` modules, completed in `36.67s`; its existing CSS warnings are outside this remediation diff.

## P1 finding

### P1-1 — The RSS gate is too loose and order-sensitive to defend bounded archive memory

The archive-level test does exercise paging, JSON/CSV generation, streamed receipt hashing and ZIP finalization for 20,001 rows with a 4,096-byte payload. It also proves that each uncompressed artifact exceeds 80 MiB. However, `server/src/services/__tests__/organizationExportEnterprise.realpg.test.ts:264-288` samples process RSS relative to the current process baseline and accepts any delta below `320 MiB`. That ceiling is roughly twice the combined size of the two generated artifacts and therefore does not fail if one or even both table files are materialized in memory.

The result changes materially with test-process history:

- frozen author combined-suite run: `54.20 MiB`;
- independent combined-suite rerun: `143.70 MiB`;
- independent fresh process running only the wide archive test: `311.84 MiB`.

The fresh-process result passes by only `8.16 MiB`, despite the same code and dataset. This proves that the current delta is dominated by process baseline/order effects and cannot support the frozen bounded-memory claim. The `fs.readFile` unit spy is useful and the current source contains no full-file read on the receipt path, but it does not make the RSS assertion mutation-sensitive: the 320 MiB ceiling itself can still pass a whole-file regression implemented through another buffering path.

Required fix: replace the order-sensitive single-process delta with an isolated, repeatable memory proof. A suitable gate should compare controlled archive sizes in fresh child processes and enforce sublinear RSS growth, or use a tight absolute/peak envelope after a defined warm-up; add a deliberate whole-file-buffer mutation and prove that the archive-level memory gate fails it. Preserve the source-level `fs.readFile` guard as a separate negative check. Report cold and combined runs explicitly rather than selecting the smallest delta.

## Closed findings from the prior scoped review

- Receipt generation now hashes and counts bytes incrementally with `createReadStream`; source inspection and the `fs.readFile` spy close the specific whole-file receipt implementation defect.
- Failed jobs now start `expiresAt` at the failed terminal transition; the clock-controlled late-failure test proves the full retention and deletion boundaries.
- `C6_FINDINGS_DISPOSITION.md` now describes the implemented R2 authority and is supported by fresh unit and mounted JWT/PostgreSQL behavior. The durable-resume migration boundary remains separate.
- Starting or failing an export removes the stable prior-success toast. Fresh PL/DE production-build browser behavior proves no Preparing or ready/success copy remains in failed state and localized retry recovers.

No new P2 was found in the non-migration remediation scope. No migration, E2 work, commit, push, OD-channel write or deployment was performed by this review.
