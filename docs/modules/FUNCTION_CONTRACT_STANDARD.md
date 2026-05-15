---
doc_id: FUNCTION_CONTRACT_STANDARD
doc_kind: STANDARD
owner: user
status: active
last_updated: 2026-05-10
---

# Function Contract Standard (v1)

## Purpose

Define one mandatory documentation standard for every module-level function (especially Menu 2 surfaces), so each function has explicit scope, ownership, runtime behavior, and UI component footprint.

This standard is mandatory for:

- function surfaces visible to users in module hub/workspace navigation,
- function actions that create/update/export/approve business objects,
- placeholder functions that are visible in UI but not fully shipped.

## Canon Rules

- A function contract MUST describe current As-Is behavior first.
- A function contract MUST NOT mix current runtime truth with future target claims without explicit separation.
- Every critical business or runtime claim MUST include source/evidence links.
- Every mutation path MUST define approval/review requirements.
- Ownership and handoff MUST align with `OBJECT_GRAPH.md` and `MODULE_HANDOFFS.md`.

## Required Structure (12 Sections)

Each function contract MUST contain all sections below.

### 1) Function Identity

- `function_id` (stable identifier),
- function name and aliases from UI,
- parent module and route scope,
- feature state: `real`, `partial`, `soon`, `stub`, `deprecated`.

### 2) User Job and Business Outcome

- primary user job-to-be-done,
- business value and expected decision/output impact,
- non-goals (what this function must not do).

### 3) Trigger and Entry Points

- where user can open/run the function (Menu 2 item, tab, button, deep-link),
- route(s) and AppView mapping if applicable,
- required preconditions (permissions, selected object, data readiness).

### 4) UI Component Footprint (Mandatory)

- top-level view/container components used by the function,
- shared standard components (layout, panels, table, forms, command row),
- design system dependencies/tokens where relevant,
- component ownership: reusable standard component vs local custom component.

This section exists to simplify UI governance and reuse of standard components.

### 5) Inputs, Data Contracts, and Dependencies

- input objects and required fields,
- upstream modules/services,
- API/model dependencies (as-is),
- data freshness/consistency expectations.

### 6) Outputs and Side Effects

- output objects/artifacts produced by the function,
- downstream modules/flows receiving handoff,
- visible side effects (status changes, created records, exports, notifications).

### 7) Ownership and Handoff Boundaries

- canonical owner of each mutated object,
- handoff contract (`from -> to`, payload, state transition),
- forbidden ownership (what this function must never own/mutate directly).

### 8) Runtime States and UX Behavior

- loading, empty, error, degraded, success behavior,
- user guidance for "what next" in each state,
- resiliency expectations (retry, fallback, partial availability).

### 9) AI, Source, Evidence, Approval

- where contextual AI actions appear (Menu 3/right command row),
- source/provenance visibility requirements,
- approval/diff/review requirements for high-impact actions,
- audit evidence emitted by the function.

### 10) Security, Roles, and Tenancy

- allowed roles and denied roles,
- tenant/ACL boundaries,
- restricted or masked fields,
- security failure behavior (deny-by-default).

### 11) Acceptance Criteria and Test Evidence

- concrete acceptance checks for the function,
- mapping to runtime/code evidence (route, component, API/model, test),
- mandatory evidence bundle:
  - route evidence,
  - component evidence,
  - API evidence,
  - test evidence,
- known `doc_gap` / `code_gap`.

### 12) Open Risks and Change Log

- top risks/assumptions,
- unresolved decisions,
- latest contract change summary.

## Naming and File Convention

- Function contracts SHOULD live under:
  - `docs/modules/<NN_slug>/functions/<FUNCTION_ID>.md`
- `FUNCTION_ID` format:
  - `<MODULE_SHORT>_<FUNCTION_SHORT>` (example: `MW_RADAR`)

## Minimal Metadata (Front Matter)

Each function file MUST include:

- `module_id`
- `function_id`
- `function_name`
- `doc_kind: FUNCTION_CONTRACT`
- `status`
- `last_updated`
- `owner`
- `owner_business`
- `owner_tech`

## Quality Gate for Function Contracts

Function contract is PASS only if:

- all 12 sections are present,
- UI Component Footprint is concrete (not generic),
- owner/handoff boundaries are explicit,
- runtime states include next actions,
- AI placement follows Menu 3 rule,
- acceptance evidence references real As-Is code/runtime,
- ownership fields are resolvable via local front matter or `CONTRACT_OWNERSHIP_REGISTRY.md`.
