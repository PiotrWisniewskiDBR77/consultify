---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — MCP Marketplace (DBR77)

## Purpose

Uprawnienia i bezpieczeństwo marketplace: konfiguracja org-level, read vs mutation, licencje i audit.

## Must

- MUST: provider config tylko dla ról admin (org admin / superadmin).
- MUST: allowlist tools obowiązkowy; deny-by-default.
- MUST: mutation tools (publish/order/license) tylko dla uprawnionych i audytowalne.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: importować assetów bez jawnego potwierdzenia usera (no silent writes).

## Should

- TBD

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`

