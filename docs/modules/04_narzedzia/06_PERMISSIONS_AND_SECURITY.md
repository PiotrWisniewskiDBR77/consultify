---
module_id: MODULE_TOOLS
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Narzędzia

## Purpose

Opisać kontrakt uprawnień i bezpieczeństwa dla sesji narzędziowych i wyników (w tym eksport i downstream handoff).

## Must

- MUST: narzędzia i sesje respektują tenant/ACL; dostęp do sesji jest kontrolowany.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: pokazywać ukrytych modułów/akcji użytkownikom bez uprawnień.

## Should

- SHOULD: role i widoczność są spójne z modelem ról projektu/inicjatyw (gdy sesje są powiązane z projektem).

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/ROLE_PERMISSIONS_WORKFLOW_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` (jeśli narzędzia korzystają z remote tools)

