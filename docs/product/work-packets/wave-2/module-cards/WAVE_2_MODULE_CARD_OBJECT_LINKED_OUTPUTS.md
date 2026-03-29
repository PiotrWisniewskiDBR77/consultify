# Wave 2 Module Card — Object-linked outputs

> Cluster: `Outputs And Artifact Family`
> Scope: outputs attached to source objects across major modules

## 1. Module scope

This card covers:

- artifact visibility on source objects,
- linked outputs panels,
- reopen from source object,
- and consistent artifact truth across initiatives, finance, interviews, notes, and related surfaces.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/work-packets/cursor-work/V81_FINAL_CLOSURE_MATRIX.md`
- `docs/product/work-packets/POST_V81_BACKLOG_TRACKER.md`

## 3. Intended product behavior

`Object-linked outputs` should make it obvious that artifacts belong to one shared system:

- a source object shows its outputs,
- users can open them from there,
- provenance is preserved,
- and no source surface pretends outputs live somewhere else.

## 4. Current repo and doc truth

Current truth is strong but not complete:

- many broader notes/object-linked packets were accepted,
- the final closure matrix still says selected modules are covered while some surfaces remain partial,
- especially around residual source-object coverage.

## 5. Competitive standard

The benchmark is not just linked files.
It is work systems where source objects and outputs feel like one continuous lifecycle.

## 6. Current-state assessment

- `User value`: good.
- `Flow completeness`: partial.
- `UX quality`: partial. Key places are strong, full propagation is not.
- `Data / logic quality`: strong.
- `Integration quality`: strong.
- `Trust / governance`: good.
- `Market standard fit`: partial to good.

## 7. Main gaps

- not all major source-object surfaces show outputs consistently,
- some source-specific panels still lag behind notebook and key modules,
- deep-link and reopen behavior still needs full consistency.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- major source objects visibly surface outputs,
- those outputs open the canonical artifact,
- and users do not need to hunt through the library to continue work.

## 9. Full 100% target state

`Object-linked outputs` reach 100% only when every required major module surface:

- shows linked artifacts,
- exposes meaningful status and traceability,
- deep-links into the same canonical artifact,
- and supports the expected continue/review/reopen path.

## 10. Top missing functions and flows

- source object -> outputs panel
- panel -> canonical artifact open/reopen
- consistent status/traceability display
- coverage of residual modules and source types
- consistent bidirectional awareness between source and artifact

## 11. Proposed bounded delivery packets

1. `Residual surface coverage audit`
2. `Major source-object panel completion`
3. `Deep-link and reopen consistency`
4. `Source-to-artifact status semantics`

## 12. Risks and dependencies

- depends on `Outputs Library`, `Notebook outputs`, and `Provenance / review / visibility`,
- risks counting notebook coverage as full module coverage everywhere,
- risks creating source-local truth instead of canonical artifact truth.
