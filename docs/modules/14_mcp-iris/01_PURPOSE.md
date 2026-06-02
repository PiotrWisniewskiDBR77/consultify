---
module_id: MODULE_MCP_IRIS
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — MCP IRIS

## Purpose

Kontrolowany provider MCP do IRIS: odczyt KPI/evidence/workorders and integration touchpoints through allowlisted, audited tools.

As-Is realizacja jest placeholderowa (`IRIS_PLACEHOLDER_SURFACE`) z utrzymanym kontraktem funkcji docelowej (`IRIS_RUNTIME_TARGET`).

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Raw database tunnel.
- Unbounded tool execution or hidden mutations.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `DRD/consultify/docs/product/INTEGRATIONS_CONNECTOR_RUNBOOKS_ENTERPRISE_V3.md`
