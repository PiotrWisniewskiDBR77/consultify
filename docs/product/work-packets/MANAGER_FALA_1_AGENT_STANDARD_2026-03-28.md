# Manager Fala 1 Agent Standard

> Date: 2026-03-28
> Owner: Manager
> Status: canonical shared brief standard
> Purpose: define one shared quality bar, review method, and output format for all Fala 1 agents

---

## 1. Role

Each agent is not an implementer yet.

Each agent is a manager-directed product analyst whose job is to produce one execution-grade markdown plan for a tightly bounded scope.

The output must be strong enough that:

- a manager can trust the real state,
- a later implementation agent can work without guessing,
- and product scope cannot drift by accident.

---

## 2. Scope discipline

An agent may only work inside the scope assigned in its manager brief.

An agent may:

- describe dependencies outside its scope,
- explain why another stream matters,
- or identify blockers that require coordination.

An agent may not:

- absorb another active stream,
- reopen a stream that the manager parked for later,
- or convert “related” into “owned.”

---

## 3. Required source layers

Every agent must ground its work in all of the following:

### Program authority

- `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`
- `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
- `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`

### Module truth

- the best SSOT docs for the assigned module
- readiness audits
- benchmark docs
- relevant frontend surfaces
- relevant backend routes, services, and tests

### External standard

Each agent must compare its scope to real category leaders.

The benchmark is not about copying UI.

The benchmark is about:

- expected behavior,
- product completeness,
- empty states,
- decision support,
- transition quality,
- user trust,
- and how quickly a user can get from intent to result.

---

## 4. How to judge a module

Each module must be judged in these seven dimensions:

1. `User value`
2. `Flow completeness`
3. `UX quality`
4. `Data / logic quality`
5. `Integration quality`
6. `Trust / governance / error handling`
7. `Market standard fit`

For each dimension, the agent must provide:

- a short plain-language judgment,
- a quality level,
- and the single most important gap.

---

## 5. Minimal acceptance state

The agent must define a concrete minimal acceptance state.

It must answer:

- what the user can do end to end,
- what the user sees,
- what gets saved,
- what result the user receives,
- what the next transition is,
- and what limitations still remain but do not block acceptance now.

The agent must not write:

- “module works”
- “mostly complete”
- “ready”
- or other vague approval language.

---

## 6. Delivery packet standard

Every proposed packet must be:

- bounded,
- visibly user-facing,
- provable,
- realistic,
- and small enough to execute without opening a hidden architecture program.

Each packet must include:

- `Name`
- `Goal`
- `Scope`
- `What we deliver`
- `What we consciously do not touch`
- `Acceptance proof`
- `Risks`

---

## 7. Failure patterns to avoid

The manager will reject outputs that:

- confuse existing code with product readiness,
- hide uncertainty behind technical detail,
- treat backend depth as proof of finished UX,
- talk about “improving UX” without concrete changes,
- ignore competitive standard,
- or quietly re-expand the wave.

---

## 8. Required output format

Each agent must deliver one markdown file with this exact structure:

1. `Scope`
2. `Source of truth reviewed`
3. `Executive summary`
4. `Module-by-module analysis`
5. `Cross-module dependencies`
6. `Recommended execution order`
7. `Final recommendation`

Inside each module section, the output must include:

- intended product behavior
- current repo truth
- competitive standard
- main gaps
- minimal acceptance state now
- top missing functions
- proposed bounded delivery packets
- risks and dependencies

---

## 9. Manager review gate

Before accepting any output, the manager checks:

- is the scope exact,
- are the strongest repo files cited,
- are benchmarks real,
- are gaps concrete,
- is minimal acceptance testable,
- are packets truly bounded,
- and could a future implementation agent execute from this without guessing.

If the answer is “no” to any of the above, the plan is not accepted.
