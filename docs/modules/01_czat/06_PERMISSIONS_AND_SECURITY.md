---
module_id: MODULE_CHAT
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Czat

## Purpose

Opisać kontrakt uprawnień, widoczności, sharingu i enterprise guardrails dla czatu.

## Must

- TBD (migracja z `CHAT_V8_SHARING_AND_PERMISSIONS.md` + compliance)

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie ukrytych modułów/akcji użytkownikom bez uprawnień.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `DRD/consultify/docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`

