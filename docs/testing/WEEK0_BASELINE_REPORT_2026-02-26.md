# Week 0 Baseline Report

Data: 2026-02-26
Scope: local repo baseline + metrics validation

## Executive summary
Week 0 was partially completed. Local baseline counts were updated and the metrics dashboard was validated against the repo. CI-time, flake-rate (30d), and billable minutes require GitHub Actions history and remain blocked due to missing GH auth.

## Completed
- Baseline test file counts updated in `docs/testing/PLAN_ROZWOJU_SYSTEMU_TESTOW_AUTOMATYCZNYCH_2026-02-26.md`.
- Metrics validation against `docs/metrics/QUALITY_METRICS.md` completed; dashboard is stale vs current repo counts.

## Blocked (requires CI data)
- PR gates total duration (end-to-end) for the last 30 days.
- Flake rate for the last 30 days (retries / reruns).
- Billable minutes in GitHub Actions per week.

Reason: `gh` is not authenticated in this workspace, so GitHub Actions run history cannot be queried.

## Findings
- `docs/metrics/QUALITY_METRICS.md` is dated 2026-01-10 and does not match current repo counts.
- Current test file counts (local):
  - L1 Unit: 291
  - L2 Component: 151
  - L3 Integration: 304
  - L4 E2E: 161 (20 smoke)
  - L5 Security: 9
  - L5 Performance: 16
  - Total (tests/ only): 1053

## Evidence (local)
- `rg --files tests/**` counts.
- `rg --files tests/e2e/smoke` for smoke count.

## Next action to unblock CI metrics
Authenticate `gh` and rerun the baseline script to pull:
- workflow durations,
- rerun frequency,
- billable minutes.
