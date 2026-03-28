# V8.1 Artifact Runtime Evidence Pack

> Status: historical local evidence pack
> Scope: `V8.1` artifact runtime, Outputs Library, My Work outputs bridge, and final local closure evidence
> Authority: supports `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md` and `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
> Last updated: 2026-03-24

---

## 1. Current closure statement

The current repo state supports an honest local claim that:

- canonical artifact registry flows are active under `/api/artifacts`,
- governed chat-driven `ArtifactRun` completion works for `document` and `presentation`,
- governed `sheet` behavior exists through the registry-backed table registration/export path,
- `My Work` consumes the bundled canonical outputs endpoint,
- object-linked initiative outputs are now visible from key work surfaces,
- and Outputs Library surfaces expose more of the documented artifact semantics.

The current repo state now supports an honest claim that the narrow `V8.1` artifact-runtime slice is closed on staging for governed `report` materialization.

---

## 2. Local proof completed

### Backend/runtime proof

- `tests/integration/services/artifactRegistryService.sqlite.integration.test.ts`
  - passes for:
    - canonical origin registration,
    - access-control visibility rules,
    - My Work lane assembly,
    - governed sheet registration,
    - `ArtifactRun` completion for `report`,
    - `ArtifactRun` completion for `presentation`,
    - retry lineage.

- `tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts`
  - passes for:
    - `POST /from-chat`
    - `POST /:runId/accept-plan`
    - `POST /:runId/materialize`
    - `POST /:runId/retry`
    - governed `presentation` route materialization.

### Frontend/surface proof

- `tests/components/AIChat/V8ArtifactRunControl.test.tsx`
  - passes for:
    - governed run planning from latest snapshot,
    - `document` option,
    - `presentation` option,
    - governed `presentation` materialization path from chat control.

- `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`
  - passes for:
    - canonical `/api/artifacts` aggregate fetch,
    - `report` / `presentation` / `sheet` format fetches,
    - canonical `/api/artifacts/my-work`,
    - fail-closed behavior when canonical registry is unavailable.

- `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx`
- `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.canonicalDataPath.test.tsx`
  - prove the unified Outputs Library taxonomy and registry-backed data path.
  - also prove richer aggregate semantics for:
    - visibility,
    - review state,
    - export state,
    - and source-context traceability.

- `tests/components/MyWork/HomeView.outputs.test.tsx`
  - proves `My Work > Home` now exposes:
    - `Needs review`
    - `Recent mine`
    - `Recent outputs`
    - and routes back into the shared outputs system.

- `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`
  - also proves:
    - initiative-linked canonical outputs fetch for one initiative,
    - multi-initiative canonical outputs aggregation and deduplication for backlink-driven surfaces.

### Workspace object-linked surface proof

- `src/components/Initiatives/InitiativeCompactPanel.tsx`
  - exposes an Outputs tab backed by canonical initiative-linked artifact rows.

- `src/components/Economics/FinancialAnalysisPanel.tsx`
  - exposes a Linked Outputs section for analyses that are attached to an initiative.

- `src/components/MyWork/notebook/NotebookContextPanel.tsx`
  - exposes a Linked outputs block backed by real initiative backlinks from the note graph and canonical artifact rows fetched for those linked initiatives.

This gives the current repo an honest local claim that object-linked outputs are no longer limited to the central Outputs Library and My Work home lanes.

---

## 3. Honest scope statement for sheet

`sheet` is currently treated as:

- implemented as a first-class canonical artifact type in the registry,
- implemented for governed table-platform registration/open/export flows,
- visible in Outputs Library and My Work surfaces,
- and now also closed for bounded chat-driven `ArtifactRun` materialization parity with `document` and
  `presentation` when the run targets an existing governed table artifact.

The remaining honesty boundary is no longer `sheet ArtifactRun` materialization itself, but broader spreadsheet
generation/publishing breadth beyond the existing governed table-target path.

---

## 4. Deep-flow summary

The strongest local deep-flow evidence currently executed is:

- `chat -> plan -> accept -> materialize` for `document`,
- `chat -> plan -> accept -> materialize` for `presentation`,
- `chat -> plan -> accept -> materialize` for bounded `sheet`,
- governed table-platform registration/open/export for `sheet`,
- My Work canonical lane rendering,
- notebook object-linked output rendering through real initiative backlinks.

Executed local targeted suite on 2026-03-24:

- `tests/integration/services/artifactRegistryService.sqlite.integration.test.ts`
- `tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts`
- `tests/integration/routes/table-platform.sheet-artifact.sqlite.integration.test.ts`
- `tests/components/AIChat/V8ArtifactRunControl.test.tsx`
- `tests/components/MyWork/HomeView.outputs.test.tsx`
- `tests/components/MyWork/NotebookContextPanel.outputs.test.tsx`
- `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`
- `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.canonicalDataPath.test.tsx`

Result:

- `8` files passed
- `40` tests passed
- `0` failed
- `0` skipped

---

## 5. Broad smoke summary

Local browser-runtime smoke also passed for the canonical Outputs Library path:

- command: `npm run test:l4:local:outputs-library`
- spec: `tests/e2e/smoke/outputs-library-canonical-artifacts.spec.ts`
- result: `1 passed`

This gives a real browser proof that the Outputs Library Mine tab can render registry-shaped rows through the local L4 harness rather than only through component tests.

---

## 6. Staging summary

Live staging verification has now been collected for the supporting governed runtime chain around the `V8.1` artifact slice, including direct `/api/artifact-runs` planning proof.

Staging evidence captured:

- `evidence/01-preflight.txt` - staging preflight reached `4/4 checks passed`
- `evidence/03-migration-verify-final.txt` - staging schema verification reached `119/119` expected `v8` tables
- `evidence/05-smoke-test.json` - live staging smoke reached `10/10` passing checks for health, admin, chat and AI-core routes
- `evidence/06-flags.json` - per-org `chat`, `ai_core` and `outputs` flags were read and set successfully on staging
- `evidence/09-v81-execution-proof.json` - governed execution staging proof reached `GET /runs = 200`, `POST /runs = 201`, `GET run/transitions/proposals = 200`
- `evidence/10-v81-retrieval-proof.json` - governed retrieval staging proof reached `GET/POST request = 200/201`, `pipeline = 200`, `logTrace = 201`, `conversation traces = 200`
- `evidence/12-v81-migration-apply-after-runner-fix.txt` - staging migration apply reached `50/50` after fixing the runner to include `v81` files and respect manifest order
- `evidence/13-v81-migration-verify-after-runner-fix.txt` - staging schema verification now reaches `122/122` expected `v8` tables
- `evidence/14-v81-artifact-run-proof-final.json` - direct artifact runtime staging proof reached `snapshot = 201`, `from-chat = 201`, `get = 200`, `accept-plan = 200`, then narrowed the remaining blocker to `materialize(report) = 500`
- `evidence/15-v81-artifact-run-proof-explicit-source.json` - a fresh run with explicit `ASSESSMENT` source binding narrowed the data blocker to `failureReason = Assessment not found`
- `evidence/17-v81-artifact-run-proof-after-final-fixes.json` - final direct artifact runtime staging proof reached `snapshot = 201`, `from-chat = 201`, `accept-plan = 200`, `materialize(report) = 200`, and final run `completed`

Current status:

- local evidence: strong
- browser smoke: present
- live staging evidence: strong and final-step complete for governed `report`

What is still missing on staging:

- direct Outputs-facing browser proof against live staging rather than the local L4 harness

Current nuance for the direct artifact route:

- `evidence/11-v81-artifact-run-proof.json` shows that a real staging `POST /api/v8/chat/snapshots` probe reached `201`,
- the earlier follow-up synthetic-token `POST /api/artifact-runs/from-chat` probe returned `500` because the staging migration runner had silently skipped `v81` SQL files, leaving `v8_artifact_runs` undeployed,
- `evidence/12-v81-migration-apply-after-runner-fix.txt` and `evidence/13-v81-migration-verify-after-runner-fix.txt` prove that this runner defect has now been corrected on staging,
- `evidence/14-v81-artifact-run-proof-final.json` proved the direct audited artifact path through `snapshot -> from-chat -> get -> accept-plan`,
- `evidence/15-v81-artifact-run-proof-explicit-source.json` narrowed the remaining blocker to missing assessment source data in the UUID tenant,
- the staging substrate was then seeded minimally for the UUID tenant,
- and `evidence/17-v81-artifact-run-proof-after-final-fixes.json` now proves the full direct audited artifact path through `snapshot -> from-chat -> accept-plan -> materialize`.

This means the narrow artifact-runtime slice is now materially green on staging even though the full frozen package is not yet ready for final sign-off.

---

## 7. Operator-readiness summary

Operator readiness is now materially better for the narrow `V8.1` slice because:

- the canonical runtime path is explicit,
- local evidence is concentrated in one pack,
- `sheet` scope is explicitly truth-bounded,
- and the final closure matrix exists in `docs/product/work-packets/cursor-work/V81_FINAL_CLOSURE_MATRIX.md`.

Operator readiness is still not fully green because:

- direct live staging proof for `/api/artifact-runs` planning and report materialization has now been collected,
- direct live Outputs UI proof is still absent,
- and package-level red areas outside the narrow artifact-runtime slice remain unresolved.

---

## 8. Known-failure ledger

Known local failures for the executed `V8.1` targeted suite: `none`

Accepted explicit blockers:

1. direct live Outputs UI proof is still missing even though the API/runtime chain is now proven,
2. package-level red areas outside the narrow `V8.1` artifact-runtime scope,
3. broader object-linked propagation across every possible module surface is not yet universal, even though key required surfaces are now wired,
4. staging runtime logs still expose a Postgres compatibility warning in KPI aggregation outside the narrow artifact slice.

---

## 9. Remaining blockers

1. Direct Outputs-facing browser proof on live staging is still missing even though the governed API/runtime chain is now proven.
2. Final sign-off still depends on package-level reds outside the narrow V8.1 artifact slice.
3. Execution-spine approval semantics vs artifact review acceptance still need package-level closure beyond the local artifact-run slice.
4. Object-linked outputs are present on selected key surfaces, but not yet uniformly propagated across every major module described in the broader completion plan.

---

## 10. Go / no-go

### Local V8.1 artifact-runtime verdict

`GO / locally and staging-closed with explicit deferrals`

Reason:

- local runtime proof is strong,
- targeted tests and local browser smoke are green,
- and live staging now proves the full governed `report` artifact flow for the narrow `V8.1` slice.

### Final package verdict

`NO-GO for final frozen-package sign-off yet`

Reason:

- live staging evidence now exists for the supporting governed runtime chain and the full direct artifact path,
- package-level closure ledger still contains unresolved red areas,
- but broader package areas outside this slice remain unresolved,
- therefore the final `V8.0 + V8.1` sign-off bar has not yet been met.
