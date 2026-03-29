# Wave 2 Agent Standard

> Date: 2026-03-29
> Owner: Manager
> Status: canonical shared planning standard
> Purpose: define one shared quality bar, research method, and output format for all Wave 2 planning work

---

## 1. Role

Each worker is a manager-directed product analyst.

The job is not to improvise implementation.

The job is to produce execution-grade planning artifacts strong enough that:

- a manager can trust the real state,
- a future implementation agent can work without guessing,
- and no one can hide missing scope behind earlier bounded closures.

---

## 2. Scope discipline

Each worker may only work inside the scope assigned in its cluster brief and module cards.

A worker may:

- reference dependencies outside its scope,
- explain why another cluster matters,
- or flag blockers that require coordination.

A worker may not:

- absorb another cluster,
- silently reopen active Wave 1 streams,
- or convert “related” into “owned”.

---

## 3. Required source layers

Every Wave 2 artifact must ground itself in all of the following:

### Program authority

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/DOCUMENTATION_REGISTRY.md`

### Module truth

- the best SSOT docs for the assigned module,
- readiness audits,
- benchmark docs,
- gap matrices,
- master summaries,
- relevant frontend surfaces,
- relevant backend routes, services, and tests,
- and evidence that shows what is already bounded-accepted.

### External standard

Each module must be judged against real category leaders or the local `Softs`-derived benchmark layer.

The benchmark is not about copying visuals.

The benchmark is about:

- expected behavior,
- product completeness,
- trust,
- guidance quality,
- transition quality,
- empty-state quality,
- and how quickly a user moves from intent to result.

---

## 4. Core evaluation dimensions

Each module must be judged in these seven dimensions:

1. `User value`
2. `Flow completeness`
3. `UX quality`
4. `Data / logic quality`
5. `Integration quality`
6. `Trust / governance / error handling`
7. `Market standard fit`

For each dimension, the worker must provide:

- a short plain-language judgment,
- a quality level,
- and the single most important gap.

---

## 5. Wave 2 special rule: 100% target state

Wave 2 planning must define **two** acceptance bars for every module:

1. `current minimal acceptable state now`
2. `full 100% target state for the broad product vision in scope`

This is the key difference from many older bounded closure packets.

Workers must not hide behind:

- `bounded accepted`,
- `green in ledger`,
- `strong docs exist`,
- or `works enough for now`

if the broader product target is still materially open.

Wave 2 planning must explicitly say:

- what was already closed in bounded form,
- what is still broad product debt,
- and what `100%` means for this module without shortcuts.

---

## 6. Minimal acceptance state

For the `minimal acceptable state now`, each module plan must answer:

- what the user can do end to end,
- what the user sees,
- what gets saved,
- what result the user receives,
- what the next transition is,
- and what limitations still remain but do not block a meaningful first delivery packet.

The worker must not write vague statements like:

- `module works`
- `mostly complete`
- `ready`
- `strong enough`

without describing the exact end-to-end behavior.

---

## 7. Full 100% target state

For the `full 100% target state`, each module plan must answer:

- what complete user-facing product behavior looks like,
- which flows must exist,
- which views or surfaces must exist,
- what must be durable and traceable,
- what governance or permissions must exist,
- what benchmark-standard behaviors must be matched,
- and what would still remain consciously out of scope only if the manager writes an explicit deferral.

If the worker cannot describe the full target clearly, the module card is incomplete.

---

## 8. Delivery packet standard

Every proposed packet must be:

- bounded,
- visibly user-facing or structurally critical,
- provable,
- realistic,
- and small enough to execute without opening a hidden architecture program by accident.

Each packet must include:

- `Name`
- `Goal`
- `Scope`
- `What we deliver`
- `What we consciously do not touch`
- `Acceptance proof`
- `Risks`

---

## 9. Failure patterns to avoid

The manager must reject outputs that:

- confuse strong docs with finished product,
- confuse bounded closure with full completion,
- hide uncertainty behind technical detail,
- treat backend depth as proof of finished UX,
- talk about “improving UX” without concrete changes,
- use benchmark names without translating them into expected behavior,
- or quietly re-expand scope outside the frozen module map.

---

## 10. Required output format

Each cluster brief must use this structure:

1. `Scope`
2. `Source of truth reviewed`
3. `Executive summary`
4. `Module-by-module analysis`
5. `Cross-module dependencies`
6. `Recommended execution order`
7. `Final recommendation`

Each module card must use this structure:

1. `Module scope`
2. `Source of truth reviewed`
3. `Intended product behavior`
4. `Current repo and doc truth`
5. `Competitive standard`
6. `Current-state assessment`
7. `Main gaps`
8. `Minimal acceptance state now`
9. `Full 100% target state`
10. `Top missing functions and flows`
11. `Proposed bounded delivery packets`
12. `Risks and dependencies`

---

## 11. Module-card obligations

Inside each module card, the worker must explicitly separate:

- what is already real,
- what only looks real,
- what is documented but not materially delivered,
- what was accepted only in bounded form,
- and what still requires a new execution wave.

If those five layers are not separated, the card is not accepted.

---

## 12. Manager review gate

Before accepting any Wave 2 planning artifact, the manager checks:

- is the scope exact,
- are the strongest repo files cited,
- are benchmarks real,
- are gaps concrete,
- is the minimal state testable,
- is the full `100%` target state explicit,
- are packets truly bounded,
- and could a future implementation agent execute from this without guessing.

If the answer is `no` to any of the above, the artifact is not accepted.
