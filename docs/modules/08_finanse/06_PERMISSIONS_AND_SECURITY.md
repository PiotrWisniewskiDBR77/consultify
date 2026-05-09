---
module_id: MODULE_FINANCE
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Finanse

## Purpose

Uprawnienia i bezpieczeństwo dla danych finansowych, modeli i artefaktów analizy (w tym eksport).

## Must

- MUST: tenant/ACL boundaries; deny-by-default.
- MUST: akcje “approve analysis” i “export” są role-gated i audytowalne.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie danych finansowych bez jawnego uprawnienia.

## Should

- SHOULD: preflight checks przed eksportem (czy statements ready, czy model valid, czy user ma permission).

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/ROLES_MODEL.md`

