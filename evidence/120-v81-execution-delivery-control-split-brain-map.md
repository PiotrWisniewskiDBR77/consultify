# V8.1 Execution / Delivery Control Split-Brain Map

Date: 2026-03-26
Lane: `Execution / delivery control`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `active`

## Current live surface

The live execution lane spans:

- `/execution`
- `/implementation`
- `/rollout`

with the main portfolio execution shell centered on `ExecutionHub`.

## Split-brain findings

1. duplicate execution entry URLs point into overlapping execution surfaces
2. route/auth guard coverage was inconsistent across `/execution`, `/implementation`, and `/rollout`
3. `ExecutionHub` mixes V8 execution-control reads with silent legacy fallbacks
4. legacy-only execution-control endpoints still back some panels
5. rollout and execution center remain parallel delivery surfaces
6. historical/orphan execution views still exist in the tree

## Smallest clean starting packet

Chosen packet:

- align route/auth protection for `/implementation` and `/rollout` with `/execution`

Why this packet:

- smallest bounded consistency cut
- no architecture rewrite required
- removes an immediate live route inconsistency before deeper execution-control convergence

## Follow-up candidates

- execution-control fallback discipline (no silent legacy downgrade on transient V8 failures)
- one canonical execution URL contract
- parity closure for legacy-only execution-control panel endpoints
