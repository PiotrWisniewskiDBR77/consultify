# Ideas V5 — Full Remediation Agent Execution Pack

> **Status:** ACTIVE  
> **Audience:** implementation agent  
> **Purpose:** provide one complete execution brief for repairing and finishing `Idea Workspace V5` end-to-end, not only the urgent subset.

> **Use this as the operational brief.**  
> Do not use historical "all complete" narratives as truth.

---

## 0) Read this first

Before touching code, read in this order:

1. `docs/product/IDEA_WORKSPACE_V5_REMEDIATION_PLAN.md`
2. `docs/product/IDEA_WORKSPACE_V5_FAILURE_INVENTORY_2026-03-09.md`
3. `docs/product/IDEA_WORKSPACE_V5_1_IMPLEMENTATION_PROGRAM.md`
4. `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
5. `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
6. `docs/ui-standards/FROZEN_LAYOUTS.md`
7. `docs/ui-standards/00-foundation/visual-language.md`

---

## 1) Mission

Your job is to make `Idea Workspace V5` into a real, working product.

That means:
- fixing misleading or fake-feeling behavior
- making the visible canvases useful
- wiring artifact linking end-to-end
- restoring trust in statuses and QA
- finishing the remaining system depth and integrations

You are not here to add new speculative scope.
You are here to **repair, complete, and verify**.

---

## 2) Non-negotiable rules

### 2.1 Truthfulness

Do not mark a task `done` unless:
- it works in UI
- it survives save/reload
- it has runtime verification

### 2.2 No fake feature completion

The following do **not** count as completion:
- toast-only actions
- prompt scaffolding with no product behavior
- hidden components not wired into user flow
- file existence
- string-presence smoke checks

### 2.3 Function before polish

If a feature is visually polished but behaviorally weak:
- finish the behavior first
- then polish it

### 2.4 Canvas-by-canvas discipline

Do not try to improve all canvases superficially in parallel.

Each canvas must get:
- one working path
- one verification path
- one visual coherence pass

### 2.5 Respect canon

You must not break:
- `FROZEN_LAYOUTS`
- `Tools | Context | AI Suggestions` strip rule
- DBR77 visual language

---

## 3) Scope of work — full, not partial

This pack covers **all remaining work**, not only urgent tasks.

### Work to complete

- `V51-25..32` remediation recovery
- `V51-08..24` remaining V5.1 depth and integration tasks
- any supporting fixes required to make these flows real

### Work explicitly included

- reality reset in docs and status
- artifact-linking end-to-end UI
- mind map recovery
- whiteboard recovery
- process flow recovery
- table recovery
- focus modes runtime
- idea card stage model
- node depth persistence
- process mode differentiation
- table views
- system templates
- selection-level conversion
- object-level knowledge attachment
- notebook/interview/finance integration
- report/deck traceability
- execution source display
- browser/runtime verification
- performance profiling
- visual simplification and trust pass

---

## 4) Full task order

Execute in this order unless blocked by a real dependency.

### Wave 0 — Truth reset

1. `V51-25` Reality reset

### Wave 1 — Backend and contract reality

2. `V51-04` Harden artifact attachment API until truly verified
3. `V51-17` LinkGraph workspace-level linking
4. `V51-01` AI artifact handlers sanity pass
5. `V51-02` Chat-to-workspace handoff sanity pass
6. `V51-03` Compatibility adapter verification
7. `V51-07` Builder + Expert runtime sanity pass
8. `V51-05` Whiteboard AI handlers
9. `V51-06` Table AI handlers

### Wave 2 — Shared workspace reality

10. `V51-08` Object-family coexistence runtime
11. `V51-09` Idea Card state machine
12. `V51-10` Node depth model persistence
13. `V51-14` Focus modes runtime
14. `V51-16` Knowledge attachment to specific objects
15. `V51-30` Artifact linking end-to-end UI wiring

### Wave 3 — Canvas-by-canvas completion

16. `V51-26` Mind Map functional recovery
17. `V51-27` Whiteboard functional recovery
18. `V51-28` Process Flow functional recovery
19. `V51-11` Process Flow mode differentiation
20. `V51-29` Table functional recovery
21. `V51-12` Table views implementation
22. `V51-13` System-level templates

### Wave 4 — Cross-system and integration depth

23. `V51-15` Selection-level conversion logic
24. `V51-18` Notebook -> Idea creation flow
25. `V51-19` Interview insight -> Idea evidence
26. `V51-20` Finance -> Idea table autofill
27. `V51-21` Report/Presentation granular traceability
28. `V51-22` Execution source display

### Wave 5 — Verification and trust

29. `V51-23` E2E / runtime test suite
30. `V51-31` Replace static smoke with browser/runtime verification
31. `V51-24` Performance profiling
32. `V51-32` Visual simplification and trust pass

---

## 5) Canvas-specific instructions

## 5.1 Mind Map

You must fix:
- empty capsule feeling
- weak hierarchy
- low semantic density
- missing visible artifact-link value

Minimum acceptable result:
- map communicates reasoning structure
- node depth is visible
- artifact linking is visible and usable on nodes
- AI-generated structure renders as meaningful branches

## 5.2 Whiteboard

You must fix:
- duplicated placeholder blocks
- weak note semantics
- lack of workshop energy

Minimum acceptable result:
- sticky/text/frame primitives are visibly different
- grouping is understandable
- board is usable for capture before structuring

## 5.3 Process Flow

You must fix:
- generic action placeholders
- weak lane semantics
- fake-feeling mode differences

Minimum acceptable result:
- lanes matter
- steps look like meaningful process elements
- Classic / Automation / VSM differ behaviorally, not only by labels

## 5.4 Table

You must fix:
- generic `node` rows
- empty default meaning
- fake-feeling autofill

Minimum acceptable result:
- default table is useful for comparison
- row-level artifact workflow is real
- autofill preview and refresh are trusted

---

## 6) Artifact-linking instructions

This is a core differentiator.
Treat it as first-class.

You must make all of this real:
- attach artifact from workspace object
- preview linked artifact
- open linked artifact in native module
- persist link on save/reload
- show attached artifacts in context panel
- keep LinkGraph and workspace state aligned
- support finance artifacts with the same contract

This must not remain:
- a toast
- an indirect hint
- a hidden component
- a "future path"

---

## 7) QA instructions

### Required verification types

- code-level verification
- API verification
- save/reload verification
- browser/runtime verification

### Minimum runtime proofs per canvas

- one creation/edit path
- one attachment path if relevant
- one persistence path
- one failure-free visible outcome

### Smoke rule

If smoke only checks:
- file exists
- string exists
- enum exists

then it is not sufficient.

---

## 8) Reporting format

When you report progress, separate:

### 1. Truly done

Only items that are:
- visible
- working
- verified

### 2. Partial

Items where:
- contracts exist
- behavior is incomplete
- UI is still weak

### 3. Blocked / next

What still prevents the next canvas or next wave.

---

## 9) Final instruction

The right goal is not to defend old completion claims.

The right goal is to make the module:
- actually usable
- visually credible
- behaviorally trustworthy

Do the full job, not the optimistic one.
