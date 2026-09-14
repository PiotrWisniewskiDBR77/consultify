# Second independent review repair — DEC-497 P2 E1

Verdict: **receipt-first replay semantics are proved after source Plan advancement**.

The route no longer rejects `inputAggregateVersion` before entering the material command. `executeMaterialCommand` checks the tenant-scoped receipt first. Only a new command enters domain preparation, locks the source Plan, compares its aggregate version with the requested version, and then invokes the deferred AI callback.

The callback receives the locked `source.payload` from domain preparation. It does not capture the older Plan snapshot loaded for authorization.

RealPG behavior:

1. Create the proposal from Plan aggregate v3: `APPLIED`; analyzer count 1.
2. Advance the source Plan aggregate and payload to v4.
3. Retry the identical proposal and `clientRequestId`: `REPLAYED`; response equals the first response; analyzer count remains 1.
4. Submit a new proposal and `clientRequestId` that still reference aggregate v3: standard 409 conflict with current version 4; its analyzer count remains 0.

The focused route RED proves the prior early 409 on replay. The GREEN proof returns 200 with the stored replay and no analyzer call.
