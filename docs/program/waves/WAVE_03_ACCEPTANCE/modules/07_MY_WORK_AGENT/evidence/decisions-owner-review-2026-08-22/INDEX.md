# My Work / Decisions — owner review evidence — 2026-08-22

Classification: `INTERNAL_RESTRICTED`

| Evidence ID | Source | SHA-256 | Proves | Does not prove |
|---|---|---|---|---|
| `MYW-DEC-EVD-001` | Owner screenshot, 17:11:23 local | `2a0ba7c45539158c566762b18fc1de69e4c0b0828bd30c28efb8b000ea839d14` | Benefits/Effectiveness/Closure and internal creation forms render above the decisions register. | Persistence, API correctness, permissions or the remediated state. |
| `MYW-DEC-EVD-002` | Owner screenshot, 17:11:47 local | `c403aeba90cfadc5128673d2c698f634118d3bddcd585ab0a974b4275853d744` | The unrelated stack occupies several screens before the canonical table headed Decision/Type/Status/Priority/Due/Project. | Owner acceptance of the remediation or backend state. |

Owner direction: the Decisions list must begin directly with the canonical
decisions table, analogously to the Tasks list. The screenshots were copied from
the temporary capture paths during intake and hashed after the durable copy.

Current result: `IMPLEMENTED_WORKTREE / SELF_QA_PASS / OWNER_RETEST_PENDING`.
The implementation SHA remains unavailable until the working-tree change is
committed; no acceptance is inferred.
