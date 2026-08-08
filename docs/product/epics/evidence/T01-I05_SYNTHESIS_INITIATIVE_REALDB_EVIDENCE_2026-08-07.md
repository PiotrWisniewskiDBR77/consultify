# T01-I05 — Opportunity synthesis and Initiative handoff realDB evidence — 2026-08-07

## Acceptance boundary

This increment connects the accepted discovery chain to the canonical Initiative
funnel without allowing the Agent to silently create or accept business records.

1. Opportunity synthesis requires Case-linked Ideas, accepted Interview Insights,
   a DRD Assessment and its current immutable accepted snapshot.
2. Preparing synthesis writes no `initiative_candidates`, `initiatives` or
   handoff receipts.
3. Human synthesis approval invokes the existing DRD accepted-output handoff and
   creates one canonical `initiative_candidates` row plus an idempotent
   `assessment_candidate_handoffs` receipt.
4. A pending Candidate cannot advance the Transformation Case.
5. Only an accepted Candidate with a durable `initiative_id` that resolves to a
   real canonical `initiatives` row advances the Case to `finance_kpi`.
6. Candidate and Initiative are linked to the Case separately and every gate is
   audit-recorded.

## Disposable PostgreSQL proof

Environment: isolated PostgreSQL 16 database `consultify_t01_i05`; no demo or
shared environment writes. The proof runner exited with code 0.

Observed sequence:

```text
before synthesis approval:
  initiative_candidates=0
  assessment_candidate_handoffs=0

after synthesis approval:
  proposal_status=applied
  canonical Candidate=1
  handoff receipt=1

attempt to advance a pending Candidate:
  TRANSFORMATION_INITIATIVE_NOT_ACCEPTED

after canonical acceptance receipt and durable Initiative:
  lifecycle_stage=finance_kpi
  Case version=10
  accepted Candidates=1
  Initiatives=1
  Candidate lineage links=1
  Initiative lineage links=1
  candidate-created audit events=1
  initiative-results-accepted audit events=1
```

Independent `psql` readback from inside the container confirmed:

```text
lifecycle_stage=finance_kpi
version=10
candidate_status=accepted
initiative_id=initiative-t01-i05
initiative_status=DRAFT
lineage_links=2
```

It also confirmed exactly one event for each of:
`transformation_synthesis.proposed`,
`transformation_synthesis.candidate_created` and
`transformation_initiative.results_accepted`.

## Automated checks

Backend contract and Agent Hub regression after wiring:

```text
Test Files  2 passed (2)
Tests       9 passed (9)
git diff --check: passed
```

## Agent Hub surface

The Transformation Case preview now exposes the governed sequence:

- prepare a non-materializing cross-source synthesis proposal;
- review the source counts and synthesis summary;
- approve/reject Candidate materialization;
- display the resulting canonical Candidate ID;
- verify the separately accepted Candidate-to-Initiative result before opening
  Finance and KPI.

## Scope truth

The proof seeds the outcome of the existing canonical Candidate acceptance flow
(accepted status plus its durable Initiative receipt), then proves the
Transformation adapter refuses the pending state and accepts the durable state.
It does not claim an end-user browser run of the full Candidate generator.

Status: backend adapter, realDB governance gates, lineage and Agent Hub controls
implemented. Browser runtime screenshots and tenant-isolation negative-path
evidence remain required before final epic acceptance.
