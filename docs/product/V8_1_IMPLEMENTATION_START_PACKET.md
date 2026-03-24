# V8.1 Implementation Start Packet

> Status: Canonical v8.1
> Owner: Product + Engineering
> Scope: safe execution brief for the agent building `v8.1` on top of the stabilized `v8` baseline

---

## 1. Why this document exists

`v8` is no longer an abstract planning effort.

It is now a stabilized product baseline with:

- merged code on `main`,
- staging aligned to the same branch,
- production running on a fresh clean database,
- and a large body of canonical `v8` documentation that must not be casually reinterpreted.

`v8.1` is the next closure layer.

It should extend the outputs and artifact runtime safely, without destabilizing the `v8` system that was just consolidated.

---

## 2. Source of truth for v8.1

The implementation agent must treat the following as canonical:

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md`
- `docs/product/EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`
- `docs/product/AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md` via the UI standards SSOT referenced by repo rules
- `docs/product/DOCUMENTATION_REGISTRY.md`
- `docs/product/V8_1_WAVE1_STATUS.md` for honest scope and evidence boundaries during Wave 1

If implementation detail conflicts with older local patterns, the canonical docs above win.

---

## 3. The v8 context the agent must understand

### 3.1 What is already true

The platform already has real foundations for:

- `Reports`
- `Presentations`
- AI artifact generation patterns
- execution and approval governance
- source traceability
- `My Work`
- module-level AI integrations

The task is not to invent a new product from zero.

The task is to close the gap between those existing strengths and one coherent artifact operating model.

### 3.2 What v8.1 is allowed to change

`v8.1` may:

- add a shared artifact substrate,
- add a canonical outputs library semantic,
- add sheet artifacts as the third class,
- add chat-to-artifact orchestration,
- add personal artifact views in `My Work`,
- add shared artifact APIs and orchestration services.

### 3.3 What v8.1 must not casually break

`v8.1` must not:

- rewrite existing reports runtime from scratch,
- rewrite existing presentations runtime from scratch,
- create a second parallel artifact registry,
- introduce a second independent approval universe,
- bypass source traceability,
- weaken visibility or ACL semantics,
- change frozen shell layouts or invent parallel UI standards,
- disturb current production database targeting strategy.

---

## 4. Non-negotiable guardrails

### 4.1 One registry rule

There must be one canonical `Artifact` registry for library discovery, personal queues and cross-format identity.

Existing report/presentation tables may remain format-native runtime stores, but they must map into the shared artifact identity.

### 4.2 Governance rule

The existing `v8` execution/proposal spine remains authoritative for governed durable create/refresh actions.

`ArtifactReview` is post-generation version acceptance, not a replacement for governed execution approval.

### 4.3 ACL rule

The outputs library is not globally open by default.

Minimum visibility scopes:

- `private`
- `project`
- `organization`
- `review_shared`
- `demo`

### 4.4 UI rule

Do not invent a new outputs shell that breaks the frozen product layout doctrine.

The implementation must reuse existing shells, tabs, preview patterns and shared UI building blocks wherever possible.

### 4.5 Backward-compatibility rule

Existing routes and runtime flows for:

- `/api/report-builder/*`
- `/api/presentations/*`

must continue to operate in Wave 1.

The new artifact layer should orchestrate and wrap them, not replace them immediately.

---

## 5. Recommended build order

The implementation should proceed in this order:

1. Introduce shared artifact domain objects and database model.
2. Introduce `ArtifactOriginLink` and idempotent backfill for existing reports/presentations.
3. Add shared artifact APIs with ACL-aware reads.
4. Evolve the existing `Reports & Presentations` hub into the first `Outputs Library` shell.
5. Add `My Work` outputs slices backed by the same registry.
6. Add chat-triggered artifact planning and governed run integration.
7. Add first `Sheet` runtime in governed form.
8. Harden validation, review, export visibility and observability.

Canonical sequencing rule:

`substrate first, surfaces second, parity depth third`

---

## 6. Minimum Wave 1 deliverables

Wave 1 is complete only if all of the following are true:

- one shared artifact model exists in code and storage,
- reports and presentations are registered into that model,
- no artifact appears in the library without a canonical artifact id,
- the legacy shortcut opens the canonical outputs home,
- ACL filters are enforced on library reads,
- existing report and presentation flows still work,
- no frozen-layout violations were introduced.

---

## 7. Evidence the agent must provide

The implementation agent must not report completion with vague claims.

Every tranche should include:

- files changed,
- migrations added,
- routes added or updated,
- runtime services added,
- screenshots or UI evidence if surface changes were made,
- test evidence,
- explicit statement whether compatibility with old report/presentation flows was checked.

---

## 8. Anti-patterns

The implementation agent must explicitly avoid:

- creating a new standalone `Docs` module as a side universe,
- storing outputs only in `My Work`,
- building chat creation without durable artifact ids,
- adding review states with no connection to existing governance,
- dual-rendering the same object from separate registries,
- implementing `Sheet` only as a dead export without substrate registration,
- broadening visibility accidentally to the whole organization by default.

---

## 9. Exit condition for the first implementation pass

The first pass is ready for broader final testing when:

- staging runs the new artifact substrate safely,
- existing reports and presentations still behave correctly,
- the outputs home is canonical and stable,
- no second registry exists,
- no source-traceability break was introduced,
- no approval/governance contradiction exists,
- and the implementation is documented back into canonical docs where needed.

---

## 10. Relationship to future closure

`v8.1` is a controlled extension after `v8`, not a reset of `v8`.

The goal is:

- first build safely,
- then verify deeply,
- then close the whole `v8 + v8.1` package with final testing and acceptance.

Until the dedicated `Outputs Library` surface and deeper end-to-end evidence are closed, implementation status should be reported as:

`V8.1 Wave 1 substrate in place`

and not:

`V8.1 fully closed`
