# Finance Import Architecture Decision

## Decision
Proceed with a controlled rebuild of the extraction and mapping core while preserving the existing audit, readiness, and downstream-gating shell.

## Status
Accepted for remediation planning.

## Why This Decision
Audit evidence shows that the current core fails on correctness, not just ergonomics:

- numeric parsing corrupts values by concatenating period tokens into measures
- extraction misses required rows in simple bootstrap cases
- cash flow mapping still fails on recognizable Polish statement language
- threshold-based benchmarks are insufficient to certify improvements

These are not isolated UX defects. They are core interpretation defects inside extraction and mapping.

## What We Preserve
The following parts are strategically sound and should remain:
- `statement-ready` contract
- ingest runs and source artifacts
- candidate row and mapping candidate persistence
- validation ledger
- version snapshots
- repair sessions
- pack and downstream gating

Primary shell anchors:
- `server/src/routes/finance-statements.routes.ts`
- `server/src/services/financialStatementPackService.ts`
- `docs/product/STATEMENT_READY_CONTRACT.md`

## What We Rebuild

### 1. Document understanding core
Target:
- statement section resolution
- period grid resolution
- unit/scaling interpretation
- row segmentation per table/section

### 2. Structured row model
Each extracted row must become a strongly-typed object with:
- statement section
- selected period
- numeric token provenance
- row hierarchy
- subtotal hints
- source page and source row
- row classification metadata

### 3. Deterministic mapping solver
Move from mostly lexical alias matching to constrained mapping using:
- row neighborhoods
- section boundaries
- subtotal anchors
- arithmetic tie-outs
- sign behavior
- template/document-family rules

## Why Not Pure Layered Repair
A pure layered repair would only be justified if most defects came from:
- frontend evidence loss
- persistence drift
- ownership split between client and server

The bootstrap corpus already shows the opposite: even before the user touches recovery, the core extraction layer emits wrong numbers and the mapping layer misclassifies obvious cash flow rows.

## Rebuild Boundary
This is not a full rewrite of the finance module.

We should keep:
- route shell
- readiness lifecycle
- validation and downstream contracts
- auditability tables

We should replace:
- section/period binding logic
- extraction normalization logic
- canonical mapping selection core

## Exit Criteria For The Rebuild
- exact-output corpus passes on the bootstrap suite and the real redacted corpus
- no period-token concatenation defects remain
- no obvious cash flow directional misclassification remains
- frontend review surfaces can explain every mapped line with durable evidence
