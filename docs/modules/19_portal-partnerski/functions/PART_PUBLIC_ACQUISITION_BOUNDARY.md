---
module_id: MODULE_PARTNER_PORTAL
function_id: PART_PUBLIC_ACQUISITION_BOUNDARY
function_name: Partner Portal — Public Acquisition Boundary
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Public Acquisition Boundary

## 1. Function Identity
- Function ID: `PART_PUBLIC_ACQUISITION_BOUNDARY`
- Boundary routes: protected `/partner/*` vs public `/become-partner*` and `/partner/pricing`
- Feature state: `partial` (boundary active, ongoing consistency checks)

## 2-12. Contract Summary
- Purpose: prevent leakage between public acquisition journey and protected portal runtime.
- Inputs: route and auth context.
- Outputs: explicit separation of public vs protected states and data.
- Evidence: codemap route ownership notes.
- Risk: accidental data leakage from protected portal into public surfaces.
