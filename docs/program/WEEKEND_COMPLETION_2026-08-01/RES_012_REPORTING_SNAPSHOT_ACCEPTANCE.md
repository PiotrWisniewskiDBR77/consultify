# RES-12 — Reporting snapshot acceptance

**Status:** `CODE_GO_FROZEN` (local acceptance)  
**Date:** 2026-08-02  
**Scope:** immutable, period-bounded KPI snapshot with Report Builder lineage

## Accepted contract

- Snapshot creation reads KPI measurements and open deviation cases from one pinned PostgreSQL transaction.
- A bounded report uses only measurements inside the requested period. It never substitutes a live `current_value` for missing historical data.
- Requested KPI identifiers must all belong to the authenticated organization; missing or foreign identifiers fail closed with `404 / RESULTS_KPI_REPORT_KPI_NOT_FOUND`.
- Stored snapshot JSON is immutable. Refresh creates a new snapshot and report rather than changing the previous version.
- Report Builder receives explicit `RESULTS_KPI_REPORT` lineage, the snapshot identifier and prefilled KPI sections. Section-prefill failure is fatal to the request; the API no longer reports a partially prepared report as successful.
- Snapshot reads are organization-scoped. A user with an active membership in another organization receives `404`.
- Measurement dates are serialized as stable `YYYY-MM-DD` values, independent of server timezone.

## Evidence

Real PostgreSQL acceptance:

```text
tests/acceptance/res-012-reporting-snapshot.realdb.test.ts
3 passed
```

The test proves:

1. a February snapshot selects the February value `40` even when a newer March value `99` exists;
2. the stored report can be reopened and contains source lineage plus all five governed KPI sections;
3. changing the source measurement to `90` does not change v1, while refresh creates v2 with `90`;
4. a second tenant cannot read v1;
5. the first tenant cannot create a snapshot from the second tenant's KPI.

Scoped regression suite:

```text
server/src/routes/v8/__tests__/results.routes.test.ts
server/src/routes/v8/__tests__/p04-kpi-workflow.test.ts
src/components/Results/__tests__/ResultsKpiReportsView.smoke.test.tsx
tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx
121 passed, 1 skipped
```

## Remaining deployment gate

Local `CODE_GO_FROZEN` does not assert deployment. Railway migration/parity and an authenticated browser smoke remain environment gates and must not be inferred from this acceptance.
