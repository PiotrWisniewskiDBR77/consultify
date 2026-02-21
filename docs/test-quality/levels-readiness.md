# Test system readiness (L1–L5) — honest audit

Generated: 2026-02-15

This document summarizes the current automated test system readiness by level L1–L5, focusing on **how much tests touch real application code** and whether the level is runnable deterministically.

## Global honesty metrics

Based on `test:quality-check` scanning `tests/` + `e2e/`.

Always treat this section as a **snapshot** — refresh with `npm run test:quality-check` and use the generated report as the source of truth.

Snapshot (2026-02-15):

- REAL_CODE: 464
- REAL_RUNTIME (Playwright): 125
- PLACEHOLDER: 0
- FAKE_UNIT: 0
- FAKE_INTEGRATION: 0
- FAKE_INTEGRATION_RISK: 0
- SPEC_FILE: 0
- OTHER: 0

Report: `test-results/quality-check/quality-check.report.md`

## L1 — Unit / critical backend

Goal: security boundary + policy enforcement logic with high coverage.

- Status: runnable ✅
- Latest run: `npm run test:l1:coverage`
- Result: 509 tests, pass ✅
- Coverage output: `test-results/coverage/l1/`
- Gate scope: `vitest.l1.config.ts` + `scripts/testing/coverage-thresholds.ts --profile l1`

## L2 — Component/UI (auth)

Goal: high-signal component tests for login + MFA components with per-file thresholds.

- Status: runnable ✅
- Latest run: `npm run test:l2:coverage`
- Result: 61 tests, pass ✅
- Coverage output: `test-results/coverage/l2/`
- Gate: `scripts/testing/coverage-thresholds.ts --profile l2`

## L3 — Integration/API (security routes)

Goal: DB-backed integration tests without fake “supertest + express()” apps, and without binding ports (works in restricted sandboxes).

- Status: runnable ✅
- Latest run: `npm run test:l3:coverage`
- Result: 5 tests, pass ✅
- Coverage output: `test-results/coverage/l3/`
- Gate: `scripts/testing/coverage-thresholds.ts --profile l3`

## L4 — E2E / Playwright

Goal: full runtime flows in a real browser against a running frontend+backend.

- Gate (smoke): `npm run test:l4` (runs `tests/e2e/smoke/**`)
- Full suite: `npm run test:e2e:full` (large, may be flaky until stabilized)

- Test trees:
  - `tests/e2e/` (Playwright `testDir`)
  - `e2e/` (extra specs, not picked up by default config)
- Spec files: 117
- `test.skip(...)` usage: 6 (skips are present and should always have explicit reasons)
- Config: `playwright.config.ts`

Readiness notes:

- `E2E_USE_WEB_SERVER=true` is required for Playwright to start the web servers automatically.
- In constrained sandboxes, starting servers via `tsx` can fail due to `listen()` restrictions (IPC pipes / port binding). Prefer running L4 in an environment that allows binding ports or against a dedicated test deployment.

See also: `docs/test-quality/l4-e2e-readiness.md`

## L5 — Quality gates / security / performance

Goal: “system guards” that prevent regressions (integrity, audits, performance budgets).

Current gates:

- `npm run test:quality-check` (hard-fails on PLACEHOLDER/FAKE_UNIT/FAKE_INTEGRATION)
- `npm run test:l5` (quality-check + integrity + security + performance)

## What’s next (recommended)

- Expand L1 scope file-by-file (keep narrow include lists and strict thresholds).
- Grow L3 with more router/controller tests that do **not** require `listen()` in CI/sandbox.
- Run L4 in CI with a deterministic environment (webServer enabled or test deployment) and keep skips explicit/reasoned.
