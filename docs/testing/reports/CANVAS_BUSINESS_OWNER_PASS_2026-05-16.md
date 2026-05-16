# Canvas Business Owner PASS Prep - 2026-05-16

## Verdict

`READY_FOR_MANUAL_WITH_DEVELOPER_EVIDENCE`

Block 2 (Canvas) strict-dev execution is now green for the full Canvas Playwright pack in local web-server mode. The previously reported P1 regression signature (save/read-back placeholder value in mock-runtime flow) has been re-closed, and Block 2 can return to `READY_FOR_MANUAL` pending Business Owner evidence.

## Scope Covered

- Block 2 checklist re-run against current runtime.
- Canvas targeted automation pack (`work-canvas-*` Playwright specs) in local web-server mode.
- Supporting runtime gates and docs gates.
- Staging route/API probes for Canvas and auth boundaries.
- Existing historical evidence reconciliation from Sprint 1 closeout.

## Validation Evidence (2026-05-16)

1. Canvas gate command:
   - `npm run -s test:v10:canvas:gate`
   - Result: `PASS` (command executes and exits 0; no additional test files in this slice).

2. Canvas Playwright pack (strict-dev rerun, local web-server mode):
   - `E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=true E2E_API_URL=http://127.0.0.1:3101 E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test --config playwright.config.ts tests/e2e/smoke/work-canvas-split.spec.ts tests/e2e/smoke/work-canvas-core-flow.spec.ts tests/e2e/smoke/work-canvas-deeplink.spec.ts tests/e2e/smoke/work-canvas-manual-preflight.spec.ts tests/e2e/smoke/work-canvas-editor-flow.spec.ts --project=chromium --workers=1`
   - Result: `12 PASS / 0 FAIL`.
   - Resolved regression evidence:
     - owner save/read-back flow is green after fixing mock DB positional placeholder handling (`$N`) in update-path parsing.
     - deep-link/manual/split flows are green after aligning Canvas smoke selectors and interactions to the canonical chat + work-panel UX contract.

3. Runtime gate:
   - `npm run -s test:runtime-gate`
   - Result: `PASS` (`18/18` in the covered route/persistence slice).

4. Chat boundary gates (supporting Teresa/Anna compatibility affecting Canvas split shell assumptions):
   - `npm run -s test:aios:wave-1` -> `PASS`
   - `npm run -s test:aios:wave-2` -> `PASS`

5. Staging probes:
   - `GET https://demo.consultify.ai/ai/work-canvas?kind=document` -> `200`
   - `GET https://demo.consultify.ai/chat?workPanel=1` -> `200`
   - `GET https://demo.consultify.ai/api/work-canvas/drafts` (unauth) -> `401`

6. Documentation gates:
   - `npm run -s docs:check` -> `PASS`
   - `npm run -s docs:parity` -> `PASS`

7. Historical baseline evidence (already green, retained for comparison):
   - `docs/testing/reports/WORK_CANVAS_A2_PERSISTENCE_RETEST_2026-05-15.md` (`PASS`)
   - `docs/product/WORK_CANVAS_P1_PERSISTENCE_CLOSEOUT_2026-05-15.md` (`DONE_PASS`)

## Block 2 Checklist Mapping

- [x] Owner creates Canvas document. (covered by historical evidence and current targeted checks)
- [x] Owner edits title. (covered in targeted pack; edit path executes)
- [x] Owner edits body/content.
- [x] Save confirms success.
- [x] F5/refresh preserves title and body.
- [x] Reopen from route/deeplink preserves data.
- [x] Split/canvas workspace does not lose edits.
- [x] Permission-denied state is visible and non-leaky. (member restricted actions slice passes)
- [ ] Teresa can propose a Canvas change without silent write. (not newly proven by this rerun; remains tied to Teresa business rehearsal)

## P1 Classification

Previously reported `BLOCKED_P1` is resolved in strict-dev evidence:

- owner save/read-back and refresh persistence now pass,
- deep-link and split/mobile flows now pass,
- no active Canvas P1 remains in this rerun.

## Remaining Manual Evidence Required

Even after P1 is resolved, Business Owner package remains mandatory:

- screenshots/video: create, save, refresh, reopen,
- route/API snippets for save/read-back,
- explicit owner sign-off for promotion to `BUSINESS_PASS`.

## Decision

- Developer-side decision: `PASS_WITH_BUSINESS_MANUAL_FOLLOWUP`
- Block status transition in tracker: `READY_FOR_MANUAL`
- Promotion path: Business Owner evidence package -> `BUSINESS_PASS`.
