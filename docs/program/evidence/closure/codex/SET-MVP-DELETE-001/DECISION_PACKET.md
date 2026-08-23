# SET-MVP-DELETE-001 — destructive deletion policy decision packet

Date: 2026-08-23
Current status: `APPROVED_RESTRICTED_SCOPE / DESTRUCTIVE_EXECUTION_OFF`
Production or Railway mutation: `NOT_AUTHORIZED`

## Decision already in force

Owner amendment `INTERNAL-BETA-OWNER-DECISIONS-20260817-AMENDMENT-01`, decision
`AMD-SET-DELETE-APPROVED-OUT-001`, permits authenticated request, status and
cancellation workflows. It does **not** permit anonymization or purge.

The current fail-closed position must remain:

- a missing password creates no request;
- a wrong password creates no request;
- a user without an organization fails closed;
- request scheduling and cancellation may persist workflow records;
- no worker, route, scheduler or operator may anonymize or purge application
  data under this decision.

## Evidence currently available

The evidence packet records `9/9` focused RealPG tests and zero destructive
executions. Current source still contains the explicit
`SET_DELETE_APPROVED_OUT` / `destructiveExecution: false` contract and the
canonical Settings route states that destructive execution remains disabled
pending policy approval.

This packet does not claim a final-candidate rerun. The focused test files have
changed since the historical product SHA, so they must be rerun after one
candidate is frozen.

## Owner matrix required before reopening destructive execution

Legal/Privacy must approve a versioned row for every data class. Blank cells
mean `NOT_AUTHORIZED`, not “use the default.”

| Data class                                          | Request action | Retention / delay | Legal hold override | Backup treatment | Restore treatment | Irreversible action | Evidence owner                |
| --------------------------------------------------- | -------------- | ----------------- | ------------------- | ---------------- | ----------------- | ------------------- | ----------------------------- |
| Identity and authentication                         | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Privacy + Security    |
| Organization membership and roles                   | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Privacy               |
| User-created content and attachments                | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Privacy + Product     |
| Assessment, interview and tool evidence             | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Privacy + Methodology |
| Initiatives, execution, results and finance lineage | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Finance + Product     |
| Audit, security and immutable governance receipts   | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Security              |
| Billing, partner, tax and payout records            | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Finance               |
| Logs, telemetry and support records                 | `UNKNOWN`      | `UNKNOWN`         | `UNKNOWN`           | `UNKNOWN`        | `UNKNOWN`         | `UNKNOWN`           | Legal + Privacy + Security    |

Each approved row also requires jurisdiction, policy version, effective date,
approver identities, exception process and evidence invalidation rules.

## Activation gates

All gates are mandatory:

1. Legal/Privacy approves the complete matrix above.
2. Backup owner proves the approved behavior in live backup, expiry and restore
   scenarios; deletion from the primary database alone is insufficient.
3. Engineering implements a separately reviewable executor with dry-run,
   tenant scoping, legal-hold precondition, idempotency and immutable receipt.
4. Negative controls prove no cross-tenant action, no partial purge, no bypass
   and recovery from interruption.
5. Signed owner acceptance occurs on one frozen SHA and named disposable data.
6. Production activation is separately and explicitly authorized.

Until all six gates close, the only valid answer is
`DESTRUCTIVE_EXECUTION_OFF`.
