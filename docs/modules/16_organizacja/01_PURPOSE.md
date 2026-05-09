---
module_id: MODULE_ORGANIZATION
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Organizacja (Organization Context)

## Purpose

Zdefiniować po co istnieje Organization Context Engine: bezpieczna pamięć organizacji, która zamienia realne materiały pracy w governowany kontekst dla AI (retrieval + citations + lineage) bez ryzyka wycieku.

## Must

- MUST: zapewnić lifecycle “raw → extraction → normalized → chunks → retrieval → cited output → lineage”.
- MUST: AI używa chunków z filtrami ACL/tenant/project/workflow, nigdy raw plików.
- MUST: UI i API są “honest degraded” (ready/partial/unreadable/policy_blocked/quota_blocked).

## Must Not

- MUST NOT: dopuścić cross-tenant leakage (P0).
- MUST NOT: używać nieautoryzowanych chunków w generacji (P0).

## Should

- TBD

## Acceptance Criteria

- [ ] Purpose jest spójny z `ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`.

## Related Sources

- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`

