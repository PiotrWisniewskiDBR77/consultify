# Parallel Documentation Trees Classification

## Objective

Make parallel documentation trees understandable without merging them blindly.

## Authority Matrix

| Tree | Primary role | Authority | Working rule |
| --- | --- | --- | --- |
| `docs/` | long-term canonical documentation | Highest | New SSOTs, registries, strategy indexes, and maintained standards live here |
| `wdrozenia/` | tracked implementation program history | Historical | Preserve and classify; do not treat as product canon unless content is explicitly migrated |
| `Consulitinity przegląd/` | tracked audit evidence and review snapshots | Historical evidence | Preserve for traceability; do not treat as product or UI authority |

## Consolidation Rule

The cleanup default is **classification first, migration later**:

1. keep `docs/` as the canonical tree
2. keep `wdrozenia/` readable but explicitly historical
3. keep `Consulitinity przegląd/` readable but explicitly evidentiary
4. only migrate individual documents into `docs/` when ownership and canonical intent are confirmed

## What This Cleanup Pass Changes

- adds stub indexes in `wdrozenia/` and `Consulitinity przegląd/`
- links those trees back to the canonical cleanup policy
- avoids mass moves that would blur authorship and history

## What This Cleanup Pass Does Not Do

- no bulk file moves out of `wdrozenia/`
- no rewrite of old audits into current product doctrine
- no deletion of tracked evidence packs
