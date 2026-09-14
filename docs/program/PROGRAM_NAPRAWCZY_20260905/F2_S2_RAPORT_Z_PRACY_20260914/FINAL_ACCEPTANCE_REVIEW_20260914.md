# Final acceptance review — S2 / P1 Work report

**Verdict: REQUEST_CHANGES.** Exact candidate `509e8a637cfdeda96bb4e9956adb3004b7970bb4` on base `21d7d27ecf8aa5f70def36ff52b1db14854e1eaf` fixes the parking crash, gates the four dedicated Work report endpoints, and stops the scheduled runner before reads and writes when the server flag is OFF. One server-side OFF-parity path remains reachable through the shared report-run command endpoint.

## Blocking finding

### P1 — OFF still permits a Work report read and write through the shared report-run route

`POST /report-runs/:reportRunId` has no conditional `ENABLE_INITIATIVES_WORK_REPORT` gate. When its otherwise valid payload contains `workReport`, the handler enters the Work report branch, calls `deps.reader.buildInitiativeWorkReport(...)`, and then calls `createReportRun(...)` with the captured Work report (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:7300-7396`). The adjacent transition route is likewise reachable with the flag OFF and can advance that Work report through `VALIDATE`, `FREEZE`, and `DECIDE` (`:7399-7445`). Thus a direct authenticated API caller can execute feature-specific reads and writes while both advertised flags are OFF, even though the four dedicated `/work-reports/*` routes and the scheduled runner correctly refuse execution.

The fix should keep the canonical shared report reads available, but conditionally reject only Work report payloads and transitions for Work report runs while `ENABLE_INITIATIVES_WORK_REPORT` is OFF. The regression proof should assert that a canonical non-Work-report command remains unchanged, while a Work report create and transition perform no reader/UoW mutation when OFF and work when ON.

## The two last review fixes

- **Parking deep link: PASS.** `FOUR_BUTTONS_ENABLED` is restored from `isInitiativesFourButtonsEnabled()`. The real hub test mounts `?lens=parking` with both relevant UI flags OFF, completes without `ReferenceError`, resolves to the canonical list, and adds no Menu 3 chip. Focused result: 4/4.
- **Dedicated server surface and runner gate: PASS.** `ENABLE_INITIATIVES_WORK_REPORT` is strict opt-in (`=== 'true'`). OFF returns `FEATURE_DISABLED` from preview, schedule, PDF, and deliver before their handlers; ON reaches all four handlers. The scheduled runner throws before `findReportDefinition` and before any aggregate write. Focused results: routes 2/2 and runner 4/4.
- **Canonical shared reads: PASS.** `GET /report-definitions`, `GET /report-definitions/:definitionId`, and `GET /report-runs` remain outside the new feature gate and retain organization-scoped reads and existing visibility filtering.

## Previously accepted delivery fixes

All five fixes from the previous review remain present and pass their focused evidence:

1. Manual delivery uses stable `manual-delivery-<reportRunId>`; retry after A succeeds and B fails sends A once and B twice.
2. Recipient delivery uses a five-minute lease, a fresh attempt token, token-fenced result recording, and a stable RFC Message-ID; active leases do not resend and expired leases can be reclaimed.
3. The approver picker admits only another active admin, owner, or superadmin; member, suspended, and self are excluded. Server command and delivery routes retain admin and tenant gates.
4. The full integration test runs the production runner through a real PDF, the real `EmailService`, a local TCP SMTP server, PostgreSQL persistence, and dashboard readback ending in `PUBLISHED` with receipt and per-recipient delivery state.
5. The package documentation now describes publication only after all recipients succeed, lease/fence recovery, and the honest boundary that live staging SMTP has not been exercised.

## Verification on the exact candidate

- Git was clean before review; HEAD was exactly `509e8a637cfdeda96bb4e9956adb3004b7970bb4`; merge-base was exactly the declared base.
- Focused suite: 8 files / 27 tests PASS with `--retry=0`.
- Real PostgreSQL: reader isolation 1/1 PASS and production runner → PDF → `EmailService` → local SMTP → PostgreSQL → dashboard 1/1 PASS on `cx-s2-work-report-pg:6459`.
- Server TypeScript: `npm run type-check:server` PASS with 0 errors. `git diff --check` PASS.
- Manifest: 32/32 candidate paths and SHA-256 hashes reproduce from candidate `0c9bd3eb24ec0cb38f7043db992f57e4219a52ef`; self-hash is correctly excluded.
- Evidence delta: 6 files / 55,369 bytes, below 2 MB.
- i18n: EN +46 and PL +46; no existing leaf removed or changed; Work report key parity is 46/46.
- UI: `StandardTable` is used for the run list; no custom table or new Menu 3 chip was added. Existing React `act(...)` warnings remain non-fatal in the hub harness.
- Authorization and tenant isolation: admin command gates pass 8/8; RealPG reader uses organization and project predicates and excludes foreign records.
- No staging, deployment, migration, or external email operation was performed.
