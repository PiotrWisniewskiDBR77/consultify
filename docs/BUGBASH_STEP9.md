# BUG BASH + HARDENING PASS (Step 9)

This document tracks issues found during the stabilization pass after the merge of AI Coach, Metrics, Action Proposals, and Help System features.

## Summary Table

| Issue ID | Description | Severity | Status | Fix / Mitigation |
|----------|-------------|----------|--------|------------------|
| BB-001 | `attribution_events` table missing in some contexts | High | In Progress | Ensure DB initialization is robust and idempotent |
| BB-002 | `action_decisions` table missing in some contexts | High | In Progress | Ensure DB initialization is robust and idempotent |
| BB-003 | Unit tests for Attribution, ActionDecisions, and PromoCodes are failing | Medium | In Progress | Fix test mocks and DB initialization in tests |
| BB-004 | PDF Export tests failing due to mock constructor issues | Low | Open | Update Vitest mocks for jsPDF |

## Initial Verification Results

### TypeScript
- Status: **PASS**
- Command: `npx tsc --noEmit --skipLibCheck`

### Unit Tests
- Status: **FAIL** (25 failed | 344 passed)
- Fails:
  - `attributionService.test.js` (no such table: attribution_events)
  - `actionDecision.service.test.js` (no such table: action_decisions)
  - `promoCodeService.test.js` (various logic/DB errors)
  - `pdfExport.test.ts` (mock constructor error)

### Integration Tests
- Status: **NOT RUN YET**

### Lint
- Status: **NOT RUN YET**

## Action Plan

1. **Harden Database Initialization**: Ensure all tables are created correctly and consistently, especially `attribution_events` and `action_decisions`.
2. **Implement Feature Flags**: Create `server/config/featureFlags.js`.
3. **Implement Request Context**: Create `server/utils/requestContext.js`.
4. **Fix RBAC & Org Context**: Audit critical endpoints.
5. **Normalize Error Codes**: Update API responses.
6. **Stabilize Tests**: Fix failing unit and integration tests.
