# Independent review repair — DEC-497 P2 E1

Verdict: **both E1 blockers are repaired and ready for independent re-review**.

## B1 — authorized Plan identity and version before AI

The route normalizes `:scenarioId` and requires the request body to name that same scenario. Source-version validation is performed in domain preparation after receipt lookup and before snapshot construction or analyzer invocation. A fresh stale request returns the standard 409 version/idempotency conflict.

Focused tests prove both the URL/body mismatch and stale-version path leave the analyzer call count at zero.

## B2 — replay does not call AI again

AI execution is a deferred `prepareDependencyAnalysis` callback passed separately from the fingerprinted command envelope. `executeMaterialCommand` checks `ie_command_receipts` and the proposal aggregate version before the domain prepare callback runs. Domain preparation then locks and validates the source Plan before invoking AI. The envelope contains stable `analysisKind=AI_DEPENDENCY`, while nondeterministic AI output is persisted only after preparation.

The RealPG test submits the same organization, proposal, and `clientRequestId`, advances the source Plan from v3 to v4, and then retries. The first response is `APPLIED`, the retry is `REPLAYED`, both responses are equal, and the analyzer spy is called exactly once. A new proposal and `clientRequestId` that still name v3 receive a 409 conflict and their analyzer is never called.

## Rebase and runtime

The repair was rebased onto `origin/integracja/20260911` at `d9a2374d461d8e7901ae25318e2976f31d603334` before the final verification. The isolated PostgreSQL container `cx-s3-plan-pg` runs on port 6455 with restart policy `unless-stopped`; 914 migrations were applied again after the Colima restart.
