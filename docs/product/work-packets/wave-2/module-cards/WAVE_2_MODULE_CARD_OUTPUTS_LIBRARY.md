# Wave 2 Module Card — Outputs Library

> Cluster: `Outputs And Artifact Family`
> Scope: canonical discovery and operations surface for durable artifacts

## 1. Module scope

This card covers:

- the canonical outputs home,
- visible taxonomy and queues,
- preview and reopen behavior,
- filters and ownership/review slices,
- and compatibility with the historical reports/documents surface.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/V8_1_WAVE2_IMPLEMENTATION_START_PACKET.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- `docs/product/work-packets/cursor-work/V81_FINAL_CLOSURE_MATRIX.md`

## 3. Intended product behavior

`Outputs Library` should be the one stable home for all generated artifacts:

- all durable outputs land there,
- users can discover, reopen, review, export, and reuse them,
- and the library exposes one truthful cross-format model.

## 4. Current repo and doc truth

**Status: P19-A/B/C verified(evidence) — 2026-03-31. Full audit 2026-04-11.**

- Artifact runtime lane is green in the closure ledger and `EXECUTION_INDEX`.
- The functional spec treats Outputs Library as canonical home — implemented via `canonical_home: 'outputs_library'` in `artifactRegistryService.ts`.
- P19 contract (10/10 acceptance checklist) fully satisfied.
- Unified hub delivered at `/presentations` with `ReportsAndPresentationsHub` — tabs: All, Mine, Needs review, Documents, Presentations, Sheets, Templates.
- Trust-state consumed from P18 (display only, no library-local enums).
- See: `evidence/P19_FULL_AUDIT_2026-04-11.md`.

## 5. Competitive standard

The benchmark is artifact and document hubs where:

- discovery is obvious,
- status and ownership are visible,
- and reopening work is frictionless.

## 6. Current-state assessment

- `User value`: strong. One canonical artifact home is real and operational.
- `Flow completeness`: strong. Registry truth + surface breadth both delivered (7 tabs, 3 queue semantics).
- `UX quality`: strong. PreviewPaneShell standard, table+preview layout, single-click=preview, double-click=open.
- `Data / logic quality`: strong. Canonical registry rule is explicit (`v8_output_artifacts`).
- `Integration quality`: strong. Library serves documents, presentations, sheets, templates, and My Work.
- `Trust / governance`: strong. Review and visibility semantics consumed from P18 trust-state API.
- `Market standard fit`: strong. Artifact hub with queue semantics, trust display, and cross-format discovery.

## 7. Main gaps

All major gaps resolved by P19-A/B/C:

- ~~final taxonomy and queue semantics need clearer closure~~ → delivered: 7 tabs, mine/review/by-type queues
- ~~visible aggregate semantics are thinner than full doctrine~~ → delivered: aggregate All/Mine/Needs review with registry-backed rows
- ~~preview/open/review/export behavior still needs consistent final polish~~ → delivered: PreviewPaneShell + `resolveArtifactOpenPath` coherence
- ~~some historical compatibility behavior may still leak old RAP shell assumptions~~ → resolved: `/reports` redirects to `/presentations`

Residual known limits:
- `native_artifact` originRuntime unmapped in aggregate UI mapper (future extension point)
- No demo fallback for aggregate/sheet views

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one visible cross-format outputs hub,
- clear `All`, `Mine`, `Needs review`, and type-based slices,
- and accurate open/reopen behavior from one canonical identity.

## 9. Full 100% target state

`Outputs Library` reaches 100% only when it includes:

- complete taxonomy,
- review and ownership queues,
- source and export signals,
- cross-format preview/open behavior,
- templates where appropriate,
- and zero ambiguity about where durable artifacts live.

## 10. Top missing functions and flows

All originally identified missing functions delivered:

- ~~library taxonomy and queue model~~ → P19-A
- ~~preview/open/reopen flow~~ → P19-B
- ~~review queue visibility~~ → P19-B
- ~~source/export/placement semantics~~ → P19-B
- ~~compatibility path from old surfaces~~ → P19-B (route redirects)

## 11. Proposed bounded delivery packets

All delivered:

1. ~~`Library taxonomy closure`~~ → P19-A
2. ~~`Aggregate row and preview semantics`~~ → P19-B
3. ~~`Review and ownership queues`~~ → P19-B
4. ~~`Legacy alias and deep-link cleanup`~~ → P19-B

## 12. Risks and dependencies

- depends on `Documents`, `Presentations`, `Sheet`, `ArtifactRun`, and `My Work`,
- risks becoming a thin list over strong backend truth,
- risks creating a second outputs shell by accident.
