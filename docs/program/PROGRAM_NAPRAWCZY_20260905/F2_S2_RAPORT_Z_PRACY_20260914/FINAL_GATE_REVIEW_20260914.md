# Final gate review — S2 / P1 Work report

**Verdict: ACCEPT.** Exact candidate `4d8113fa46f538f746f96c61a90607bd91734db6` on base `61334b2c210b442896e5674df8bf44bc764355a5` closes the last shared-route OFF-gate bypass and preserves canonical report-run behavior.

## Last blocker

- `POST /report-runs/:reportRunId` rejects a payload containing `workReport` with `404 FEATURE_DISABLED` while `ENABLE_INITIATIVES_WORK_REPORT` is unset or false, before definition lookup, report capture, or UoW.
- A transition carrying `profile: initiative_work_report` is rejected before report lookup or UoW.
- An existing Work report transition without the optional profile hint performs only the tenant-scoped lookup required to identify the stored run, then returns `404 FEATURE_DISABLED` before authorization-dependent work or UoW. The focused test proves the transaction count does not change.
- With the server flag ON, shared create and `VALIDATE` transition return `201` and `200`. With the flag OFF, a canonical non-Work-report create and transition still return `201` and `200`.
- The server switch remains strict opt-in: only the literal string `true` enables the capability.

## Earlier fixes retained

1. Manual retry keeps the stable `manual-delivery-<reportRunId>` receipt; the successful recipient is not sent twice while the failed recipient is retried.
2. Recipient delivery retains a five-minute lease, per-attempt token fence, and stable RFC Message-ID; active leases block duplicate work and expired leases can be reclaimed without accepting a stale result.
3. The approver picker retains only another active admin, owner, or superadmin, while server report-definition and report-run writes retain the admin gate and tenant-scoped reads.
4. The full integration path still executes the production runner through a real PDF, real `EmailService`, local TCP SMTP, PostgreSQL persistence, and dashboard readback ending in `PUBLISHED` with receipt and `DELIVERED` state.
5. Documentation retains the truthful publish-after-delivery lifecycle and lease/fence recovery boundary. Live staging SMTP remains outside this review and was not exercised.

The parking deep-link repair remains present (`FOUR_BUTTONS_ENABLED` comes from the canonical feature flag), and the dedicated Work report routes plus scheduled runner remain protected by the server OFF gate.

## Fresh verification on the exact candidate

- All test files changed from the base: 9 files / 31 tests PASS with `--retry=0`.
- Real PostgreSQL: reader isolation 1/1 PASS; production runner → PDF → `EmailService` → local SMTP → PostgreSQL → dashboard 1/1 PASS on `cx-s2-work-report-pg:6459`.
- `npm run type-check:server`: PASS, 0 errors.
- Focused esbuild of `InitiativeWorkReportView.tsx`: PASS, 25.2 kB.
- `git diff --check`: PASS.
- Freeze manifest: 34/34 listed hashes reproduce; the candidate path set is exact after excluding the manifest self-hash.
- Evidence delta: 6 files / 56,059 bytes, below 2 MB.
- i18n: EN +46 and PL +46, identical new-key set; no existing key removed or changed.
- Wpis 31 control: no new control comparison uses the dead status literals. One `status: 'BLOCKED'` occurrence is report fixture data, not a lifecycle condition.
- Existing React `act(...)` warnings in the hub test remain non-fatal; all four hub behaviors pass.

No code was changed by this review. No migration, deploy, staging operation, or external email was performed.
