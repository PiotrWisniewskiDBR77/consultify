---
module_id: MODULE_ORGANIZATION
function_id: ORG_LEGACY_CONTEXT_BUILDER
function_name: Organization — Legacy Context Builder Surface
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Legacy Context Builder Surface

## 1. Function Identity
- Function ID: `ORG_LEGACY_CONTEXT_BUILDER`
- Route family: `/context/*`
- Runtime anchor: `ContextBuilderView`
- Feature state: `partial` (transitional/compatibility surface)

## 2-12. Contract Summary
- Purpose: maintain compatibility surface while canonical ownership is `/organization/*`.
- Inputs: legacy context-builder navigation and context data.
- Outputs: explicit transitions aligned to organization ownership.
- Boundaries: no separate canonical ownership domain.
- Evidence: `AppRoutes.tsx` context builder route mapping.
- Risk: ownership ambiguity if legacy copy/flows diverge.
