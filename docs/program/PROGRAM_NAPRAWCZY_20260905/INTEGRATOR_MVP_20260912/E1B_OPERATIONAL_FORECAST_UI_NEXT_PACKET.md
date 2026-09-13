# Next packet: user-visible operational forecast and same Initiative identity

Status: prepared follow-on; not implemented or accepted. Existing full MVP scope remains unchanged.

## Verified gap

Root searched all production src files in canonical forecast worktree on 2026-09-13. `updateInitiativeForecast` occurs only in runtimeApi and the `interveneReplan` adapter; no component calls either. The new API writer is therefore not yet a user-visible operational forecast correction. Current writer receipt acceptance must stay API-scoped.

Root also read `registerModuleInitiativeForPlanning.ts`: the DEC-421/P15-K2 bridge is module Initiative -> canonical planning aggregate. It is not proof of a canonical-only Initiative becoming visible in the module-backed Execution Bank. The current forecast writer explicitly refuses a missing module projection; this must not be relabeled as full native flow acceptance.

## Binding existing scope

PLAN_WDROZENIA_DOPRECYZOWAN_20260912.md W10/W11 requires the same Initiative and history from planning into execution without a manually created copy. An operational correction is distinct from a change to approved assumptions; the latter requires its existing approval process. Preserve DEC-466 conditional acceptance and DEC-469 existing Initiatives. This brief adds no decision number or blanket authorization.

## Bounded implementation after writer acceptance

1. Inspect the binding module contracts and existing Initiative card before choosing its section/action. Reuse the existing card and panel. Do not create a separate Execution copy or parallel editor.
2. Wire operational forecast start/end, explicit clearing, and reason to the accepted canonical command using current aggregate version and a stable request key per logical submission. Show authoritative capability/lifecycle/projection denial; never use a client role guess as server authorization.
3. Preserve approved baseline dates. Version conflict must preserve the user's proposed values and require refresh/review; retry must not append a second history receipt. After success, reload canonical state and Bank evidence for the same Initiative ID.
4. Trace a native Initiative from supported creation through approval/planning and execution. If it lacks the required read projection, establish the sanctioned read-model/projection contract from SSOT before implementation. Do not manufacture a second Initiative or seed a module row as proof of the native path.

## Acceptance

- Mounted real editor behavior: successful correction, explicit null/omitted-field distinction, version conflict preserving input, lifecycle/capability refusal, and retry semantics.
- Actual built application + signed JWT + actual Gateway + allocated PostgreSQL: use the visible action, save, reload, and verify exact same Initiative ID, dates, receipt ID/time and unchanged baseline.
- Native supported creation-to-execution proof separate from pre-seeded two-store compatibility proof. If unresolved, report it open.
- Independent review and normal hooks before root integration. No schema/flag/default changes, live deployment, push, owner-checkout mutation or manual adoption to manufacture acceptance.
