---
doc_id: EVIDENCE_REGISTRY
doc_kind: ENTERPRISE_GOVERNANCE_REGISTRY
owner: user
status: active
last_updated: 2026-05-10
---

# Evidence Registry

## Purpose

Provide one registry for proof that documentation claims are backed by runtime behavior.

This registry is not a replacement for tests. It indexes which proof category is required and where proof must live.

## Evidence Types

| Evidence type | Required for | Accepted examples |
| --- | --- | --- |
| `route` | navigation, mounting, route ownership | `routeConfig.ts`, `AppRoutes.tsx`, deep-link smoke |
| `component` | UI/UX and component claims | `src/components/**`, `src/views/**`, screen evidence |
| `api` | data/mutation/integration claims | `server/src/routes/**`, services, `src/services/api.ts` |
| `test` | acceptance and release claims | `tests/**`, `tests/e2e/**`, smoke scripts |
| `security` | tenant/ACL/role claims | permission tests, middleware tests, admin smoke |
| `artifact` | output/document/deck/table claims | artifact lineage, export proof, preview proof |
| `audit` | high-impact mutation claims | audit log, proposal approval record, trace ID |

## Registry Matrix

| Area | Minimum evidence bundle | Gate |
| --- | --- | --- |
| module contract | route + component + API + test | module contract rerun gate |
| function contract | route + component + API + test | function contract standard |
| cross-module workflow | route + component + API + test + owner | E2E workflow contract |
| artifact lifecycle | artifact + approval + route + API + test | artifact lineage matrix |
| control plane | route + API + security + audit + test | control plane contract |
| AI/high-impact mutation | source + approval + execution + audit | UI/UX source of truth |

## Evidence Quality Rules

1. Evidence must point to runtime or executable proof, not only narrative docs.
2. Screenshots are useful but not sufficient without route/component/API/test evidence for critical behavior.
3. Fake success, local mock state, and placeholder-only tests do not count as proof.
4. Evidence must be refreshed when runtime implementation changes.

## Evidence Status Vocabulary

- `COMPLETE`: evidence exists and is current.
- `PARTIAL`: evidence exists but one category is missing.
- `PLANNED`: evidence path is known but not implemented.
- `MISSING`: no acceptable evidence.
- `OBSOLETE`: evidence references old runtime or legacy route.

## Registry Maintenance Rule

Any PR changing runtime behavior must update the relevant module/function evidence references or explicitly mark the evidence state in the impacted contract.
