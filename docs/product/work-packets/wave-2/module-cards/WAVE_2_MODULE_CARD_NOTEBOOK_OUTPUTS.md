# Wave 2 Module Card — Notebook outputs

> Cluster: `Outputs And Artifact Family`
> Scope: notebook-native artifact generation, persistence, readback, and continuation

## 1. Module scope

This card covers:

- output creation from notebook context,
- notebook-origin output persistence,
- readback on notebook surfaces,
- attachment/source continuity,
- and notebook-to-artifact reopen behavior.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/NOTATKA_V8_PLATFORM_CONTEXT_AND_INTEGRATION.md`
- `docs/product/work-packets/POST_V81_BACKLOG_TRACKER.md`
- `docs/product/work-packets/evidence/516-v81-broader-notes-adjunct-object-linked-outputs-breadth-t4-acceptance.md`
- `docs/product/work-packets/cursor-work/V81_FINAL_CLOSURE_MATRIX.md`

## 3. Intended product behavior

`Notebook outputs` should let notes act as a serious source context:

- create outputs from notebook context,
- keep them attached to the note,
- preserve source file and attachment continuity,
- and make the note a stable place to continue artifact-related work.

## 4. Current repo and doc truth

Current truth is one of the strongest residual families:

- many notebook/output continuity packets were landed and accepted,
- notebook-specific output persistence and source continuity are now much better,
- but Wave 2 still needs to package notebook outputs as a stable artifact-family module rather than only as a sequence of closure packets.

## 5. Competitive standard

The benchmark is structured note systems where:

- notes turn into durable outputs,
- output history is visible from the source note,
- and the user never loses the link between thinking and delivery artifact.

## 6. Current-state assessment

- `User value`: good.
- `Flow completeness`: partial to good.
- `UX quality`: partial. Many key seams are closed; broader product packaging still remains.
- `Data / logic quality`: strong.
- `Integration quality`: strong.
- `Trust / governance`: good.
- `Market standard fit`: partial to good.

## 7. Main gaps

- notebook outputs still need one consolidated module doctrine,
- consistency with the broader object-linked and library/reopen model needs final closure,
- notebook output UX can still feel like accumulated seams rather than one intentional product.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- notebook can create and read back outputs reliably,
- source and attachment continuity is preserved,
- and notebook-origin artifacts reopen correctly from note surfaces.

## 9. Full 100% target state

`Notebook outputs` reach 100% only when they support:

- create, persist, read back, reopen, and continue,
- attachment/source lineage,
- cross-format output visibility,
- and notebook-to-artifact continuity that feels native rather than patched.

## 10. Top missing functions and flows

- notebook -> artifact create flow
- notebook readback and summary flow
- notebook-origin source and attachment continuity
- notebook -> artifact reopen flow
- notebook-specific status/review awareness

## 11. Proposed bounded delivery packets

1. `Notebook output doctrine consolidation`
2. `Notebook reopen and continue closure`
3. `Notebook status and review visibility`
4. `Notebook family UX cleanup`

## 12. Risks and dependencies

- depends on `Object-linked outputs`, `Provenance / review / visibility`, and `Outputs Library`,
- risks assuming accepted continuity seams already equal product finality,
- risks diverging notebook-specific behavior from the general artifact family.
