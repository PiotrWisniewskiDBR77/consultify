# V8.1 Artifact Runtime Evidence Pack

> Status: active local evidence pack
> Scope: `V8.1` artifact runtime, Outputs Library, My Work outputs bridge, and final local closure evidence
> Authority: supports `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md` and `docs/product/work-packets/V8_V81_CLOSURE_LEDGER.md`
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

The current repo state does **not** yet support a final package sign-off because live staging evidence is still missing.

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
- but **deferred** for chat-driven `ArtifactRun` materialization parity with `document` and `presentation`.

This deferral is intentional and must remain explicit in closure reporting.

---

## 4. Deep-flow summary

The strongest local deep-flow evidence currently executed is:

- `chat -> plan -> accept -> materialize` for `document`,
- `chat -> plan -> accept -> materialize` for `presentation`,
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

No live staging verification summary has been collected yet for the `V8.1` artifact-runtime slice.

Current status:

- local evidence: strong
- browser smoke: present
- live staging evidence: missing

This remains the primary formal blocker to an unqualified `100% final` claim.

---

## 7. Operator-readiness summary

Operator readiness is now materially better for the narrow `V8.1` slice because:

- the canonical runtime path is explicit,
- local evidence is concentrated in one pack,
- `sheet` scope is explicitly truth-bounded,
- and the final closure matrix exists in `docs/product/work-packets/V81_FINAL_CLOSURE_MATRIX.md`.

Operator readiness is still not fully green because:

- live staging verification has not been executed,
- and package-level red areas outside the narrow artifact-runtime slice remain unresolved.

---

## 8. Known-failure ledger

Known local failures for the executed `V8.1` targeted suite: `none`

Accepted explicit blockers:

1. no live staging verification summary,
2. package-level red areas outside the narrow `V8.1` artifact-runtime scope,
3. broader object-linked propagation across every possible module surface is not yet universal, even though key required surfaces are now wired.

---

## 9. Remaining blockers

1. No live staging verification summary has been collected yet for the artifact runtime.
2. Final sign-off still depends on package-level reds outside the narrow V8.1 artifact slice.
3. Execution-spine approval semantics vs artifact review acceptance still need package-level closure beyond the local artifact-run slice.
4. Object-linked outputs are present on selected key surfaces, but not yet uniformly propagated across every major module described in the broader completion plan.

---

## 10. Go / no-go

### Local V8.1 artifact-runtime verdict

`GO / locally closed with explicit deferrals`

Reason:

- local runtime proof is strong,
- targeted tests and local browser smoke are green,
- and the remaining blocker is primarily staging/sign-off evidence rather than missing core local functionality for `document` and `presentation`.

### Final package verdict

`NO-GO for final frozen-package sign-off yet`

Reason:

- live staging evidence is still missing,
- package-level closure ledger still contains unresolved red areas,
- therefore the final `V8.0 + V8.1` sign-off bar has not yet been met.
