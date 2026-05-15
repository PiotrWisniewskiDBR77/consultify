---
doc_id: FUNCTION_CONTRACT_ROLLOUT_PLAN_2026_05_10
doc_kind: EXECUTION_PLAN
owner: user
status: active
last_updated: 2026-05-10
---

# Function Contract Rollout Plan (Menu 2 First)

## Goal

Deliver complete, code-aligned function-level documentation for all module functions exposed in Menu 2 and module sub-navigation, using one common standard and template.

## Scope

In scope:

- all 19 module folders in `docs/modules/`,
- function-level contracts for visible Menu 2 and module function entry points,
- mandatory UI component footprint mapping per function,
- update of module `04_UI_UX.md` with function matrix references.

Out of scope in this pass:

- deep visual design polish audits,
- target-state RAW conversion,
- implementation refactors in app runtime.

## Mandatory Inputs

- `docs/modules/FUNCTION_CONTRACT_STANDARD.md`
- `docs/modules/FUNCTION_CONTRACT_TEMPLATE.md`
- `docs/modules/OBJECT_GRAPH.md`
- `docs/modules/MODULE_HANDOFFS.md`
- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`

## Delivery Model

For each module:

1. Enumerate function surfaces from code + docs.
2. Create per-function contract file(s) under `functions/`.
3. Add/refresh a function matrix in `04_UI_UX.md`:
   - function id,
   - label,
   - route/entry,
   - state,
   - component footprint summary,
   - owner/handoff pointer,
   - link to function contract.
4. Mark `doc_gap` and `code_gap` explicitly.

## File Convention

- `docs/modules/<NN_slug>/functions/<FUNCTION_ID>.md`
- Function IDs:
  - `CZ_*`, `MW_*`, `WY_*`, `NZ_*`, `IN_*`, `RL_*`, `RZ_*`, `FN_*`, `OUT_*`, `DOC_*`, `TB_*`, `PR_*`, `ME_*`, `IRIS_*`, `MCP_*`, `ORG_*`, `ADM_*`, `SET_*`, `PART_*`

## Execution Phases

### Phase A — Inventory and Mapping

- Build full function inventory per module (Menu 2 + sub-navigation).
- Map each function to route/AppView/component owner.
- Output: function inventory table for 19 modules.

### Phase B — Contracts for Core Runtime Modules

Modules:

- `01_czat` to `09_outputs`

Output:

- complete per-function contracts,
- function matrix updates in each `04_UI_UX.md`.

### Phase C — Contracts for Support and Placeholder Modules

Modules:

- `10_dokumenty` to `19_portal-partnerski`

Output:

- explicit as-is function states (`soon/stub/placeholder`) with planned boundaries,
- clear ownership and prohibited mutation zones.

### Phase D — Gate and Closure

- Rerun quality gate with function-level checks:
  - structure,
  - content specificity,
  - code alignment.
- Update `_QUALITY_GATE_DOCUMENTATION_2026-05-10.md` or successor gate report with GO/NO-GO.

## Function-Level Definition of Done

A module is DONE only if:

- every visible function has a contract file,
- every function contract passes all 12 required sections,
- each function has a concrete UI component footprint,
- `04_UI_UX.md` references the full function matrix,
- function owner/handoff boundaries are explicit and aligned to object graph,
- known gaps are honest and non-ambiguous.

## Risks

- Route aliases and transitional paths can create duplicate function identities.
- Placeholder modules can be over-documented with non-existent runtime claims.
- Component mapping can drift if code changes and docs are not refreshed.

## Risk Controls

- enforce As-Is first policy,
- include source file anchors in function evidence sections,
- reject generic claims without route/component references,
- rerun code-alignment check before gate decision.
