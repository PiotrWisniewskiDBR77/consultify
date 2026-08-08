# T01-I07 — Portfolio GO/NO-GO realDB evidence — 2026-08-07

## Governed contract

The Agent prepares a board-ready decision packet from the Case-linked Initiative,
approved Financial Analysis and versioned KPI. Proposal creation is non-mutating.
Human approval creates a canonical pending GO/NO-GO Decision in PMO domain
`GOVERNANCE_DECISION_MAKING`. A separate decision maker chooses GO or NO-GO.
The Transformation Case advances only when the current decision is approved with
GO and the canonical Initiative lifecycle independently reaches `APPROVED`.

## Isolated PostgreSQL proof

Database `consultify_t01_i07`, PostgreSQL 16, test-only initializer skip, no
shared/demo writes. Runner exited 0; container removed after readback.

```text
before packet approval: decisions=0
after packet approval: canonical pending Decision=1, Decision history created=1
pending decision gate: TRANSFORMATION_PORTFOLIO_GO_NOT_APPROVED
GO with DRAFT Initiative gate: TRANSFORMATION_INITIATIVE_NOT_PORTFOLIO_APPROVED
after canonical Decision service chose GO and Initiative reached APPROVED:
  lifecycle_stage=mobilization
  Case version=16
  approved GO decisions=1
  decision created history=1
  decision decided history=1
  Decision lineage links=1
  results-accepted audit events=1
```

Independent container `psql` readback confirmed Decision `approved/go`, PMO
domain `GOVERNANCE_DECISION_MAKING`, Initiative `APPROVED`, Case
`mobilization` v16.

> Superseded caveat: the earlier fixture used the generic Decision service and
> treated authorized resolution and downstream enforcement as pending. The
> current proof uses the governed U05 resolution endpoint and an exact receipt.

## Governed evidence pack and atomic resolution — current proof

The fresh native PostgreSQL run exits `0` and emits
`U05_DECISION_PACK_REALDB_GREEN` only after the complete T01 reaches
`final_outputs` at Case version `24`. The published packet preserves separate
supporting and contradicting evidence snapshots with an immutable SHA-256
digest and source Case version.

The proof asserts that a raw `approved/go` mutation cannot unlock downstream,
an unauthorized actor is denied, and a trigger-forced receipt failure rolls the
Decision transition and history back. Two concurrent requests with the same
`Idempotency-Key` return the same Decision and receipt identifiers and persist
one receipt; the same key with a different payload fails with an idempotency
conflict. Mobilization requires the exact receipt, evidence digest and source
Case version, plus the independently `APPROVED` Initiative.

## Checks and UI

```text
ESLint scoped checks: passed
git diff --check: passed
Test Files  2 passed (2)
Tests       11 passed (11)
```

Agent Hub now exposes decision-maker selection, packet review, creation of the
canonical Decision, a deep link to its workspace and the final GO plus
Initiative-status verification.

Status: local U05 owner adapter, evidence pack, authorized atomic resolution,
receipt-enforced downstream, lineage and native realDB proof are GREEN. U05
remains `PARTIAL` only for same-SHA deployed multi-role/browser acceptance.
