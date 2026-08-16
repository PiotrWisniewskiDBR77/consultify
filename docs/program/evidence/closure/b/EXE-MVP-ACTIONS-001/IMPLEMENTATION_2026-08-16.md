# EXE-MVP-ACTIONS-001 implementation evidence — 2026-08-16

## Runtime truth

`execution_action_registry` contains 13 explicitly enumerated actions:

- 9 `IMPLEMENTED` actions with a fail-closed role policy;
- 4 `HIDDEN` actions matching the already hidden/disabled Initiative and
  report controls;
- every destructive action requires at least `ADMIN`, with Initiative delete
  reserved for `OWNER` if it is ever implemented;
- every entry is marked audit-required.

`execution_action_audit` is append-only application data. The budget deletion
route now resolves `execution.budget.delete` from the registry and records
`SUCCEEDED` or `NOT_FOUND`. Case Workspace mutations already append immutable
domain/outbox facts; the route layer now adds the missing ADMIN floor before:

- Case CLOSED/CANCELLED, closure and cancellation;
- proposal approval, transition-to-executing and revocation;
- run cancellation;
- wait cancellation;
- artifact unlink.

Budget deletion is now scoped by entry ID + organization ID + Initiative ID,
uses `fallback:false`, checks affected rows, returns 404 on a no-op, and does
not recalculate/export when nothing was deleted.

## Owned implementation paths

- `server/migrations/20260908_execution_bvp_spine.sql`
- `server/src/services/executionActionRegistryService.ts`
- `server/src/services/executionBudgetService.ts`
- `server/src/routes/executionControl.routes.ts`
- five `server/src/routes/caseWorkspace/*.routes.ts` role-floor files
- three corresponding route tests
- `server/src/services/__tests__/executionBudgetDelete.test.ts`

## Tests

```text
npx vitest run \
  src/services/__tests__/executionBudgetDelete.test.ts \
  src/routes/caseWorkspace/__tests__/cases.routes.test.ts \
  src/routes/caseWorkspace/__tests__/actionProposals.routes.test.ts \
  src/routes/caseWorkspace/__tests__/artifactLinks.routes.test.ts \
  src/routes/caseWorkspace/__tests__/waitSubscriptions.routes.test.ts \
  --reporter=dot
```

Result: exit 0; 6/6 files, 32/32 tests. Negative controls prove MEMBER cannot
approve a proposal or unlink an artifact and that a wrong budget tuple has
zero recalc/export effects.

`cd server && npx tsc --noEmit --pretty false`: exit 0.

## Remaining evidence boundary

No UI was changed. Hidden controls stay hidden. No owner-gated adapter was
touched. Mounted-browser G4 is outside this backend-only action-policy packet.

## Verdict

`PASS_LOCAL`. The enumerated action denominator is 13/13 dispositioned
(9 implemented, 4 hidden); focused runtime tests are 32/32.
