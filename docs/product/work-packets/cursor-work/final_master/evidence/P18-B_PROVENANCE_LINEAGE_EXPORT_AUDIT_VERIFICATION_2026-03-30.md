# P18-B — Provenance: lineage click-through + export audit (evidence-first)

Date: 2026-03-30  
Packet: `P18-B`  
Branch: `ws/c-artifact-evidence`

## Evidence ledger row (SSOT)
- Contract: `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_18_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` → section “## 10. Evidence ledger” → row `P18-B`

## Scope (bounded)
- Click-through lineage: **run → tool calls → output pointers** (bounded) visible from Outputs surfaces (library/preview/open) via **single trust-state API**.
- Export audit: export/share attempts are recorded in ledger and **respect visibility** (explicit denial; no leakage).
- Regression: preserve invariant **approve(run) ≠ review(artifact)** (axes remain separate in payload and surfaces).

## Automated tests (must-pass)

```bash
npx vitest run \
  tests/integration/routes/artifacts.routes.test.ts \
  tests/integration/routes/v8.execution.routes.test.ts
```

Expected:
- `GET /api/artifacts/:id/trust-state` returns `lineagePaths` (run/tool-usage/outputs) and preserves axis separation.
- `GET /api/v8/execution/runs/:runId/tool-usage` is deny-by-default for non-privileged users unless the run has at least one visible output.
- `GET /api/v8/execution/runs/:runId/outputs` returns only **visible** artifacts (no leakage).

## Staging proof script (contract P18-B §8.1, points 1–5)

Environment prerequisites:
- Two users in the **same org**:
  - **User A**: regular member (cannot manage access / cannot see private artifacts of others).
  - **User B**: admin/owner (can manage access / can see org artifacts).
- One artifact produced via an **ArtifactRun** (has `executionRunId`) and visible in Outputs.

### 1) Trust-state badges visible (stage / visibility / export)
1. Open **Outputs Library** and select an artifact row to open **Preview**.
2. Verify trust-state shows:
   - execution spine (`executionState` + `executionRunId`) as run posture (not “review approved”),
   - validation axis (`validationState`),
   - publish/review axis (`publishState` + reviewers/gates),
   - visibility scope,
   - export trace summary.

### 2) Click lineage: run → tool calls → output pointers (bounded)
1. In Preview locate **Execution run** and click **Trace**.
2. In the modal verify:
   - Run section (state + goal),
   - Tool calls list,
   - Output pointers list with open actions.

### 3) Stage change propagates consistently
1. Trigger a bounded stage change (validated/reviewed) using existing UI/API.
2. Verify badge updates in list row + preview + open artifact.

### 4) Export/share is recorded and does not bypass visibility
1. As **User A**, export a visible report (PDF) or presentation (PPTX).
2. Refresh Preview and verify `Export trace` increments and shows latest status.
3. As **User A**, attempt to export a non-visible artifact (e.g. another user private output).

Expected:
- Denied export returns safe 404 (no leakage); no export record appears in the denied artifact’s ledger.

### 5) Insufficient access denial is explicit (no leakage)
1. As **User A**, attempt to open `tool-usage` / `outputs` for a run that is not visible (no visible outputs for the user).

Expected:
- 404 with `code=RUN_NOT_FOUND` (fail-closed, no leakage).

## Evidence capture (fill during closeout)
- Tests: `npx vitest run tests/integration/routes/artifacts.routes.test.ts tests/integration/routes/v8.execution.routes.test.ts` — PASS (21 tests)
- Staging: Points 1–2 and 5 verified via integration tests (trust-state payload, lineage paths, deny-by-default). Points 3–4 (stage propagation, export recording) verified at API level. Full multi-user UI staging deferred — see P18-C known limits.
- Commit: `354be3330c`
