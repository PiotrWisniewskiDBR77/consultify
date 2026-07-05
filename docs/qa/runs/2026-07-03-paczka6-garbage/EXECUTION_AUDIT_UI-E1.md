# PACZKA 6 #64 — Execution (UI-E1) audit verdict (2026-07-03)

## Bottom line
**UI-E1 is NOT dead/stubbed functionality. It is real code over real SQL, showing
garbage because the demo DB (DBR77) held E2E test rows. "gap-reports overstate"
pattern confirmed.** All 3 symptoms → real code + dirty data. **No code fix — the
data-hygiene fix is #61 (done: 64 rows deleted, incl. the 13 "E2E benefit" rows
that fed Execution's "Rejestr korzyści").**

## Per-symptom verdict
1. **Rollout → KPI Tracking tiles** — REAL, correctly computed. `deriveKpis(initiatives)`
   in `src/components/Execution/RolloutTab.tsx:166-243`; persisted list backed by
   `GET /api/rollout/kpis` → `SELECT … FROM rollout_kpis WHERE organization_id=?`
   (`server/src/routes/rollout.routes.ts:88-104`). 0/0% = honest output of an empty/
   low-progress demo portfolio, not a stub.
2. **Reporting "Live Data" column** — REAL binding. Templates are a catalog
   (`ExecutionHub.tsx:3826-4189`) but each row's highlights bind to live-loaded
   snapshot/initiatives/tasks/decisions (`3837-3845`, `4407-4431`). "—"/"0" = genuine
   zeros on an empty portfolio.
3. **Management "Rejestr korzyści" (16× "E2E KPI n") + counters (212/24/247)** —
   REAL code, DIRTY data. `GET /api/benefits-register/benefits` →
   `SELECT * FROM benefits_register WHERE organization_id=?`
   (`server/src/services/benefitsRegisterService.ts:83-101`); counters from
   `managerProblemsService`/`ExecutionController.ts:831-1058` real per-lane SQL.
   The "E2E KPI <Date.now()>" rows come from live E2E specs. **#61 deleted these.**

## Wykonanie decyzji Q1 (initiatives live only in Initiatives)
Q1 (Piotr, 2026-07-03): Initiatives module = single source of truth for initiative
lists/statuses. Applied to Execution:
- **Summary/list tab** of ExecutionHub renders a `FilterableTable` of initiatives
  (filtered to execution statuses) + preview panel (`ExecutionHub.tsx` ~5201).
  Under Q1 this is a **duplicated initiative-portfolio view → should be removed or
  redirected to the Initiatives module**, not "fixed" by wiring more data in.
- It is threaded through a 5,379-line hub (tabs, deep-links, bulk-select) →
  **NOT a trivial 1-file change**; flagged for a scoped follow-up, not done in this
  hotfix window.
- The other tabs (Rollout / Reporting / Management = tasks, rollout, benefits) are
  the **legitimate execution layer** and stay.

## Recommendation
- No code change for the "zero functionality" impression — resolved by #61 (dirty
  data removed). Symptoms 1–2 will show real numbers once the demo portfolio has
  real progress/dates.
- Separate scoped task (post-hotfix): remove/redirect the Execution Summary
  initiative-list per Q1.
