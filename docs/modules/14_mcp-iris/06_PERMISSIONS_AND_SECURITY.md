---
module_id: MODULE_MCP_IRIS
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — MCP IRIS

## Purpose

Uprawnienia i bezpieczeństwo dla MCP providera: konfiguracja org-level i bezpieczne tool calling.

## Must

- MUST: konfiguracja providerów tylko dla uprawnionych ról (org admin / superadmin).
- MUST: deny-by-default; tool allowlist obowiązkowy.
- MUST: tenant isolation i brak cross-tenant access przez MCP.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie szczegółów auth/config w UI.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`

