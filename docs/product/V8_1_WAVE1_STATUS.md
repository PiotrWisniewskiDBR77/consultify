# V8.1 Wave 1 Status

> Status: historical Wave 1 substrate snapshot, later closure superseded
> Scope owner: Product + Engineering
> Last updated: 2026-03-29

---

## 1. Current truth

This document is a historical snapshot from before the later Wave 1 and package closeout ratifications.

Current authority now lives in:

- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/evidence/549-v8-v81-package-exception-retirement.md`

The current package should no longer be described as `not yet closed` for the frozen Wave 1 scope.

What exists today is a solid `Wave 1` shared artifact substrate:

- canonical artifact registry on top of `v8_output_artifacts`
- origin links and ACL envelope
- backfill for existing reports and presentations
- registry-first registration for report and presentation creation paths
- persisted `ArtifactRun` contract wired to the existing execution spine
- review start flow reusing the existing publish/review envelope
- `My Work` outputs slice backed by the canonical registry

This is meaningful progress, but it is not the same thing as the fully closed `V8.1` target from the functional spec.

---

## 2. Outputs Library scope boundary

### 2.1 What is implemented

The current frontend surface reuses the existing `ReportsAndPresentationsHub` as the first canonical outputs shell.

It already reads from the shared artifact substrate for reports and presentations and exposes governance metadata in preview.

### 2.2 What is not yet implemented

The functional-spec-grade `Outputs Library` is **not** fully implemented yet.

Missing surface closure includes at least:

- dedicated library views such as `All`, `Mine`, `Needs review`, `Sheets`
- a first-class `sheet` library surface
- a surface model that is visibly broader than the legacy reports/presentations hub taxonomy

Therefore the current UI must be described as:

`Wave 1 transitional Outputs Library surface built by reusing the existing Reports & Presentations hub`

and not as:

`fully implemented Outputs Library`

---

## 3. API status

### 3.1 Canonical ArtifactRun contract

The canonical ArtifactRun API is now:

- `POST /api/artifact-runs/from-chat`
- `GET /api/artifact-runs/:runId`
- `POST /api/artifact-runs/:runId/accept-plan`
- `POST /api/artifact-runs/:runId/retry`

### 3.2 Compatibility alias

The legacy compatibility alias still exists:

- `POST /api/artifacts/runs/from-chat`

This alias is retained for backward compatibility during `Wave 1`.

Because that alias still exists, status reports must **not** claim that there is already only one public planning entrypoint.

The correct statement is:

`ArtifactRun has a canonical contract under /api/artifact-runs/*, while /api/artifacts/runs/from-chat remains as a compatibility alias during Wave 1`

---

## 4. ACL note

Project-scoped access in `artifactRegistryService` must be tenant-safe.

`project_members` does not carry `organization_id` directly, so membership checks must be tenant-bounded through `projects.organization_id`.

The implemented rule is:

- membership is read from `project_members`
- then narrowed by joining `projects`
- and finally filtered by `projects.organization_id = current organization`

This avoids accidental cross-tenant membership expansion based only on `user_id`.

---

## 5. Test evidence boundary

Current evidence is strong for substrate and route-contract hardening, but it is not yet full end-to-end closure.

### 5.1 What is covered

- backend builds pass
- frontend build passes
- targeted contract tests pass for:
  - artifact registry mappings
  - artifact access ACL route behavior
  - artifact run route contract behavior

### 5.2 What is not yet covered

The current route tests mock the service layer.

That means they validate:

- request/response contract
- routing and permission gates
- status envelope shape

but they do **not** yet prove:

- real database persistence end-to-end
- real execution spine transitions through the API boundary
- full report/presentation generation lifecycle from UI trigger to canonical artifact record

So the correct evidence label is:

`targeted contract-level backend evidence`

and not:

`full end-to-end proof`

---

## 6. Recommended acceptance wording

Safe acceptance wording for the current state:

`V8.1 Wave 1 substrate is in place and the major backend findings are closed. The package is not yet a fully closed V8.1 product release because Outputs Library surface closure and deeper end-to-end evidence remain for later waves.`
