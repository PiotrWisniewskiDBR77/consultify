# F2-E E1 NON_MIGRATION_REMEDIATION — independent scoped review

**Verdict: scoped HOLD.** The exact 67-file freeze is internally consistent and independently reproduces the classification, route/JWT/PostgreSQL, privacy, budget, UI, TypeScript and browser checks, but two P1 defects remain inside the non-migration scope. Full E1 remains **HOLD / MIGRATION_REQUIRED** for restart-safe, multi-replica durable job/checkpoint/resume persistence; this review does not accept full E1.

## Frozen checkpoint

- `FREEZE_MANIFEST.json` SHA-256: `ae199381ed83e82737706e107c4310085dc1251d7b074aa129c0236af5f11f05`.
- `SHA256SUMS` SHA-256: `ceb4ce965eca803aa5f0067ae41c01ec9630b56ed6ca34034bb8f1030642d2cd`.
- Manifest: `67/67` files present, exact SHA-256 and byte size, drift `0`.
- SHA256SUMS: `67/67` exact, drift `0`.
- Frozen source HEAD: `e0279b4c1e3ccc71bcadd50e3dc739677ae70f99`; base: `0f0107b93c051b3ced9d3aafce740b36ac457f61`.

## Independent reruns and inspection

- Classification verifier: `GREEN 1930/1930`; totals are `EXPORT 1524`, `EXCLUDE_SECURITY 405`, `DERIVED 1`, `UNRESOLVED 0`, `ACTIVE_SEMANTIC_POLICY_MISSING 0`.
- Public business dispositions: `148/148` exact entries (`145 EXPORT`, `3 EXCLUDE_SECURITY`). The mutation/cycle suite passed `14/14`, including missing disposition, fake runtime evidence, lifecycle mutation, public/v8 collision, unsafe credential columns, and cyclic DERIVED sources.
- Targeted unit/UI suite: `3/3` files, `8/8` tests passed. This covers organization budget authority/default, job progress/token/failure/expiry behavior, UI progress, retry and download selection.
- Real PostgreSQL suite on `127.0.0.1:6456/f2e_e1`: `4/4` files, `8/8` tests passed. This independently exercised OWNER and SUPERADMIN synchronous `409 ORG_EXPORT_ASYNC_REQUIRED`, asynchronous production routers, signed JWT, opaque token denial, PostgreSQL export/readback, requested/completed/downloaded audits, C6-R2 settings save/readback and the actual usage gate, public/v8 separation, the archive, and the 20,001-row DEC-493 identity projection.
- `npx tsc -p server/tsconfig.json --noEmit --pretty false`: passed.
- Independent browser rerun against the existing production build asset `/assets/index-C6SpSeAL.js` and canonical `/superadmin/customers/organizations`: PL and DE success, failure, retry recovery and download all ran with zero page/console errors. Evidence was written outside the freeze under `/tmp/f2e-nonmigration-independent-browser.N3ZVNE`.
- Frozen PL/DE screenshots were visually inspected. The required action, ready state, failed state and localized retry are visible.

## P1 findings

### P1-1 — Archive receipt hashing still materializes a complete per-table file

`server/src/services/organizationExportArchiveService.ts:66-73` calls `fs.readFile()` for each generated JSON/CSV file, and `:215-219` invokes it after the page writer finishes. Querying and JSON/CSV construction use 500-row pages, but receipt generation loads a whole table file into one `Buffer`; memory therefore grows with the largest exported relation. The 20,001-row RSS test at `server/src/services/__tests__/organizationExportEnterprise.realpg.test.ts:222-244` calls `exportOrganizationData()` with a callback and never exercises archive receipt hashing. The archive test at `:128-185` exercises 20,002 rows but records no RSS ceiling. This does not close the prior global bounded-memory finding.

Required fix: hash each file through a read stream and obtain byte size without reading the whole file into memory. Add a defending archive-level RSS test with sufficiently large/wide table output; it must pass through receipt hashing and ZIP finalization, and a mutation restoring `fs.readFile` must fail.

### P1-2 — Failed jobs inherit expiry from job start instead of terminal transition

`server/src/services/organizationExportJobService.ts:154-156` sets `expiresAt` when the job enters `running`. The ready path correctly resets it at `:176-179`, but the failed path at `:193-198` updates `updatedAt` without resetting `expiresAt`. An export that fails after the retention interval will enter `failed` with an already expired deadline; the next status read or cleanup tick can remove its metadata immediately, preventing the stable error code from reaching the failed UI and defeating the intended terminal retention/retry behavior.

Required fix: set `expiresAt = updatedAt + TERMINAL_JOB_RETENTION_MS` on the failed transition. Add a clock-controlled test where execution lasts past the initial retention interval, then fails; prove the failed view remains available for a full terminal retention window and both metadata and artifact disappear only after that window.

## P2 findings

### P2-1 — The frozen C6 disposition contradicts the implemented C6-R2 remediation

`evidence/f2-e-enterprise/e1/C6_FINDINGS_DISPOSITION.md:8` still says C6-R2 is outside E1, that E1 does not read/write the budget tables, and that no behavioral test exists; line `14` repeats that the C6 HOLD cannot be removed for this reason. The frozen code and independently passing RealPG test now do save/reload the organization settings and prove the 10 USD block / 20 USD allow usage gate. The checkpoint therefore contains mutually contradictory acceptance evidence.

Required fix: update the disposition to the actual C6-R2 implementation and cite the unit and mounted route/JWT/PostgreSQL behavior. Keep the separate durable-resume migration HOLD explicit.

### P2-2 — Failed browser state retains a contradictory success toast from the previous export

Both frozen failed-state screenshots show the red localized failure/retry alert while a green localized “export ready” toast is still visible. The independent browser rerun reproduced the same sequence because the production path completes one export and immediately fails the next. Preparing/progress is correctly cleared, but the visible success and failure messages still conflict.

Required fix: dismiss or replace the prior export-success toast when a new export starts or fails, and assert in PL/DE browser evidence that the failed state contains neither Preparing/progress nor a prior ready/success message.

## Accepted parts of this scoped checkpoint

The exact classification denominator and 148 business dispositions, mutation/circular guards, page-bounded database reads and DEC-493 identity removal, synchronous fail-closed routes, C6-R2 behavior, OWNER/SUPERADMIN JWT/PG/audit flow, localized failed/retry mechanics, expiry deletion when explicitly invoked after the recorded deadline, and canonical production-build PL/DE route behavior are materially proved. They do not override the P1/P2 findings above.

No migration, E2 work, commit, push or deployment was performed by this review.
