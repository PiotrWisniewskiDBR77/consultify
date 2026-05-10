---
module_id: MODULE_MCP_IRIS
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — MCP IRIS

## Shipping Status (As-Is)

- Runtime class: `stub + planned`
- Launch path is wired in sidebar + route config, then rendered through `AppRoutes`.
- Current ownership decision: As-Is UI entry exists as a coming-soon integration surface.

## Current Risks

- Route exists, but behavior can diverge if imports are present and not mounted.
- Documentation must track mounted runtime, not planned/RAW target-state behavior.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with mounted route/component truth.
- Reclassify status only when `AppRoutes` mounts real runtime behavior on launch route.
