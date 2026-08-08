# T01-I06 — Finance and KPI adapter realDB evidence — 2026-08-07

> Historical checkpoint: the 4 GB type-check OOM below is superseded by later
> full TSC passes with the documented 8 GB heap. Browser/same-SHA acceptance
> remains open.

## Acceptance boundary

1. Agent calculates an Initiative business case from explicit CAPEX, annual
   OPEX, annual benefit, horizon and WACC; no value is silently assumed.
2. Proposal returns NPV, IRR, discounted payback, profitability index and a
   GO/CONDITIONAL/NO-GO verdict together with a KPI definition.
3. Proposal creation writes no Financial Analysis or KPI.
4. Human approval creates a canonical DRAFT `financial_analyses` record and a
   canonical `initiative_kpis` record through the existing versioned KPI writer.
5. The KPI receives immutable definition version 1 and remains linked to the
   accepted Initiative.
6. A DRAFT financial analysis cannot advance the Case. Only `APPROVED` plus the
   versioned KPI advances to `portfolio_decision`.

## Disposable PostgreSQL proof

Isolated PostgreSQL 16 database `consultify_t01_i06`; no shared/demo writes.
The canonical PostgreSQL writers ran with the documented test-only initializer
skip because the fixture intentionally contains only in-scope tables. Runner
exit code: 0. Container removed after readback.

```text
before proposal approval:
  financial_analyses=0
  initiative_kpis=0

after proposal approval:
  Financial Analysis status=DRAFT
  Initiative KPI=1
  KPI definition versions=1

attempt to accept DRAFT analysis:
  TRANSFORMATION_FINANCE_KPI_NOT_APPROVED

after independent Finance approval:
  lifecycle_stage=portfolio_decision
  Case version=13
  approved analyses=1
  Initiative KPIs=1
  Financial Analysis lineage links=1
  KPI lineage links=1
  results-accepted audit events=1
```

Independent `psql` readback confirmed `APPROVED`, KPI definition version 1,
baseline 8, target 3 and lifecycle `portfolio_decision`.

## Automated and UI checks

```text
ESLint scoped checks: passed
git diff --check: passed
Test Files  2 passed (2)
Tests       10 passed (10)
```

Agent Hub exposes economics inputs, calculated business-case summary/verdict,
KPI baseline/target, a separate materialization approval and a final control
that refuses to move on until Finance has approved the canonical analysis.

## Remaining evidence

- Browser screenshots of proposal, materialized DRAFT and approved states.
- Tenant-isolation negative path.
- Full repository typecheck: the latest attempt exhausted Node's 4 GB heap and
  is not counted as passed.

Status: backend, realDB governance, canonical writers, lineage and Agent Hub
controls implemented; final epic acceptance remains pending runtime visual and
isolation evidence.
