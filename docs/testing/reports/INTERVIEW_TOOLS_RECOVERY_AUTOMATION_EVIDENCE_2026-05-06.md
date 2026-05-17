# Interview/Tools Recovery Automation Evidence — 2026-05-06

Scope:
- `IMPACT-TR-001` global transport safeguard recovery
- `IMPACT-UX-002` degraded UX for Interview/Tools

## Code changes verified

- `src/services/api.ts`
  - normalized transport paths before global circuit decisions
  - bypass for Interview/Tools/Education/Audits/Discovery Tools paths
  - 4xx client errors ignored for global circuit opening
  - successful request clears global circuit immediately

- `src/components/Interview/InterviewWorkspace.tsx`
  - explicit degraded state for failed session/question load
  - no silent `0/0` empty shell when questions fail to load
  - retry affordance present

- `src/components/Discovery/DiscoveryToolsHub.tsx`
  - critical bootstrap failures now surface load error instead of silent fallback
  - degraded UI with retry

- `tests/e2e/smoke/global-setup.ts`
  - more resilient bootstrap wait for test-support route startup

- `tests/e2e/smoke/deploy-gate-api-interview.spec.ts`
- `tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts`
  - mock DB detection now includes `E2E_MOCK_DB=true`

## Test results

### Unit

Command:
```bash
npx vitest run "tests/unit/api.test.ts"
```

Result:
- `6 passed / 0 failed`
- Re-run after scoped formatting/import fixes: `6 passed / 0 failed`

### Runtime Gate

Command:
```bash
npm run test:runtime-gate
```

Result:
- Vitest: `18 passed / 0 failed`
- Playwright runtime gate: completed successfully

### Targeted Interview + Tools deploy-gate

Command:
```bash
E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=true E2E_API_URL=http://127.0.0.1:3101 E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/deploy-gate-api-interview.spec.ts tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts --project=chromium --workers=1
```

Result:
- first passing run: `40 passed / 0 failed`
- final re-run after scoped formatting/import fixes: `40 passed / 0 failed`

### Scoped lint

Command:
```bash
npx eslint --quiet src/services/api.ts src/components/Interview/InterviewWorkspace.tsx src/components/Discovery/DiscoveryToolsHub.tsx tests/e2e/smoke/global-setup.ts tests/e2e/smoke/deploy-gate-api-interview.spec.ts tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts tests/unit/api.test.ts
```

Result:
- `PASS`

### Full repository gates

`npm run lint` was attempted and failed on pre-existing repository-wide formatting/import errors outside this recovery scope (`412 errors`). The touched files pass scoped ESLint after autofix.

`npm run type-check` was attempted and failed on pre-existing `WorkCanvasShell` errors outside this recovery scope. One touched-file error (`RefreshCw` missing import in `DiscoveryToolsHub`) was fixed before final scoped lint/unit/e2e reruns.

## Automation decision

Automation status: `PASS`

Manual retest still required on deployed demo/stage before changing release decision from `NO-GO` to `GO`.

