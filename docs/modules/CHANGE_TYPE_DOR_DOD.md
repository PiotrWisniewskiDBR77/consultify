---
doc_id: CHANGE_TYPE_DOR_DOD
doc_kind: ENTERPRISE_GOVERNANCE_STANDARD
owner: user
status: active
last_updated: 2026-05-10
---

# Change Type DoR / DoD

## Purpose

Define Definition of Ready and Definition of Done by change type.

This is the operating checklist for agents and developers before using RAW input or changing runtime behavior.

## Change Types

### 1. New Function

DoR:

- impacted module identified,
- function ID assigned,
- function contract created from standard,
- object/artifact owner identified,
- route/component/API/test evidence path planned.

DoD:

- function contract has all 12 sections,
- UI component footprint is concrete,
- evidence bundle is complete,
- module `04_UI_UX` and `07_ACCEPTANCE_AND_TESTS` updated,
- rerun gate passes.

### 2. UI/UX Change

DoR:

- approved shell/component family selected,
- UI/UX source documents loaded,
- artifact impact assessed,
- Menu 3/AI placement impact assessed.

DoD:

- uses approved component composition,
- no one-off toolbar/control introduced,
- loading/empty/error/degraded states documented,
- visual/component evidence linked,
- UI/UX contract updated.

### 3. API / Runtime Mutation Change

DoR:

- canonical owner module identified,
- mutation path and approval requirement defined,
- tenant/ACL impact assessed,
- test strategy defined.

DoD:

- no silent mutation,
- API evidence linked,
- read-back or state confirmation exists,
- audit evidence exists for high-impact operations,
- PR gate passes.

### 4. Permission / Security Change

DoR:

- role matrix impact identified,
- affected modules/functions listed,
- deny-by-default behavior defined.

DoD:

- `06_PERMISSIONS_AND_SECURITY.md` updated,
- `CROSS_MODULE_PERMISSION_MATRIX.md` updated if cross-module,
- security/tenant evidence linked,
- no raw internals or cross-tenant leakage.

### 5. Artifact Lifecycle Change

DoR:

- artifact family mapped in `ARTIFACT_LINEAGE_MATRIX.md`,
- owner module and form lane identified,
- approval/export gates defined.

DoD:

- lifecycle and save states remain separate,
- source/evidence/approval refs preserved,
- artifact route/component/API/test evidence linked,
- output/export behavior documented.

### 6. SuperAdmin / Control Plane Change

DoR:

- control-plane vs domain-plane boundary identified,
- policy-only vs domain mutation impact stated,
- audit requirement defined.

DoD:

- `CONTROL_PLANE_CONTRACT.md` remains consistent,
- domain object ownership not bypassed,
- admin/superadmin route/API/security tests identified,
- owner acceptance recorded.

### 7. RAW-to-Contract Conversion

DoR:

- RAW source identified,
- target module/function/workflow identified,
- conflict with current canon checked.

DoD:

- RAW claims converted into module/function/system contracts,
- traceability row updated,
- decision log updated if new decision made,
- implementation scope is frozen before coding.
