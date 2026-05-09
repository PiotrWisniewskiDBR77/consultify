---
module_id: MODULE_ORGANIZATION
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Organizacja (Organization Context)

## Purpose

Obiekty danych engine: raw assets, processing jobs, normalized docs, chunks, indexes, lineage events, quotas i retention.

## Must

- MUST: raw asset metadata zawiera m.in. `asset_id`, `organization_id`, `project_id`, `owner_id`, `visibility_scope`, `mime_type`, `hash`, `version`, `status`.
- MUST: processing jobs są idempotentne i retry-safe.
- MUST: lineage events zapisują źródła użyte w AI outputach (asset/version/chunk).

## Must Not

- MUST NOT: dopuścić do retrievalu chunków bez wcześniejszego filtrowania ACL/tenant/workflow.

## Should

- SHOULD: wspierać queue backend inline/async worker, z jawnością stanu kolejki (wg runbook).

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_RELEASE_GATE_RUNBOOK.md`

