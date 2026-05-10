---
module_id: MODULE_ORGANIZATION
function_id: ORG_CONTEXT_WORKSPACE
function_name: Organization — Context Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Context Workspace

## 1. Function Identity
- Function ID: `ORG_CONTEXT_WORKSPACE`
- Route family: `/organization/*`
- Runtime anchor: `OrganizationView`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: canonical organization context and knowledge management workspace.
- Inputs: organization assets, context state, ingestion/readiness metadata.
- Outputs: explicit context updates and governed AI-context readiness actions.
- UI footprint: `OrganizationView` sectioned workspace.
- Security: tenant/ACL boundaries and no hidden memory writes.
- Evidence: `AppRoutes.tsx` organization route mapping, `OrganizationView.tsx`.
- Risk: ingestion readiness UX drift across asset types.
