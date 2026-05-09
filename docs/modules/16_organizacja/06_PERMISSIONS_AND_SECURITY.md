---
module_id: MODULE_ORGANIZATION
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Organizacja (Organization Context)

## Purpose

Kontrakt bezpieczeństwa dla org context: tenant isolation, ACL boundary w backendzie, brak wycieków do AI promptów i logów.

## Must

- MUST: backend/API ACL jest boundary (frontend hiding nie jest security).
- MUST: retrieval stosuje tenant/org/project/user/role/workflow filters zanim chunk trafi do promptu.
- MUST: raw file access jest kontrolowany (signed/expiring).
- MUST: deleted/revoked docs nie są dostępne do nowych generacji.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: logować raw treści dokumentów w telemetry/system prompts.

## Should

- SHOULD: mieć testy negatywne cross-tenant i audit queries (wg runbook).

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_RELEASE_GATE_RUNBOOK.md`

