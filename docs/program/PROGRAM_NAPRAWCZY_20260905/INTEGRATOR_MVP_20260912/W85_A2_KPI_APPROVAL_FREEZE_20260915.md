# W85 A-2 — KPI approval freeze (DEC-499)

**Verdict: READY FOR CTO REVIEW.** A-2 extends the existing immutable Initiative-card approval engine; it does not introduce a parallel KPI approval store.

## Lineage and scope

- Program line base: `9badae5335` (W87).
- Required dependency: A-1 final `a6acc349cc9558eb8e7b82633127371dc34deb52` (DEC-489 estimate and the shared approval engine).
- Branch: `codex/f2-a2-initiative-kpi-approval-20260915`.
- KROK 0: `W85_A2_KPI_KROK0_20260915.md`. The existing 1225-line KPI editor, `AIKpiProposal` flow and KPI API were retained. The delta adds only review, execution readback and evidence.
- Feature gate: `VITE_INITIATIVES_PORTFOLIO_ANALYSIS`, default OFF; `Dockerfile.api` contains matching ARG and ENV. The line does not yet contain the later `check:flagi:dockerfile` npm script, so the Docker entries were verified directly.

## Delivered behavior

- The KPI card exposes an AI-proposal explanation, current review state, submit action and a visible approval action.
- Authorization is fail-closed: an unauthorized reviewer sees a disabled approval action with an explanation.
- Publishing stores the exact KPI IDs and measurement snapshot in the existing `ie_initiative_card_versions` engine. Independent review changes REQUESTED to ACCEPTED.
- Execution reads the canonical KPI and marks it `approvedForExecution` only when the latest card is ACCEPTED and the live KPI still matches the accepted measurement snapshot. Editing a target, cadence, unit, phase or name invalidates the old approval.
- No A-2 migration and no new table. A-2 reuses the additive A-1 migration and its rollback.
- Compatibility fix carried in this branch: A-1 previously wrote `estimated_at` even for cards without an estimate, violating its own tuple constraint. The write now sets `estimated_at` only when `estimated_value` exists. Both estimate and non-estimate RealPG paths pass.

## Evidence

- Real PostgreSQL `127.0.0.1:6459/cx8_e0`: 1/1 A-2 test PASS. It proves REQUESTED=false, independent ACCEPT=true, receipt identity/version, and a later KPI target change=true→false.
- A-1 estimate regression on the same database: 1/1 PASS.
- KPI approval UI behavior: 2/2 PASS.
- `InitiativeDocumentView` importer family: 18/18 PASS (autosave 10, canonical navigation 6, fail-closed 1, persisted sections 1).
- Planning read siblings: task dependencies 4/4 PASS, forecast dates 2/2 PASS. `planningPortfolioReadService.support-tables.test.ts` remains 5 PASS / 1 RED from the line: source and base `9badae5335` use `NULL as "influenceLevel"`, while the old assertion expects the unquoted alias.
- Production build: PASS (`npm run build`, 10,953 modules, 1m17s). Existing CSS/chunk warnings remain.
- `check:artefakt`: PASS, 8 / 0 / 117, no increase.
- `check:list-canon`: PASS, 349, no increase.
- `check:jezyk:ci`: PASS, no increase.
- Server type check: line 22, candidate 22; first errors remain `server/src/index.ts:1579`, `assessment-reports.routes.ts:3170`, `benefits.routes.ts:941`.
- Front type check: line 193 from W87; candidate command did not finish within the mandatory 120-second limit and was stopped, therefore candidate count is `TIMEOUT_120 / NOT_PROVEN` rather than an inferred 193.
- Delta contains zero new `as any`.
- Visual receipt, inspected EN/light in the initiative shell, 2880×2000, 456,698 bytes: `evidence/a2-kpi-approval/a2-initiative-kpi-approval-en-light.png`. Browser assertions: approval disabled for unauthorized user, status visible, zero page errors.

## Demo readiness and cleanup

- No staging/demo connection, writes, record IDs, deploy or protected-branch push.
- Local RealPG fixtures delete organization, initiative, KPI, mapping, card versions, aggregate state, audit/outbox and command receipts after each run.
- Feature remains OFF by default.
- Local PostgreSQL container may be removed after the freeze commit and exact backup verification.
