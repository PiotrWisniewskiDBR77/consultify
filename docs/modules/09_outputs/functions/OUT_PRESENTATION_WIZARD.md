---
module_id: MODULE_OUTPUTS
function_id: OUT_PRESENTATION_WIZARD
function_name: Outputs — Presentation Wizard
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Presentation Wizard

## 1. Function Identity
- Function ID: `OUT_PRESENTATION_WIZARD`
- Route: `/presentations/wizard`
- Runtime anchor: `PresentationWizard`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: guided presentation creation entry surface.
- Inputs: wizard setup context and artifact source options.
- Outputs: explicit create flow leading to editable deck/runtime.
- Evidence: route mapping and wizard component mount.
- Risk: wizard outcomes can diverge from library metadata if sync breaks.
