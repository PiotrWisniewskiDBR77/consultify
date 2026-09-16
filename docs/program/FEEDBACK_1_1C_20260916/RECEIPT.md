# FEEDBACK-1 / 1c — published review snapshot absence

**Verdict: READY FOR CTO REVIEW.** Results screens now receive `200 { "snapshot": null }` when a visible KPI scorecard has no published review; expected absence no longer appears as an HTTP 404.

- Base: `9ec5a9f32b`
- Branch: `codex/feedback-1-1c-results-review-snapshot-20260916`
- Decision marker: `[ODMROZENIE 09_RESULTS DEC-575]`

## Behavior and scope

- The shared `GET /api/vnext/results/kpi/scorecards/:scorecardId/review-snapshots/published` route returns the singular resource envelope with `snapshot: null` when the repository returns no visible publication.
- A published snapshot still returns HTTP 200 with the snapshot payload.
- Authentication, organization filtering, visibility CTE, and per-KPI payload redaction remain in the repository path. A missing publication and an inaccessible scorecard retain the same non-enumerating null shape.
- The client keeps the legacy 404 fallback for rolling deployment compatibility.
- KPI, OKR, ROI, and Management reports share this same registry fan-out; there are no separate writers or endpoint implementations for those tabs.

## Evidence

- Focused route test: `27/27 PASS`, RC 0, including `200 {snapshot:null}` and the existing published snapshot case.
- Mounted local ApiGateway + PostgreSQL 16 + real JWT ADMIN + ACTIVE membership + `OPEN_ORG` visibility: before publication HTTP 200 with `snapshot:null`; after inserting a published snapshot HTTP 200 with `status=published` and the persisted snapshot id.
- Disposable HTTP process, PostgreSQL container, and volume were removed; ports 4215 and 6455 were released.
- Front TypeScript on the same `node_modules`: line `RC=2, 169`; candidate `RC=2, 169`; delta 0.
- Server TypeScript on the same `node_modules`: line `RC=0, 0`; candidate `RC=0, 0`; delta 0; both logs contain completion markers.
- `git diff --check` and per-file client esbuild: PASS.
- `KpiTrzyPoziomy` is identically red on line and candidate: RC 1, 3 failed / 6 passed, caused by the existing fixture error `i18n.getFixedT is not a function`; no delta from this package.
- Independent review: ACCEPT, `0 x P0`, `0 x P1`, `0 x P2`.

No staging write, deployment, Railway change, screenshot, or protected-ref push was performed.
