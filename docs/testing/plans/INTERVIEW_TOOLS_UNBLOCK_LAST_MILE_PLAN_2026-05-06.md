# Interview/Tools Unblock — Last Mile Plan (P0/P1)

Priority: immediate  
Goal: close `IMPACT-TR-001` (P0) and `IMPACT-UX-002` (P1) within one focused fix/retest loop.

## 1) Root-cause hypothesis

Even with improved `api.ts` circuit logic:
- transport safeguard still triggers in runtime paths used by Interview/Tools,
- affected modules still lack consistent degraded fallback contract.

Potential contributors:
1. Endpoint path normalization mismatch (bypass rule not matching actual request path form).
2. Shared global circuit state persisting between module transitions.
3. Bootstrap/test-support endpoint instability (404) masking true module behavior.
4. Module loaders not mapping safeguard errors to unified `retryable` UX state.

## 2) Immediate engineering tasks

### T1 — Harden bypass matcher (P0)
- Normalize URL path before bypass checks (`pathname` only, strip query/hash, decode safely).
- Log exact normalized path when recording global failures.
- Verify Interview/Tools/Education/Audits calls hit bypass conditions in production runtime, not only unit tests.

### T2 — Global circuit recovery guard (P0)
- Ensure successful response on *any* critical data endpoint clears stale global circuit state.
- Add metric/log marker for `global_circuit_cleared_on_success`.
- Prevent cross-module contamination (failure in unrelated endpoint cannot freeze Interview/Tools read flow).

### T3 — Unified degraded UX for Interview/Tools (P1)
- For safeguard code (`CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN`) render:
  - explicit title + cause,
  - retry button,
  - no empty shell and no indefinite spinner.
- Add consistent component-level fallback in both modules.

### T4 — Test-support bootstrap stabilization (P1/P0 testing blocker)
- Fix smoke global setup endpoint contract returning 404.
- Ensure `playwright.smoke` startup path is stable before module tests run.

## 3) Mandatory verification commands

```bash
npm run lint
npm run type-check
npx vitest run "tests/unit/api.test.ts"
npm run test:integration
npm run test:runtime-gate
npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/deploy-gate-api-interview.spec.ts tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts --project=chromium --workers=1
```

## 4) Manual retest acceptance (must all pass)

1. Interview existing session opens with real questions (not `0/0` shell).
2. Interview new session save/submit works.
3. Tools Education/Audits load content.
4. If safeguard triggers, both modules show clear degraded banner + retry.
5. No loading loop/infinite spinner.

## 5) Exit criteria

- `IMPACT-TR-001` CLOSED.
- `IMPACT-UX-002` CLOSED.
- New recovery retest decision upgraded to `GO` or `GO_WITH_RISK` (no open P0).

## 6) Automation closure evidence

Status: `PASS` for local automation after implementation.

Evidence:
- `docs/testing/reports/INTERVIEW_TOOLS_RECOVERY_AUTOMATION_EVIDENCE_2026-05-06.md`

Executed:
- `npx vitest run "tests/unit/api.test.ts"` → `6 passed`
- `npm run test:runtime-gate` → completed successfully
- `E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=true E2E_API_URL=http://127.0.0.1:3101 E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/deploy-gate-api-interview.spec.ts tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts --project=chromium --workers=1` → `40 passed`

Manual demo/stage retest remains required before upgrading the release decision.

