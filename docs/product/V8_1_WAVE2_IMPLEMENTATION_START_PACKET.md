# V8.1 Wave 2 Implementation Start Packet

> Status: canonical `Wave 2` execution packet
> Owner: Product + Engineering
> Scope: turn the completed `Wave 1 substrate` into a product-facing `Wave 2` closure slice without breaking the stabilized `V8` base

---

## 1. Why this packet exists

`Wave 1` created the shared artifact substrate and closed the highest-risk backend findings:

- canonical artifact registry
- origin-link model
- ACL envelope
- registry-first report/presentation registration
- persisted `ArtifactRun`
- execution-spine linkage
- review-start envelope

That work is accepted as meaningful progress.

However, `V8.1` is still **not** a fully closed product package.

The main remaining gaps are:

- the frontend still behaves as a transitional `Reports & Presentations` shell, not a true `Outputs Library`
- `sheet` exists as foundation and planning type, but not as a first-class end-to-end governed artifact runtime
- current evidence is contract-level and targeted, not a convincing end-to-end closure proof

This packet exists to let multiple agents work in bounded parallel streams without losing coherence or context.

---

## 2. Current truth the agents must not misstate

Before doing any `Wave 2` work, every agent must accept these statements as true:

1. `Wave 1` is in place and should be described as `Wave 1 substrate`, not full `V8.1` closure.
2. The current frontend surface is a `transitional Outputs Library surface` built by reusing the existing `ReportsAndPresentationsHub`.
3. The canonical `ArtifactRun` contract lives under `/api/artifact-runs/*`.
4. `/api/artifacts/runs/from-chat` still exists as a compatibility alias and must be described honestly as an alias, not as the only contract.
5. Current tests provide `targeted contract-level backend evidence`, not full end-to-end proof.

Source for this status:

- `docs/product/V8_1_WAVE1_STATUS.md`

---

## 3. Canonical sources for Wave 2

Every agent working on `Wave 2` must treat these as required reading:

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/V8_1_WAVE1_STATUS.md`
- `docs/product/V8_1_IMPLEMENTATION_START_PACKET.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/README.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`

Agents must not reinterpret `Wave 2` from scratch if these docs already define the target.

---

## 4. Non-negotiable rules

### 4.1 No second registry

There must still be exactly one canonical artifact registry.

No agent may create:

- a second artifact catalog
- a second storage truth for `My Work`
- a parallel outputs database

### 4.2 No second approval universe

`ArtifactRun` must continue to integrate with the existing execution/proposal spine.

No agent may create:

- a parallel approval workflow
- a custom artifact-only approval engine detached from `v8_execution_runs` / `v8_action_proposals`

### 4.3 No frozen-layout violations

Agents may not:

- invent a new shell
- add a second command row
- reorder frozen topbar controls
- create an ad-hoc sidebar taxonomy that violates frozen navigation

### 4.4 No accidental visibility broadening

Project, review, and tenant scoping must remain conservative.

Project access must always be tenant-safe and never inferred only from `user_id`.

### 4.5 Reuse first

`Wave 2` should extend:

- `ReportsAndPresentationsHub`
- `artifactRegistryService`
- `artifact-runs` APIs
- existing table/XLSX foundations

It must not casually replace them.

---

## 5. Wave 2 objective

`Wave 2` is successful if it achieves all of the following:

1. The product has a visibly real `Outputs Library` surface, not only a backend substrate.
2. `sheet` becomes a real governed artifact path with canonical identity.
3. The test/evidence story moves from route-contract validation toward integration-grade proof.

This packet intentionally focuses on those three closures only.

---

## 6. Wave 2 workstreams

`Wave 2` is split into three bounded workstreams so agents can work in parallel without context explosion.

### 6.1 Workstream A — Outputs Library surface closure

Goal:

Turn the transitional `ReportsAndPresentationsHub` into the first product-grade `Outputs Library` surface while preserving frozen layouts.

Required outcome:

- clear user-facing views or tabs for:
  - `All`
  - `Mine`
  - `Needs review`
  - `Documents`
  - `Presentations`
  - `Sheets`
  - `Templates`
- no second toolbar
- no frozen-layout regression
- server-backed filtering where correctness matters

Important clarification:

If the exact final taxonomy cannot be fully shipped in one tranche, the agent must still produce a **truthful, coherent first slice** that visibly broadens beyond the old `templates / reports / presentations` shell.

Current code anchors:

- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
- `src/components/ReportsAndPresentations/types.ts`
- `src/components/ReportsAndPresentations/useRapData.ts`
- `src/components/ReportsAndPresentations/ReportsTabContent.tsx`
- `src/components/ReportsAndPresentations/PresentationsTabContent.tsx`
- `src/components/ReportsAndPresentations/TemplatesTabContent.tsx`
- `src/routes/AppRoutes.tsx`
- `src/routes/routeConfig.ts`
- `src/components/navigation/Sidebar/menuConfig.ts`

Key rules:

- keep `Reports & Presentations` compatibility alias if needed
- do not break existing builder deep-links
- do not create a second outputs shell
- any `Mine` / `Needs review` logic must prefer canonical registry filters over UI-only heuristics

Acceptance for Workstream A:

- at least one coherent user-facing `Outputs Library` taxonomy is visible in the actual UI
- old report/deck behavior still works
- `Sheets` is represented honestly, even if initially empty-state driven

### 6.2 Workstream B — Sheet runtime closure

Goal:

Make `sheet` a real first-class artifact type end-to-end in a minimal governed form.

Required outcome:

- database contract supports a true sheet artifact
- backend types and validators support it consistently
- canonical registry can register and list it
- one minimal generation/export path exists
- the artifact can appear in `Outputs Library` and `My Work`

Important clarification:

`Wave 2` does **not** need a Kimi-grade spreadsheet authoring suite.

It needs a real first governed artifact path for `sheet`.

Preferred implementation strategy:

- reuse existing XLSX/table/export foundations
- create the thinnest viable `sheetArtifactAdapter`
- register sheet outputs through the canonical artifact substrate

Current code anchors:

- `server/src/services/tablePlatform/ExportService.ts`
- `server/src/routes/table-platform.routes.ts`
- `server/src/services/v8/artifactRegistryService.ts`
- `server/src/types/artifactRegistry.ts`
- `server/src/routes/artifacts.routes.ts`
- `server/src/routes/artifact-runs.routes.ts`
- `src/utils/artifactLinks.ts`
- `src/components/ReportsAndPresentations/*`
- `src/components/MyWork/*`

Known gap to close explicitly:

- planning already allows `sheet`
- `v8_output_artifacts.output_type` and current registry contracts still reflect older `report | presentation` assumptions

Acceptance for Workstream B:

- a sheet artifact can be planned, persisted, listed, and opened/exported through the canonical model
- no dead placeholder `sheet` type is left behind

### 6.3 Workstream C — Evidence and integration closure

Goal:

Upgrade the proof story from mocked route contracts to stronger integration confidence.

Required outcome:

- artifact substrate integration tests that exercise real service logic
- at least one database-backed or service-backed flow for registry reads and artifact-runs
- stronger evidence for report/presentation registration
- first frontend or e2e proof that the UI consumes canonical artifact responses

Current code anchors:

- `tests/unit/backend/services/artifactRegistryService.test.ts`
- `tests/integration/routes/artifacts.routes.test.ts`
- `tests/integration/routes/artifact-runs.routes.test.ts`
- `server/src/services/v8/__tests__/reportsPresModelService.test.ts`
- `server/src/services/v8/__tests__/reportsOutputRuntime.test.ts`
- `tests/e2e/smoke/tier0-core-workflows.spec.ts`

Known truth:

Current route tests mock the service layer.

Acceptance for Workstream C:

- at least one meaningful slice proves real substrate logic beyond mocked route wrappers
- evidence is still reported honestly; if full e2e is not done, the agent must say so plainly

---

## 7. Recommended build order inside Wave 2

Agents must not work randomly.

Use this order:

1. widen and stabilize the canonical contracts needed for `sheet`
2. close server-side registry/read/runtime gaps
3. evolve the Outputs Library surface
4. close evidence around the new behavior

Operational rule:

`backend truth before product surface, product surface before broad claims`

---

## 8. What agents must not do

Agents must explicitly avoid:

- rewriting report builder
- rewriting presentation generator
- introducing a separate `Sheets` module with its own independent storage truth
- shipping UI renames that imply full `V8.1` closure when only partial work is done
- claiming end-to-end proof from mocked route tests
- broadening project access without tenant-bounded joins

---

## 9. Agent dispatch packets

The supervising agent should dispatch three isolated workstreams.

Each workstream must stay within its own scope.

### 9.1 Agent A packet — Outputs surface

Mission:

Implement the first product-grade `Outputs Library` surface on top of the current hub.

Do:

- evolve the visible taxonomy beyond `templates / reports / presentations`
- add real `All / Mine / Needs review / Sheets` behavior in a frozen-layout-safe way
- keep compatibility for current report/presentation builder flows

Do not:

- invent a new shell
- break frozen topbar/command-row rules
- fake `Mine` / `Needs review` with UI-only hacks if the API can provide correct server-backed filtering

Required report back:

- files touched
- exact routing behavior
- any scope compromises
- screenshots or equivalent UI evidence

### 9.2 Agent B packet — Sheet runtime

Mission:

Implement the minimal governed `sheet` artifact runtime.

Do:

- align DB, TS, Zod, API, and registry contracts
- reuse existing XLSX/table foundations
- make `sheet` real in canonical registry and library surfaces

Do not:

- build a second registry
- create a dead-end export that never becomes a real artifact
- leave planning saying `sheet` while persistence still cannot store it

Required report back:

- migration details
- storage/runtime choice
- registration path
- open/export behavior

### 9.3 Agent C packet — Evidence

Mission:

Strengthen the proof story for the artifact substrate and new `Wave 2` behavior.

Do:

- add service-backed or DB-backed integration tests
- reduce reliance on fully mocked route tests
- prove at least one real registry + artifact-run path

Do not:

- pad the suite with placeholder tests
- present route-shell tests as e2e proof

Required report back:

- exact commands run
- what is contract-level only
- what is integration-grade
- remaining evidence gaps

---

## 10. Supervision protocol

The supervising agent must enforce this reporting format from every worker:

1. what was changed
2. files touched
3. architectural decisions made
4. compatibility preserved
5. evidence produced
6. residual risks or scope boundaries

If a worker discovers a conflict with canonical docs, they must stop and report the conflict instead of improvising.

If a worker discovers unexpected parallel edits in the same files, they must stop and report it.

---

## 11. Context-window management rules

To avoid context-window failure, every worker agent must:

- read this packet first
- read only the canonical docs relevant to its own stream
- avoid broad repo exploration outside its stream
- report in tranche-sized increments
- avoid restating full project history in every reply

The supervising agent must:

- keep the global truth and scope boundaries
- reject inaccurate completion claims
- merge only after verifying acceptance criteria for the stream

---

## 12. Exit condition for Wave 2

`Wave 2` is ready for acceptance review only when all of the following are true:

- `Outputs Library` is visibly more than the old RAP shell
- `sheet` is a real governed artifact path
- canonical registry remains the only truth
- execution-spine integration remains intact
- evidence is stronger than route-shell mocks alone
- status reporting remains honest about what is still outside full `V8.1` closure

Until then, report the state as:

`V8.1 Wave 2 in progress`

and not:

`V8.1 complete`
