---
module_id: MODULE_TABLES
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Tabele (Table Studio)

## Purpose

Uprawnienia i bezpieczeństwo Table Platform: tenant isolation, public intake, AI scope gating, auditability.

## Must

- MUST: tenant isolation (cross-tenant probes odmawiają z `TENANT_VIOLATION`).
- MUST: public JWT intake ma rate limits i allow-list pól; token jest per-recipient.
- MUST: AI operator wyższych scope’ów (methodological/source) może być super-admin only.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie danych intake poza allow-list.

## Should

- SHOULD: każda mutacja i AI call jest audytowana (ledger + ai_usage).

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`

