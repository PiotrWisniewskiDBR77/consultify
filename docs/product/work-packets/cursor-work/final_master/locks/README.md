# Locks (single-writer rule)

This directory holds lock files used to prevent parallel implementation of the same packet.

Workflow:

1. Before starting `P<NN>-<X>` (moving it to `in progress`), create `P<NN>-<X>.md`.
2. If the lock exists and is active, do not start.
3. Release only after `verified(evidence)`.

See: `docs/product/work-packets/cursor-work/final_master/EXECUTION_COORDINATION.md`

