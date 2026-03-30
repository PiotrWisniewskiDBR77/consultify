# P17-B Evidence — ArtifactRun validation/preflight + failure packaging + rerun closure
Date: 2026-03-30  
Packet: **P17-B**  
State: delivered (tests green; staging proof script prepared)

## Context pack (max 5, SSOT order)
1. Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
2. Contract: `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_17_ARTIFACTRUN_Z_CZATU_2026-03-29.md` (section **#### P17-B**)
3. Runtime gate: `docs/product/work-packets/cursor-work/final_master/NEXT_PACKET.md` (P17-B authorized in Runtime)
4. Existing ArtifactRun routes + substrate: `server/src/routes/artifact-runs.routes.ts`, `server/src/services/v8/artifactRegistryService.ts`
5. Baseline integration test: `tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts`

Related scope freeze (P17-A lock):
- `docs/product/work-packets/cursor-work/final_master/locks/P17-A.md`

---

## Automated tests (run locally)

### Test batch (expected green after P17-B implementation)

```bash
npx vitest run \
  tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts \
  tests/integration/routes/artifact-runs.routes.preflight-and-failure.sqlite.integration.test.ts \
  tests/components/AIChat/V8ArtifactRunControl.test.tsx
```

### P17-B additions (implemented)

```bash
npx vitest run \
  tests/integration/routes/artifact-runs.routes.preflight-and-failure.sqlite.integration.test.ts
```

Expected coverage (P17-B):
- explicit **preflight/validation** stage exists and is separately addressable (API + payload)
- **failure packaging** on a controlled failure (e.g. bounded validation error)
- **retry/rerun** keeps lineage and does not create “ghost artifacts” (no Outputs artifact created by the failed attempt)

---

## Staging proof script (click-by-click, contract P17-B steps 1–5)

Target surface: governed chat ArtifactRun control (`src/components/AIChat/V8ArtifactRunControl.tsx`) + API `/api/artifact-runs/*`.

### Scenario — one bounded artifact run + failure + retry (no ghost artifacts)

1) In chat, request an artifact that requires a run (bounded format).
   - Use the ArtifactRun control to **Plan output** (any one lane: Document/Presentation/Sheet).

2) Observe plan → approve(run) and confirm validation/preflight is shown as a **distinct stage**.
   - Preflight/validation must be rendered separately (not blended into “Plan created”).

3) Let the run materialize and open the artifact; verify lineage is visible.
   - Confirm materialization yields an `artifactId`.
   - Confirm Outputs Library shows the artifact.
   - Confirm run history shows the original run.

4) Trigger a failure (e.g., missing permission/tool error) and confirm status is `failed` with recovery guidance.
   - Bounded staging failure option (no permission setup required): attempt materialization with a deliberately invalid input
     (e.g. sheet materialize without required target / invalid config) to produce a controlled failure.
   - Expected: run becomes `failed` and UI shows actionable recovery hint (“Retry / fix inputs and rerun”).

5) Retry/rerun and verify no duplicate “ghost” artifacts appear; lineage links to the rerun.
   - Click **Retry**.
   - Confirm history shows original + retry run.
   - Confirm the failed attempt did **not** create a stray Outputs artifact.
   - Materialize successfully and confirm only one final artifact appears (no duplicates from the failed attempt).

Capture:
- short screen recording (or screenshots) of steps 2–5 (preflight stage, failure packaging, retry lineage, Outputs list).

---

## Known limits (explicit, bounded)
- Preflight is **validation posture**, not a full simulator of tool execution; it is intended to surface missing prerequisites early.
- Failure demo in staging may use a **controlled validation/materialization input failure** instead of a real permissions failure.

