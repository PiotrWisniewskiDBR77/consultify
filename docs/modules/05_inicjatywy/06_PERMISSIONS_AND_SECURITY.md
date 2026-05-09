---
module_id: MODULE_INITIATIVES
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Inicjatywy

## Purpose

Opisać: role, effective roles, editability i bezpieczeństwo tenant/ACL dla inicjatyw.

## Must

- MUST: effective roles są zwracane przez backend (`userRoles[]`) i wynikają z system role + project membership + gate roles + steering board.
- MUST: FE nie inferuje uprawnień; renderuje wg backend capabilities.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie danych/akcji poza rolami wynikającymi z effective roles.

## Should

- SHOULD: Steering Board delegation rule jest egzekwowany przez backend (requiredRoles rewriting).

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/ROLES_MODEL.md`
- `DRD/consultify/docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`

