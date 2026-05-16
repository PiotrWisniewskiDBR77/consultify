---
module_id: MODULE_ORGANIZATION
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Organizacja (Organization Context)

## Purpose

Kontrakt zachowania engine: ingest → async processing → retrieval → citations → lineage, z bezpieczeństwem i honest degraded states.

## Must

- MUST: każde upload tworzy asset record + processing job; ciężka ekstrakcja jest async.
- MUST: statusy rozróżniają: uploaded/processing/partial/ready/unreadable/policy_blocked/quota_blocked.
- MUST: retrieval filtruje tenant/org/project/user/role/workflow przed użyciem chunków.
- MUST: każdy AI output, który użył kontekstu, zapisuje lineage (asset/version/chunk ids + quality).

## Must Not

- MUST NOT: używać raw plików bez retrieval/chunking.
- MUST NOT: pokazywać fake “ready” gdy tylko metadata została zapisana.
- MUST NOT: wycieki raw content w logach/telemetry bez governance.

## Should

- SHOULD: mieć bezpieczne cache hot context per tenant/scope.
- SHOULD: wspierać tryby explicit context use (`selected_material_only`, `...approved_org_context`) zależnie od workflow.

## Acceptance Criteria

- [ ] Zawiera jawne reguły `proposal -> approval -> execution -> audit` tam, gdzie czat inicjuje działania.
- [ ] Definiuje “uczciwe” stany błędów i degradacji (bez fake success / infinite spinner).

## Related Sources

- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md`

