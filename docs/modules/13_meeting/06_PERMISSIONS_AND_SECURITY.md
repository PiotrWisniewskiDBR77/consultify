---
module_id: MODULE_MEETING
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Meeting

## Purpose

Uprawnienia i bezpieczeństwo Meeting: notatki i decyzje mogą zawierać wrażliwe treści, więc ACL/tenant to non-negotiable.

## Must

- MUST: tenant isolation + deny-by-default.
- MUST: brak public share domyślnie (jeśli pojawi się share, musi być jawnie zaprojektowany i audytowalny).

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: pokazywać meeting notes w search/list poza scope usera.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/ROLES_MODEL.md`

