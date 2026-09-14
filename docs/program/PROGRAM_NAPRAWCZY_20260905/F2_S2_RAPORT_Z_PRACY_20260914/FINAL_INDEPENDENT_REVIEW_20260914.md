# Final independent skeptical review — S2 / P1 Work report

**Verdict: REQUEST_CHANGES.** Exact freeze `d48d5c1f5d4769c2e149c8a40e7e9285a32b0a93` on base `21d7d27ecf8aa5f70def36ff52b1db14854e1eaf` closes the five previously reported delivery blockers, but introduces a reachable Initiatives crash and does not preserve default-OFF parity on the server.

## Blocking findings

1. **P1 — the parking deep link evaluates an undeclared feature flag and crashes.** The rebase replaced the local declaration of `FOUR_BUTTONS_ENABLED` with `WORK_REPORT_ENABLED` (`src/components/Initiatives/InitiativesHub.tsx:277`), but `resolvePreparationLens` still evaluates `FOUR_BUTTONS_ENABLED` when `?lens=parking` is requested (`:286`). The focused Work report tests pass only because their URLs do not evaluate the right side of that short-circuit. A focused esbuild of the exact freeze leaves the undeclared identifier in the emitted browser module, and evaluating the emitted parking expression exits with `ReferenceError`. Restore the canonical four-buttons flag source and add a regression test for `?lens=parking` with the Work report flag OFF.

2. **P1 — `VITE_INITIATIVES_WORK_REPORT=OFF` hides only the UI; the new server capability and scheduled delivery remain active.** The four Work report endpoints are registered unconditionally (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:7508,7532,7604,7636`), and `ScheduledReportService` executes `initiative_work_report` whenever a stored schedule contains `runtimeReport` (`server/src/services/scheduledReportService.ts:529`) without a server-side default-OFF flag. This means a direct API caller or a pre-existing/configured schedule can create, send and publish reports while the advertised feature flag is OFF. Add a server env flag defaulting to OFF, guard all Work report write/delivery/schedule behavior (with an explicit read policy), and prove OFF parity plus ON behavior in focused route/runner tests.

## Previously reported blockers — closed

- Manual delivery uses stable `manual-delivery-<reportRunId>` regardless of a fresh UI `clientRequestId`; focused HTTP proof shows A accepted once, B retried twice, then one published receipt.
- Recipient state uses a five-minute lease, a fresh attempt token and a token fence on result recording. Active leases do not resend; expired leases reclaim. The SMTP Message-ID is deterministic per receipt and recipient. This is an at-least-once recovery design: an SMTP acceptance followed by a process crash can be retried with the same Message-ID, so provider-side deduplication remains outside the local transaction.
- The UI picker accepts only another active admin/owner/superadmin and rejects member, suspended and self. Server write/delivery routes retain the admin-role and tenant-scoped readback gates.
- The integration proof runs the production runner through a real PDF, the real `EmailService`, a local TCP SMTP server, PostgreSQL persistence and dashboard readback. SMTP transcript contains the PDF attachment and PostgreSQL ends in `PUBLISHED` with delivery state and receipt.
- README now describes publication after all recipients succeed and documents lease/fence behavior and the honest live-staging SMTP boundary.

## Verification on the exact freeze

- Git: clean before review; HEAD `d48d5c1f5d4769c2e149c8a40e7e9285a32b0a93`; merge-base equals declared base `21d7d27ecf8aa5f70def36ff52b1db14854e1eaf`.
- Manifest: 29/29 candidate hashes reproduce from candidate `f7e9276bdd0d2d4d8800603ac31498fe85d44bbc`; path set exact; manifest intentionally excludes its own hash.
- Evidence delta: 6 files / 55,063 bytes, below 2 MB.
- Focused tests: 6 files / 22 tests PASS (`--retry=0`); RealPG reader plus full runner/SMTP/dashboard: 2 files / 2 tests PASS on `cx-s2-work-report-pg:6459`.
- `npm run type-check:server`: PASS, 0 errors. `git diff --check`: PASS.
- i18n: EN +46 / PL +46; zero removed or changed existing leaf values; full new-key parity.
- UI canon: `StandardTable` used, no custom `<table>`, no crimson or `primary-*`; all changed `c-*` tokens resolve.
- Navigation: Work report is an existing Menu 2 tab and adds no Menu 3 lens. The blocker above affects the pre-existing parking lens rather than adding a fourth lens.
- No staging/deploy/migration was performed during review.
