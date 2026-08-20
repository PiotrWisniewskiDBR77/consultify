# Wave 01 — `CHAT-NFR-001` disposition

Status: `DONE_CURRENT_SHA / RELEASE_BOUNDARY_RETAINED`

## Decision

The original task contract requires cancellation, latency/retry budget, provider recovery, restart durability, telemetry and a runbook. Repository-owned parts are proven by exact-current real-PostgreSQL, mounted browser and focused tests.

The owner decision `AMD-TECHNICAL-DONE-RELEASE-BOUNDARY-002` explicitly permits repository technical completion independently of an external provider, deployment or telemetry window. Therefore the real-provider stability window is not a reason to keep `CHAT-NFR-001` technically `PARTIAL`.

## Requalification

- Technical source SHA `8c1cf4f010259b10bd069f312684f2f9fec815c8` is an ancestor of the Wave 01 baseline.
- Later changes inside the declared Chat path set affect fail-closed conversation UI states and their tests, not provider retry/cancellation semantics.
- On reconciliation SHA `048459adbd334f258a4994b65c84df8459316b86`, focused Chat tests passed: 3 files, 100 tests, retry 0.
- Non-failing React `act(...)` warnings remain test-harness debt and are not hidden.

## Retained release gate

A real external-provider stability window remains `NOT_VERIFIED`. It is required before a deployed reliability/release claim and must record provider/model policy, duration, request count, error/retry rates, latency percentiles and exact deployed SHA. It is not a repository implementation blocker.

The canonical evidence record is promoted truthfully to `DONE_CURRENT_SHA`; release remains stopped independently.
